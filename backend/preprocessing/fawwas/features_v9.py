"""V9 features: whole-utterance, voiced-frame-level extraction.

Why v9 exists (see docs/AI-research/laporan_riset_perbaikan_pipeline_v9_2026-11-16.md):

* v4-v8 required a 2 s active window before computing ANY feature, so short
  utterances lost glottal *and* MFCC/LFCC values. Missingness then predicted the
  label and the baselines were crippled by a gate designed for glottal analysis.
* v9 never gates on a fixed window. Spectral features use every active frame.
  Phonation features use every voiced frame / stable voiced run of the whole
  trimmed utterance, with graded validity (voiced seconds, pulse count) that is
  reported as QC instead of silently turning into NaN for whole families.
* H1-H2 is reported raw and formant-corrected (Iseli & Alwan 2004; bandwidths
  from Hawks & Miller 1995), following the VoiceSauce convention.

These remain acoustic proxies of phonation, not measured glottal flow.
No dataset processing happens on import. Configuration is passed explicitly.
"""
import numpy as np
import librosa
import parselmouth
from parselmouth.praat import call
from scipy.fft import dct

DEFAULTS_V9 = dict(
    sample_rate=16000, pitch_floor=60.0, pitch_ceiling=400.0,
    trim_db=35.0, active_db=30.0,
    min_seconds=0.30,          # below this nothing is measured
    min_voiced_s=0.25,         # F0/HNR/harmonic statistics need this much voicing
    min_voiced_run_s=0.08,     # a stable run must last at least this long
    min_pulses_run=5,          # ... and contain this many glottal pulses
    min_pulses_total=20,       # jitter/shimmer need this many pulses in total
    harmonic_frame_step=2,     # analyse every n-th voiced pitch frame
    n_ceps=20, n_filters=40, spectral_cmn=False,
)

F0_V9 = ('f0_median_hz', 'f0_mean_hz', 'f0_std_hz', 'f0_iqr_st', 'f0_step_st', 'voiced_ratio')
PERT_V9 = ('jitter_local', 'jitter_rap', 'jitter_ppq5', 'shimmer_local', 'shimmer_apq3', 'shimmer_apq5')
NOISE_V9 = ('hnr_median', 'hnr_iqr', 'cpps')
HARM_RAW_V9 = ('h1h2_raw_median', 'h1h2_raw_iqr', 'h2h4_raw_median', 'richness_raw_median', 'richness_raw_iqr')
HARM_COR_V9 = ('h1h2_cor_median', 'h1h2_cor_iqr', 'h2h4_cor_median', 'h1a3_cor_median')

G0_V9 = list(F0_V9)
G1_V9 = list(PERT_V9 + NOISE_V9[:2])
G2_V9 = list(HARM_RAW_V9)
G2C_V9 = list(HARM_COR_V9)
G3_V9 = G0_V9 + G1_V9 + G2_V9
G3C_V9 = G0_V9 + G1_V9 + G2C_V9          # formant-corrected harmonic variant
GLOTTAL_ALL_V9 = G0_V9 + G1_V9 + ['cpps'] + G2_V9 + G2C_V9

SPEC_ORDERS_V9 = ('static_mean', 'static_std', 'delta_std', 'delta2_std')


def spectral_columns_v9(kind, n_ceps=20):
    return [f'{kind}_{order}_{i:02d}' for order in SPEC_ORDERS_V9 for i in range(1, n_ceps + 1)]


MFCC_V9 = spectral_columns_v9('mfcc')
LFCC_V9 = spectral_columns_v9('lfcc')
QC_V9 = ['original_seconds', 'trimmed_seconds', 'trim_fraction', 'clip_fraction',
         'active_fraction', 'voiced_seconds', 'n_pulses']
VALID_V9 = ['spectral_valid', 'f0_valid', 'perturbation_valid', 'harmonic_valid']
MISSING_V9 = [f'missing_{g}' for g in ('f0', 'perturbation', 'harmonic')]

FAMILIES_V9 = {
    'G0_prosody': G0_V9, 'G1_perturb_hnr': G1_V9, 'G2_harmonic_raw': G2_V9,
    'G2_harmonic_corrected': G2C_V9,
    'G3_glottal': G3_V9, 'G3_glottal_corrected': G3C_V9,
    'G3_plus_cpps': G3_V9 + ['cpps'],
    'G3_without_prosody': G1_V9 + G2_V9,
    'G3_without_perturb_hnr': G0_V9 + G2_V9,
    'G3_without_harmonic': G0_V9 + G1_V9,
    'MFCC': MFCC_V9, 'LFCC': LFCC_V9, 'MFCC_LFCC': MFCC_V9 + LFCC_V9,
    'MFCC_plus_G3': MFCC_V9 + G3_V9, 'LFCC_plus_G3': LFCC_V9 + G3_V9,
    'QC_only': QC_V9, 'Missing_only': MISSING_V9,
    # Incremental value over the QC/silence shortcut: compare each with QC_only.
    'QC_plus_G3': QC_V9 + G3_V9, 'QC_plus_MFCC': QC_V9 + MFCC_V9, 'QC_plus_LFCC': QC_V9 + LFCC_V9,
}
FEATURE_COLUMNS_V9 = GLOTTAL_ALL_V9 + MFCC_V9 + LFCC_V9


def config_v9(overrides=None):
    cfg = dict(DEFAULTS_V9)
    cfg.update(overrides or {})
    return cfg


def _median_iqr(values):
    a = np.asarray(values, dtype=float)
    a = a[np.isfinite(a)]
    if not len(a):
        return np.nan, np.nan
    q25, q50, q75 = np.percentile(a, [25, 50, 75])
    return float(q50), float(q75 - q25)


# ---------------------------------------------------------------- preprocessing
def preprocess_v9(raw, original_sr, cfg):
    """Mono, resample, edge trim, one RMS scale per utterance. Returns audio + QC."""
    x = np.asarray(raw, dtype=float)
    if x.ndim == 2:
        x = x.mean(axis=1)
    if x.size == 0 or not np.isfinite(x).all():
        raise ValueError('Audio kosong/nonfinite')
    qc = dict(original_seconds=len(x) / original_sr, original_sr=int(original_sr),
              clip_fraction=float(np.mean(np.abs(x) >= 0.999)))
    sr = cfg['sample_rate']
    if original_sr != sr:
        x = librosa.resample(x, orig_sr=original_sr, target_sr=sr)
    if np.max(np.abs(x)) < 1e-6:
        raise ValueError('Audio sepenuhnya sunyi')
    trimmed, _ = librosa.effects.trim(x, top_db=cfg['trim_db'], frame_length=400, hop_length=160)
    qc['trim_fraction'] = 1. - len(trimmed) / len(x)
    qc['trimmed_seconds'] = len(trimmed) / sr
    trimmed = trimmed - trimmed.mean()
    trimmed = trimmed / max(np.sqrt(np.mean(trimmed ** 2)), 1e-8)
    return trimmed, qc


def active_mask_v9(x, cfg):
    """Energy activity per 25 ms / 10 ms frame (not a learned VAD)."""
    if len(x) < 400:
        return np.zeros(0, dtype=bool)
    frames = librosa.util.frame(x, frame_length=400, hop_length=160).T
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    level = np.percentile(rms, 90) * 10 ** (-cfg['active_db'] / 20)
    return rms > max(level, 1e-6)


# --------------------------------------------------------------------- spectral
def cepstral_frames_v9(x, sr, cfg, active=None):
    """Frame-level MFCC and LFCC (c1..cN + delta + delta-delta) on active frames.

    Returns {'mfcc': (T, 3N), 'lfcc': (T, 3N)}. Used both for utterance statistics
    and for the frame-level GMM reference baseline (baseline_gmm.py).
    """
    n = cfg['n_ceps']
    if len(x) < 400:
        return {k: np.empty((0, 3 * n)) for k in ('mfcc', 'lfcc')}
    frames = librosa.util.frame(x, frame_length=400, hop_length=160).T
    power = np.abs(np.fft.rfft(frames * np.hanning(400), n=512, axis=1)).T ** 2
    hz = np.fft.rfftfreq(512, 1 / sr)
    edges = np.linspace(0, sr / 2, cfg['n_filters'] + 2)
    linbank = np.array([np.maximum(0, np.minimum((hz - a) / (b - a), (c - hz) / (c - b)))
                        for a, b, c in zip(edges[:-2], edges[1:-1], edges[2:])])
    melbank = librosa.filters.mel(sr=sr, n_fft=512, n_mels=cfg['n_filters'], fmin=0, fmax=sr / 2)
    if active is None:
        active = active_mask_v9(x, cfg)
    out = {}
    for kind, bank in (('mfcc', melbank), ('lfcc', linbank)):
        cep = dct(np.log(np.maximum(bank @ power, 1e-12)), type=2, axis=0, norm='ortho')[1:n + 1]
        if cfg.get('spectral_cmn'):
            cep = cep - cep.mean(axis=1, keepdims=True)
        width = min(9, cep.shape[1] if cep.shape[1] % 2 else cep.shape[1] - 1)
        if width >= 3:
            d1 = librosa.feature.delta(cep, width=width, order=1, mode='nearest')
            d2 = librosa.feature.delta(cep, width=width, order=2, mode='nearest')
        else:
            d1 = d2 = np.zeros_like(cep)
        out[kind] = np.vstack([cep, d1, d2]).T[active[:cep.shape[1]]]
    return out


def spectral_stats_v9(frames_by_kind, cfg):
    n = cfg['n_ceps']
    out = {}
    for kind, m in frames_by_kind.items():
        ok = len(m) >= 10
        parts = dict(static_mean=m[:, :n].mean(0) if ok else None,
                     static_std=m[:, :n].std(0) if ok else None,
                     delta_std=m[:, n:2 * n].std(0) if ok else None,
                     delta2_std=m[:, 2 * n:].std(0) if ok else None)
        for order, vec in parts.items():
            for i in range(n):
                out[f'{kind}_{order}_{i + 1:02d}'] = float(vec[i]) if ok else np.nan
    return out


# -------------------------------------------------------------------- harmonics
def hawks_miller_bandwidth(formant_hz, f0_hz):
    """Formant bandwidth estimate (Hawks & Miller 1995), as used by VoiceSauce."""
    s = 1. + 0.25 * (f0_hz - 132.) / 88.
    if formant_hz < 500.:
        k, c = 165.327516, (-6.73636734e-1, 1.80874446e-3, -4.52201682e-6, 7.49514000e-9, -4.70219241e-12)
    else:
        k, c = 15.8146139, (8.10159009e-2, -9.79728215e-5, 5.28725064e-8, -1.07099364e-11, 7.91528509e-16)
    return s * (k + sum(ci * formant_hz ** (i + 1) for i, ci in enumerate(c)))


def iseli_correction_db(freq_hz, formant_hz, bandwidth_hz, sr):
    """dB boost a single formant resonance adds at freq_hz (Iseli & Alwan 2004)."""
    r = np.exp(-np.pi * bandwidth_hz / sr)
    wf, w = 2 * np.pi * formant_hz / sr, 2 * np.pi * freq_hz / sr
    num = (1 - 2 * r * np.cos(wf) + r * r) ** 2
    den = (1 - 2 * r * np.cos(w + wf) + r * r) * (1 - 2 * r * np.cos(w - wf) + r * r)
    return 10 * np.log10(num / den)


def _peak_db(mag, hz, target, tol):
    band = np.abs(hz - target) <= tol
    if not band.any():
        return np.nan
    return 20 * np.log10(max(float(mag[band].max()), 1e-12))


def harmonic_frame_v9(frame, sr, f0, formants):
    """Raw and formant-corrected harmonic measures on a ~3-period frame."""
    keys = ('h1h2_raw', 'h2h4_raw', 'richness_raw', 'h1h2_cor', 'h2h4_cor', 'h1a3_cor')
    n = len(frame)
    if n < 8 or 8.1 * f0 >= sr / 2:
        return dict.fromkeys(keys, np.nan)
    w = (frame - frame.mean()) * np.hanning(n)
    nfft = max(4096, 2 ** int(np.ceil(np.log2(n))))
    mag = np.abs(np.fft.rfft(w, n=nfft))
    hz = np.fft.rfftfreq(nfft, 1 / sr)
    h = [_peak_db(mag, hz, k * f0, 0.10 * f0) for k in range(1, 9)]
    if not np.isfinite(h[:4]).all():
        return dict.fromkeys(keys, np.nan)
    lin = 10 ** (np.asarray(h) / 20)
    out = dict(h1h2_raw=h[0] - h[1], h2h4_raw=h[1] - h[3],
               richness_raw=20 * np.log10(np.nansum(lin[1:]) / lin[0]))
    out.update(h1h2_cor=np.nan, h2h4_cor=np.nan, h1a3_cor=np.nan)
    f1, f2, f3 = (formants + [np.nan] * 3)[:3]
    if np.isfinite([f1, f2]).all() and 150 < f1 < f2:
        bws = [hawks_miller_bandwidth(f, f0) for f in (f1, f2)]

        def corrected(level_db, freq):
            return level_db - sum(iseli_correction_db(freq, f, b, sr) for f, b in zip((f1, f2), bws))

        h1c, h2c, h4c = corrected(h[0], f0), corrected(h[1], 2 * f0), corrected(h[3], 4 * f0)
        out.update(h1h2_cor=h1c - h2c, h2h4_cor=h2c - h4c)
        if np.isfinite(f3) and f3 < sr / 2 - f0:
            a3 = _peak_db(mag, hz, f3, f0)  # strongest harmonic near F3
            if np.isfinite(a3):
                b3 = hawks_miller_bandwidth(f3, f0)
                a3c = a3 - sum(iseli_correction_db(f3, f, b, sr) for f, b in zip((f1, f2), bws))
                a3c -= iseli_correction_db(f3, f3, b3, sr)
                out['h1a3_cor'] = h1c - a3c
    return out


# -------------------------------------------------------------------- phonation
def stable_runs_v9(f0, times, cfg):
    """Voiced runs without >20% frame-to-frame pitch jumps, lasting >= min_voiced_run_s."""
    good = np.isfinite(f0) & (f0 > 0)
    start = None
    for i in range(len(f0) + 1):
        broken = i == len(f0) or not good[i] or (
            start is not None and i > start and abs(np.log(f0[i] / f0[i - 1])) > np.log(1.2))
        if start is not None and broken:
            if times[i - 1] - times[start] + 0.01 >= cfg['min_voiced_run_s']:
                yield max(0., times[start] - 0.005), times[i - 1] + 0.005
            start = None
        if i < len(f0) and good[i] and start is None:
            start = i


def phonation_v9(x, sr, cfg):
    """Whole-utterance phonation proxies with explicit validity flags."""
    out = dict.fromkeys(GLOTTAL_ALL_V9, np.nan)
    snd = parselmouth.Sound(x, sampling_frequency=sr)
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=cfg['pitch_floor'], pitch_ceiling=cfg['pitch_ceiling'])
    f0 = np.asarray(pitch.selected_array['frequency'], dtype=float)
    times = np.asarray(pitch.xs())
    voiced = np.isfinite(f0) & (f0 > 0)
    voiced_seconds = float(voiced.sum() * pitch.dx)
    out.update(voiced_seconds=voiced_seconds, n_pulses=0, perturbation_errors=0,
               voiced_ratio=float(voiced.mean()) if len(voiced) else 0.)
    f0_valid = voiced_seconds >= cfg['min_voiced_s']
    out.update(f0_valid=bool(f0_valid), perturbation_valid=False, harmonic_valid=False)
    try:
        out['cpps'] = float(call(call(snd, 'To PowerCepstrogram', cfg['pitch_floor'], 0.01, 5000.0, 50.0),
                                 'Get CPPS', True, 0.02, 0.0005, cfg['pitch_floor'], cfg['pitch_ceiling'],
                                 0.05, 'Parabolic', 0.001, 0.05, 'Straight', 'Robust'))
    except parselmouth.PraatError:
        pass
    if not f0_valid:
        out['voiced_ratio'] = out['voiced_ratio'] if len(voiced) else np.nan
        return out
    v = f0[voiced]
    semi = 12 * np.log2(v / np.median(v))
    adjacent = voiced[1:] & voiced[:-1]
    steps = 12 * np.abs(np.log2(f0[1:][adjacent] / f0[:-1][adjacent]))
    out.update(f0_median_hz=float(np.median(v)), f0_mean_hz=float(v.mean()), f0_std_hz=float(v.std()),
               f0_iqr_st=_median_iqr(semi)[1], f0_step_st=_median_iqr(steps)[0])
    hnr = snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=cfg['pitch_floor'])
    hv = np.asarray(hnr.values).ravel()
    hi = np.clip(np.rint((np.asarray(hnr.xs()) - times[0]) / pitch.dx).astype(int), 0, len(f0) - 1)
    out['hnr_median'], out['hnr_iqr'] = _median_iqr(hv[(hv > -199) & voiced[hi]])

    # Jitter/shimmer: pulse-weighted mean over stable voiced runs of the whole utterance.
    sums = dict.fromkeys(PERT_V9, 0.)
    weights = dict.fromkeys(PERT_V9, 0.)
    praat_names = dict(jitter_local='Get jitter (local)', jitter_rap='Get jitter (rap)',
                       jitter_ppq5='Get jitter (ppq5)', shimmer_local='Get shimmer (local)',
                       shimmer_apq3='Get shimmer (apq3)', shimmer_apq5='Get shimmer (apq5)')
    args = (0, 0, 0.8 / cfg['pitch_ceiling'], 1.25 / cfg['pitch_floor'], 1.3)
    for lo, hi_t in stable_runs_v9(f0, times, cfg):
        section = parselmouth.Sound(x[round(lo * sr):min(len(x), round(hi_t * sr))], sampling_frequency=sr)
        try:
            points = call(section, 'To PointProcess (periodic, cc)', cfg['pitch_floor'], cfg['pitch_ceiling'])
            pulses = int(call(points, 'Get number of points'))
            if pulses < cfg['min_pulses_run']:
                continue
            out['n_pulses'] += pulses
            for name, command in praat_names.items():
                value = float(call(points, command, *args) if name.startswith('jitter')
                              else call([section, points], command, *args, 1.6))
                if np.isfinite(value):
                    sums[name] += value * pulses
                    weights[name] += pulses
        except parselmouth.PraatError:
            out['perturbation_errors'] += 1
    if out['n_pulses'] >= cfg['min_pulses_total']:
        for name in PERT_V9:
            out[name] = sums[name] / weights[name] if weights[name] else np.nan
        out['perturbation_valid'] = bool(np.isfinite(out['jitter_local']) and np.isfinite(out['shimmer_local']))

    # Harmonics: raw + formant-corrected on voiced frames.
    ceiling = 5000.0 if np.median(v) < 165. else 5500.0
    formant = None
    try:
        formant = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=ceiling)
    except parselmouth.PraatError:
        pass
    rows = []
    for i in np.flatnonzero(voiced)[::cfg['harmonic_frame_step']]:
        half = int(np.ceil(1.5 * sr / f0[i])) + 2
        center = round(times[i] * sr)
        if center - half < 0 or center + half > len(x):
            continue
        fm = [formant.get_value_at_time(k, times[i]) for k in (1, 2, 3)] if formant is not None else []
        n = round(3.0 * sr / f0[i])
        seg = x[center - half:center + half]
        start = (len(seg) - n) // 2
        rows.append(harmonic_frame_v9(seg[start:start + n], sr, f0[i], fm))
    if rows:
        col = lambda k: [r[k] for r in rows]
        out['h1h2_raw_median'], out['h1h2_raw_iqr'] = _median_iqr(col('h1h2_raw'))
        out['h2h4_raw_median'] = _median_iqr(col('h2h4_raw'))[0]
        out['richness_raw_median'], out['richness_raw_iqr'] = _median_iqr(col('richness_raw'))
        out['h1h2_cor_median'], out['h1h2_cor_iqr'] = _median_iqr(col('h1h2_cor'))
        out['h2h4_cor_median'] = _median_iqr(col('h2h4_cor'))[0]
        out['h1a3_cor_median'] = _median_iqr(col('h1a3_cor'))[0]
        out['harmonic_valid'] = bool(np.isfinite(out['h1h2_raw_median']))
    return out


# ------------------------------------------------------------------- top level
def extract_audio_v9(raw, original_sr, cfg=None, return_frames=False):
    """One row of utterance-level features. Never requires a fixed-length window."""
    cfg = config_v9(cfg)
    sr = cfg['sample_rate']
    x, qc = preprocess_v9(raw, original_sr, cfg)
    out = dict.fromkeys(FEATURE_COLUMNS_V9, np.nan)
    out.update(qc)
    out.update(voiced_seconds=0., n_pulses=0, perturbation_errors=0, active_fraction=0.,
               spectral_valid=False, f0_valid=False, perturbation_valid=False, harmonic_valid=False)
    frames = None
    if qc['trimmed_seconds'] >= cfg['min_seconds']:
        active = active_mask_v9(x, cfg)
        out['active_fraction'] = float(active.mean()) if len(active) else 0.
        frames = cepstral_frames_v9(x, sr, cfg, active)
        out.update(spectral_stats_v9(frames, cfg))
        out['spectral_valid'] = bool(len(frames['lfcc']) >= 10)
        out.update(phonation_v9(x, sr, cfg))
    out['analysis_status'] = ('ok' if out['f0_valid'] else 'spectral_only') if out['spectral_valid'] else 'too_short'
    out['missing_f0'] = float(not out['f0_valid'])
    out['missing_perturbation'] = float(not out['perturbation_valid'])
    out['missing_harmonic'] = float(not out['harmonic_valid'])
    return (out, frames) if return_frames else out


def extract_frames_v9(raw, original_sr, cfg=None):
    """Only the cepstral frames for the GMM baseline (fast; no phonation analysis).

    Identical preprocessing and active-frame selection to extract_audio_v9, so a cache
    rebuilt this way matches the one written during full extraction.
    """
    cfg = config_v9(cfg)
    x, qc = preprocess_v9(raw, original_sr, cfg)
    if qc['trimmed_seconds'] < cfg['min_seconds']:
        return None
    return cepstral_frames_v9(x, cfg['sample_rate'], cfg, active_mask_v9(x, cfg))


def self_check_v9(cfg=None):
    cfg = config_v9(cfg)
    sr = cfg['sample_rate']
    t = np.arange(round(sr * 1.2)) / sr          # 1.2 s: rejected by the v4 2 s gate
    x = .25 * (np.sin(2 * np.pi * 120 * t) + .5 * np.sin(2 * np.pi * 240 * t) + .25 * np.sin(2 * np.pi * 480 * t))
    a, b = extract_audio_v9(x, sr, cfg), extract_audio_v9(x * .5, sr, cfg)
    assert a['analysis_status'] == 'ok' and abs(a['f0_median_hz'] - 120) < 5
    assert abs(a['h1h2_raw_median'] - 20 * np.log10(2)) < 1
    assert np.isfinite([a[c] for c in MFCC_V9 + LFCC_V9]).all()
    assert np.allclose([a[c] for c in G3_V9], [b[c] for c in G3_V9], equal_nan=True, atol=1e-5)
    assert len(G3_V9) == len(set(G3_V9)) and not set(G3_V9) & set(QC_V9 + MISSING_V9 + MFCC_V9 + LFCC_V9)
    short = extract_audio_v9(x[:round(sr * .1)], sr, cfg)
    assert short['analysis_status'] == 'too_short' and np.isnan(short['f0_median_hz'])
    return dict(status='passed', g3_features=len(G3_V9), f0_hz=a['f0_median_hz'])
