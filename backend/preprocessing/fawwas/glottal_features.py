"""V4 features: required glottal package plus explicitly named v3 extensions.

Acoustic phonation proxies and prediction residuals, not measured glottal flow.
No dataset processing happens on import. Configuration is passed explicitly.
"""
import numpy as np
import pandas as pd
import librosa
import parselmouth
from parselmouth.praat import call
from scipy.fft import dct
from scipy.signal import lfilter, correlate

POOL_STATS = ('median', 'iqr', 'p10', 'p90')
F0_BASE = ('f0_mean_hz', 'f0_median_hz', 'f0_std_hz', 'voiced_ratio')
CORE_BASE = ('cpps', 'hnr', 'f0_spread_st', 'f0_step_st')
PERT_BASE = ('jitter_local', 'jitter_rap', 'shimmer_local', 'shimmer_apq3')
HARM_BASE = ('h1h2_raw', 'h2h4_raw', 'richness_raw_db')
RES_BASE = tuple(f'lp{p}_{m}' for p in (8, 16, 24) for m in ('st_gain_db', 'lt_gain_db', 'kurtosis'))
SPEC_BASE = tuple(f'{kind}_{order}_{i:02d}' for kind in ('mfcc', 'lfcc')
                  for order in ('static_mean', 'static_std', 'delta_abs') for i in range(1, 21))
SEGMENT_COLUMNS = list(F0_BASE + CORE_BASE + PERT_BASE + HARM_BASE + RES_BASE + SPEC_BASE)
FEATURE_COLUMNS = [f'{name}_{stat}' for name in SEGMENT_COLUMNS for stat in POOL_STATS]
QC_COLUMNS = ['original_seconds', 'trim_fraction', 'clip_fraction', 'active_fraction',
              'n_windows', 'voiced_fraction', 'perturbation_valid_fraction']
MISSING_COLUMNS = [f'missing_{name}' for name in F0_BASE + CORE_BASE + PERT_BASE + HARM_BASE + RES_BASE]

def pooled_columns(names):
    return [f'{name}_{stat}' for name in names for stat in POOL_STATS]

P_CORE = pooled_columns(CORE_BASE)
P_PERT = pooled_columns(PERT_BASE)
H_RAW = pooled_columns(HARM_BASE)
R_PRED = pooled_columns(RES_BASE)
MFCC_V2 = pooled_columns([x for x in SPEC_BASE if x.startswith('mfcc_')])
LFCC_V2 = pooled_columns([x for x in SPEC_BASE if x.startswith('lfcc_')])
FAMILIES_V2 = {
    'P_fonation': P_CORE + P_PERT,
    'P_no_perturbation': P_CORE,
    'P_plus_H_raw': P_CORE + P_PERT + H_RAW,
    'R_prediction': R_PRED,
    'P_plus_R': P_CORE + P_PERT + R_PRED,
    'MFCC': MFCC_V2,
    'LFCC': LFCC_V2,
    'LFCC_plus_P': LFCC_V2 + P_CORE + P_PERT,
    'QC_only': QC_COLUMNS,
    'Missing_only': MISSING_COLUMNS,
}

def finite_stats(values):
    a = np.asarray(values, dtype=float)
    a = a[np.isfinite(a)]
    if not len(a):
        return dict.fromkeys(POOL_STATS, np.nan)
    q10, q25, q50, q75, q90 = np.percentile(a, [10, 25, 50, 75, 90])
    return dict(median=float(q50), iqr=float(q75-q25), p10=float(q10), p90=float(q90))


def cpps_value(x, sr, cfg):
    snd = parselmouth.Sound(x, sampling_frequency=sr)
    pc = call(snd, 'To PowerCepstrogram', cfg['pitch_floor'], 0.01, 5000.0, 50.0)
    return float(call(pc, 'Get CPPS', True, 0.02, 0.0005,
                      cfg['pitch_floor'], cfg['pitch_ceiling'], 0.05,
                      'Parabolic', 0.001, 0.05, 'Straight', 'Robust'))


def harmonic_values(x, sr, f0):
    """Three-period Hann window; raw harmonics, without formant correction."""
    n = round(3.0 * sr / f0)
    if len(x) < n or n < 8:
        return dict.fromkeys(HARM_BASE, np.nan)
    start = (len(x)-n)//2
    frame = np.asarray(x[start:start+n], dtype=float)
    frame = (frame-frame.mean()) * np.hanning(n)
    nfft = max(4096, 2**int(np.ceil(np.log2(n))))
    mag = np.abs(np.fft.rfft(frame, n=nfft))
    hz = np.fft.rfftfreq(nfft, 1/sr)
    amps = []
    for k in range(1, 9):
        band = np.abs(hz-k*f0) <= 0.10*f0
        if not band.any() or (k+0.1)*f0 >= sr/2:
            return dict.fromkeys(HARM_BASE, np.nan)
        amps.append(float(mag[band].max()))
    if min(amps[:4]) <= 1e-12:
        return dict.fromkeys(HARM_BASE, np.nan)
    return dict(h1h2_raw=20*np.log10(amps[0]/amps[1]),
                h2h4_raw=20*np.log10(amps[1]/amps[3]),
                richness_raw_db=20*np.log10(sum(amps[1:])/amps[0]))


def stable_runs(f0, times, cfg):
    """Split at unvoiced frames or >20% local pitch jumps; retain >=120 ms."""
    good = np.isfinite(f0) & (f0 > 0)
    jumps = np.zeros(len(f0), dtype=bool)
    for i in range(1, len(f0)):
        if good[i-1] and good[i]:
            jumps[i] = abs(np.log(f0[i]/f0[i-1])) > np.log(1.2)
    start = None
    for i in range(len(f0)+1):
        if start is not None and (i == len(f0) or not good[i] or jumps[i]):
            end = i
            if times[end-1]-times[start]+0.01 >= cfg['min_voiced_run_s']:
                local = f0[start:end]
                if np.std(local)/np.mean(local) <= 0.15:
                    yield max(0., times[start]-0.005), times[end-1]+0.005
            start = None
        if i < len(f0) and good[i] and start is None:
            start = i


def phonation_segment(x, sr, cfg):
    snd = parselmouth.Sound(x, sampling_frequency=sr)
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=cfg['pitch_floor'],
                            pitch_ceiling=cfg['pitch_ceiling'])
    f0 = np.asarray(pitch.selected_array['frequency'], dtype=float)
    times = np.asarray(pitch.xs())
    voiced = np.isfinite(f0) & (f0 > 0)
    out = dict.fromkeys(CORE_BASE + PERT_BASE + HARM_BASE, np.nan)
    out['cpps'] = cpps_value(x, sr, cfg)
    if voiced.any():
        semi = 12*np.log2(f0[voiced]/np.median(f0[voiced]))
        out['f0_spread_st'] = finite_stats(semi)['iqr']
        adjacent = voiced[1:] & voiced[:-1]
        steps = 12*np.abs(np.log2(f0[1:][adjacent]/f0[:-1][adjacent]))
        out['f0_step_st'] = finite_stats(steps)['median']
        hnr = snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=cfg['pitch_floor'])
        hvalues = np.asarray(hnr.values).ravel()
        # Align Harmonicity times to nearest pitch frame, avoiding unvoiced HNR.
        hi = np.clip(np.rint((np.asarray(hnr.xs())-times[0])/pitch.dx).astype(int), 0, len(f0)-1)
        out['hnr'] = finite_stats(hvalues[(hvalues > -199) & voiced[hi]])['median']
    perturb = {k: [] for k in PERT_BASE}
    failures = 0
    for lo, hi in stable_runs(f0, times, cfg):
        section = parselmouth.Sound(x[round(lo*sr):min(len(x), round(hi*sr))], sampling_frequency=sr)
        try:
            points = call(section, 'To PointProcess (periodic, cc)', cfg['pitch_floor'], cfg['pitch_ceiling'])
            if call(points, 'Get number of points') < cfg['min_pulses']:
                continue
            args = (0, 0, 0.8/cfg['pitch_ceiling'], 1.25/cfg['pitch_floor'], 1.3)
            perturb['jitter_local'].append(float(call(points, 'Get jitter (local)', *args)))
            perturb['jitter_rap'].append(float(call(points, 'Get jitter (rap)', *args)))
            perturb['shimmer_local'].append(float(call([section, points], 'Get shimmer (local)', *args, 1.6)))
            perturb['shimmer_apq3'].append(float(call([section, points], 'Get shimmer (apq3)', *args, 1.6)))
        except parselmouth.PraatError:
            failures += 1
    for name, values in perturb.items():
        out[name] = finite_stats(values)['median']
    harmonic_rows = []
    for i in np.flatnonzero(voiced)[::4]:
        half = int(np.ceil(1.5*sr/f0[i])) + 2
        center = round(times[i]*sr)
        if center-half < 0 or center+half > len(x):
            continue
        harmonic_rows.append(harmonic_values(x[center-half:center+half], sr, f0[i]))
    for name in HARM_BASE:
        out[name] = finite_stats([r[name] for r in harmonic_rows])['median']
    valid_f0 = f0[voiced]
    out.update(f0_mean_hz=float(valid_f0.mean()) if len(valid_f0) else np.nan,
               f0_median_hz=float(np.median(valid_f0)) if len(valid_f0) else np.nan,
               f0_std_hz=float(valid_f0.std()) if len(valid_f0) else np.nan,
               voiced_ratio=float(voiced.mean()) if len(voiced) else 0.,
               pitch_frames=len(f0), voiced_frames=int(voiced.sum()),
               harmonic_valid_frames=sum(np.isfinite(r['h1h2_raw']) for r in harmonic_rows))
    out['voiced_fraction'] = out['voiced_ratio']
    out['perturbation_errors'] = failures
    return out


def prediction_segment(x, sr, cfg):
    """Multi-order normalized prediction traces; adaptation, not STLT replication."""
    values = {name: [] for name in RES_BASE}
    length, hop = round(0.05*sr), round(0.025*sr)
    frames = librosa.util.frame(x, frame_length=length, hop_length=hop).T
    energies = np.mean(frames**2, axis=1)
    gate = energies.max()*10**(-cfg['active_db']/10)
    errors = 0
    for raw in frames[energies > max(gate, 1e-12)]:
        frame = (raw-raw.mean())*np.hamming(length)
        for p in (8, 16, 24):
            try:
                a = librosa.lpc(frame.astype(float), order=p)
                residual = lfilter(a, [1.], frame)[p:]
                e = float(np.mean(residual**2))
                original_e = float(np.mean(frame[p:]**2))
                if not np.isfinite(e) or min(e, original_e) <= 1e-14:
                    continue
                st = 10*np.log10(original_e/e)
                r = residual-residual.mean()
                lags = np.arange(int(sr/cfg['pitch_ceiling']), min(int(sr/cfg['pitch_floor']), len(r)//2)+1)
                ac = correlate(r, r, mode='full', method='fft')[len(r)-1:]
                energy_cum = np.r_[0., np.cumsum(r*r)]
                denom = energy_cum[len(r)-lags] * (energy_cum[-1]-energy_cum[lags])
                rho2 = np.clip(ac[lags]**2/np.maximum(denom, 1e-24), 0., 1.-1e-9)
                lt = -10*np.log10(1.-rho2.max())
                kurt = float(np.mean(r**4)/max(np.mean(r*r)**2, 1e-24))
                for suffix, value in [('st_gain_db', st), ('lt_gain_db', lt), ('kurtosis', kurt)]:
                    values[f'lp{p}_{suffix}'].append(value)
            except (FloatingPointError, np.linalg.LinAlgError, librosa.util.exceptions.ParameterError):
                errors += 1
    return {**{k: finite_stats(v)['median'] for k, v in values.items()}, 'prediction_errors': errors}


def spectral_segment(x, sr):
    frames = librosa.util.frame(x, frame_length=400, hop_length=160).T
    power = np.abs(np.fft.rfft(frames*np.hanning(400), n=512, axis=1)).T**2
    hz = np.fft.rfftfreq(512, 1/sr)
    edges = np.linspace(0, sr/2, 42)
    bank = np.array([np.maximum(0, np.minimum((hz-a)/(b-a), (c-hz)/(c-b)))
                     for a, b, c in zip(edges[:-2], edges[1:-1], edges[2:])])
    melbank = librosa.filters.mel(sr=sr, n_fft=512, n_mels=40, fmin=0, fmax=sr/2)
    out = {}
    for kind, filters in [('mfcc', melbank), ('lfcc', bank)]:
        # Exclude c0 to reduce direct energy encoding, keep actual coefficients 1..20.
        cep = dct(np.log(np.maximum(filters@power, 1e-12)), type=2, axis=0, norm='ortho')[1:21]
        delta = librosa.feature.delta(cep, width=9, order=1, mode='nearest')
        for order, matrix in [('static_mean', cep), ('static_std', cep), ('delta_abs', delta)]:
            for i, values in enumerate(matrix, 1):
                value = np.std(values) if order == 'static_std' else np.mean(np.abs(values) if order == 'delta_abs' else values)
                out[f'{kind}_{order}_{i:02d}'] = float(value)
    return out


def select_windows(x, sr, cfg):
    """Energy activity gate, not a learned VAD. Never join disjoint regions."""
    length, hop = round(cfg['window_s']*sr), round(cfg['window_hop_s']*sr)
    if len(x) < length:
        return [], 0.
    frames = librosa.util.frame(x, frame_length=400, hop_length=160).T
    rms = np.sqrt(np.mean(frames**2, axis=1))
    level = np.percentile(rms, 90)*10**(-cfg['active_db']/20)
    active = rms > max(level, 1e-6)
    centers = (np.arange(len(rms))*160+200)/sr
    candidates = []
    for start in range(0, len(x)-length+1, hop):
        inside = (centers >= start/sr) & (centers < (start+length)/sr)
        if inside.any() and active[inside].mean() >= cfg['min_active_fraction']:
            candidates.append(start)
    if len(candidates) > cfg['max_windows']:
        ii = np.linspace(0, len(candidates)-1, cfg['max_windows']).round().astype(int)
        candidates = [candidates[i] for i in ii]
    return candidates, float(active.mean())


def extract_audio_v4(raw, original_sr, cfg):
    x = np.asarray(raw, dtype=float)
    if x.ndim == 2:
        x = x.mean(axis=1)
    if x.size == 0 or not np.isfinite(x).all():
        raise ValueError('Audio kosong/nonfinite')
    original_seconds = len(x)/original_sr
    clip_fraction = float(np.mean(np.abs(x) >= 0.999))
    sr = cfg['sample_rate']
    if original_sr != sr:
        x = librosa.resample(x, orig_sr=original_sr, target_sr=sr)
    if np.max(np.abs(x)) < 1e-6:
        raise ValueError('Audio sepenuhnya sunyi')
    trimmed, edges = librosa.effects.trim(x, top_db=cfg['trim_db'], frame_length=400, hop_length=160)
    trim_fraction = 1.-len(trimmed)/len(x)
    # No center crop: sample up to max_windows across the complete trimmed utterance.
    starts, active_fraction = select_windows(trimmed, sr, cfg)
    out = dict.fromkeys(FEATURE_COLUMNS, np.nan)
    out.update(original_seconds=original_seconds, clip_fraction=clip_fraction,
               trim_fraction=trim_fraction, active_fraction=active_fraction,
               n_windows=len(starts), original_sr=original_sr,
               analysis_status='ok' if starts else 'no_eligible_window',
               window_starts_json=__import__('json').dumps([round(s/sr+edges[0]/sr, 6) for s in starts]))
    segment_rows = []
    n = round(cfg['window_s']*sr)
    for start in starts:
        segment = trimmed[start:start+n].copy()
        # One scale per contiguous window, shared by every feature family.
        segment = (segment-segment.mean())/max(np.sqrt(np.mean(segment**2)), 1e-8)
        row = phonation_segment(segment, sr, cfg)
        if cfg.get('extract_prediction', False):
            row.update(prediction_segment(segment, sr, cfg))
        else:
            row.update({name: np.nan for name in RES_BASE})
            row['prediction_errors'] = 0
        row.update(spectral_segment(segment, sr))
        segment_rows.append(row)
    for name in SEGMENT_COLUMNS:
        values = [r.get(name, np.nan) for r in segment_rows]
        out.update({f'{name}_{stat}': value for stat, value in finite_stats(values).items()})
    for name in F0_BASE + CORE_BASE + PERT_BASE + HARM_BASE + RES_BASE:
        out[f'missing_{name}'] = float(np.mean([not np.isfinite(r.get(name, np.nan)) for r in segment_rows])) if segment_rows else 1.
    out['voiced_fraction'] = finite_stats([r['voiced_fraction'] for r in segment_rows])['median']
    out['perturbation_valid_fraction'] = 1-out['missing_jitter_local']
    out['perturbation_errors'] = sum(r['perturbation_errors'] for r in segment_rows)
    out['prediction_errors'] = sum(r['prediction_errors'] for r in segment_rows)
    for name in ('pitch_frames', 'voiced_frames', 'harmonic_valid_frames'):
        out[name] = sum(r[name] for r in segment_rows)
    out['pitch_valid'] = bool(np.isfinite(out['f0_median_hz_median']))
    return out


# Required groups from docs/panduan_penelitian.md. Residual and CPPS remain additions.
G0_V4 = pooled_columns(F0_BASE)
G1_V4 = pooled_columns(PERT_BASE + ('hnr',))
G2_V4 = pooled_columns(('h1h2_raw', 'richness_raw_db'))
G3_V4 = G0_V4 + G1_V4 + G2_V4
QC_STRICT_V4 = ['original_seconds', 'trim_fraction', 'clip_fraction', 'active_fraction', 'n_windows']
FAMILIES_V4 = {
    'G0_prosody': G0_V4, 'G1_perturb_hnr': G1_V4, 'G2_harmonic': G2_V4,
    'G3_glottal': G3_V4, 'G3_without_prosody': G1_V4 + G2_V4,
    'G3_without_perturb_hnr': G0_V4 + G2_V4, 'G3_without_harmonic': G0_V4 + G1_V4,
    'MFCC': MFCC_V2, 'LFCC': LFCC_V2, 'MFCC_LFCC': MFCC_V2 + LFCC_V2,
    'MFCC_plus_G3': MFCC_V2 + G3_V4, 'LFCC_plus_G3': LFCC_V2 + G3_V4,
    'P_fonation_v3': P_CORE + P_PERT, 'P_plus_H_raw_v3': P_CORE + P_PERT + H_RAW,
    'R_prediction_optional': R_PRED, 'P_plus_R_optional': P_CORE + P_PERT + R_PRED,
    'QC_strict': QC_STRICT_V4, 'Missing_only': MISSING_COLUMNS,
}
RESEARCH_MEDIANS_V4 = [f'{name}_median' for name in F0_BASE + ('jitter_local','shimmer_local','hnr','h1h2_raw','richness_raw_db')]
FEATURE_COLUMNS_V4 = FEATURE_COLUMNS

def self_check_v4(cfg):
    sr = cfg['sample_rate']; t = np.arange(sr * 3) / sr
    x = .25 * (np.sin(2*np.pi*120*t) + .5*np.sin(2*np.pi*240*t) + .25*np.sin(2*np.pi*480*t))
    a = extract_audio_v4(x, sr, cfg); b = extract_audio_v4(x*.5, sr, cfg)
    assert a['pitch_valid'] and abs(a['f0_median_hz_median']-120) < 5
    assert len(G3_V4) == 44 and len(set(G3_V4)) == 44
    assert not set(G3_V4) & set(QC_STRICT_V4 + MISSING_COLUMNS + MFCC_V2 + LFCC_V2)
    assert abs(a['h1h2_raw_median']-20*np.log10(2)) < 1
    assert np.allclose([a[c] for c in G3_V4], [b[c] for c in G3_V4], equal_nan=True, atol=1e-5)
    short = extract_audio_v4(x[:round(sr*.2)], sr, cfg)
    assert short['analysis_status']=='no_eligible_window' and np.isnan(short['f0_median_hz_median'])
    return {'status':'passed','g3_features':len(G3_V4), 'f0_hz':a['f0_median_hz_median']}
