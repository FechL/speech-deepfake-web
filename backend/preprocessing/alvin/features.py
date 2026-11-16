"""Alvin preprocessing: waveform -> named feature dict, identical to how the Alvin checkpoints were trained.

Recipe (skripsi_final/skripsi_residual_modulasi, configs/baseline.yaml):
  16 kHz mono -> reject < 1 s -> peak normalise -> 2 s non-overlapping segments (hop 2 s)
  -> per segment MFCC(240) + LFCC(40) + LPC-residual(15) + modulation(7) -> nan-mean over segments.
Every model picks its own columns by name from the returned dict (see README.md).
"""
import librosa
import numpy as np
from scipy.fft import dct
from scipy.signal import stft

from .modulation_features import modulation_feature_names, modulation_features
from .residual_features import residual_feature_names, residual_feature_vector

TARGET_SR = 16_000
SEGMENT_SECONDS = 2.0
HOP_SECONDS = 2.0
MIN_SECONDS = 1.0
N_MFCC, N_FFT, HOP, WIN = 20, 512, 160, 400
N_LFCC, LFCC_FILTERS, LFCC_FMAX = 20, 40, 8000.0
LPC_ORDER = 16


def mfcc_feature_names() -> list:
    return [f"{p}_{s}_{i:02d}" for p in ("mfcc", "mfcc_d1", "mfcc_d2") for s in ("mean", "std", "q25", "q75") for i in range(N_MFCC)]


def lfcc_feature_names() -> list:
    return [f"lfcc_{s}_{i:02d}" for s in ("mean", "std") for i in range(N_LFCC)]


def _summarize(mat: np.ndarray) -> np.ndarray:
    return np.concatenate([mat.mean(axis=1), mat.std(axis=1), np.percentile(mat, 25, axis=1), np.percentile(mat, 75, axis=1)])


def _mfcc(seg: np.ndarray) -> np.ndarray:
    m = librosa.feature.mfcc(y=seg, sr=TARGET_SR, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP, win_length=WIN)
    return np.concatenate([_summarize(m), _summarize(librosa.feature.delta(m)), _summarize(librosa.feature.delta(m, order=2))])


def _lfcc(seg: np.ndarray) -> np.ndarray:
    freqs, _, z = stft(seg.astype(np.float64), fs=TARGET_SR, nperseg=WIN, noverlap=WIN - HOP, nfft=N_FFT)
    power = np.abs(z) ** 2
    edges = np.linspace(0, LFCC_FMAX, LFCC_FILTERS + 2)
    bank = []
    for i in range(LFCC_FILTERS):
        left, center, right = edges[i], edges[i + 1], edges[i + 2]
        w = np.maximum(0.0, np.minimum((freqs - left) / (center - left + 1e-9), (right - freqs) / (right - center + 1e-9)))
        bank.append(np.sum(power * w[:, None], axis=0))
    cep = dct(np.log(np.asarray(bank, dtype=np.float32) + 1e-8), type=2, axis=0, norm="ortho")[:N_LFCC]
    return np.concatenate([cep.mean(axis=1), cep.std(axis=1)])


def prepare_audio(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Mono, 16 kHz, validated, peak-normalised (training audio_io.load_audio)."""
    if audio.ndim > 1:
        audio = librosa.to_mono(audio)
    if sample_rate != TARGET_SR:
        audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=TARGET_SR)
    if not np.isfinite(audio).all():
        raise ValueError("Audio mengandung sampel yang tidak valid.")
    if len(audio) < int(TARGET_SR * MIN_SECONDS):
        raise ValueError("Durasi audio minimal 1 detik untuk model Alvin.")
    peak = max(float(np.max(np.abs(audio))), 1e-6)
    return (audio / peak).astype(np.float32)


def segment_audio(x: np.ndarray) -> list:
    """2 s non-overlapping segments; remainder shorter than 2 s is dropped."""
    n, hop = int(TARGET_SR * SEGMENT_SECONDS), int(TARGET_SR * HOP_SECONDS)
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    return [x[s:s + n].copy() for s in range(0, len(x) - n + 1, hop)]


def _mean_over_segments(fn, segments, size: int) -> np.ndarray:
    vecs = []
    for seg in segments:
        try:
            vecs.append(fn(seg))
        except Exception:
            pass
    return np.nanmean(vecs, axis=0) if vecs else np.full(size, np.nan)


def extract_alvin_features(audio: np.ndarray, sample_rate: int) -> dict:
    """Return {feature_name: float} for all 302 Alvin features (mfcc 240, lfcc 40, residual 15, modulation 7)."""
    segments = segment_audio(prepare_audio(audio, sample_rate))
    groups = [
        (mfcc_feature_names(), _mean_over_segments(_mfcc, segments, 240)),
        (lfcc_feature_names(), _mean_over_segments(_lfcc, segments, 40)),
        (residual_feature_names(LPC_ORDER), _mean_over_segments(lambda s: residual_feature_vector(s, order=LPC_ORDER), segments, 15)),
        (modulation_feature_names(), _mean_over_segments(modulation_features, segments, 7)),
    ]
    feats = {}
    for names, values in groups:
        feats.update({n: float(v) for n, v in zip(names, values)})
    return feats
