"""Alvin residual features: LPC (order 16) prediction-residual statistics, 15 dims.

Port of the training recipe (skripsi_final / residual_features.py). Keep identical to training.
"""
import librosa
import numpy as np
from scipy.signal import lfilter
from scipy.stats import kurtosis as scipy_kurtosis

BASE_NAMES = ["res_energy", "res_entropy", "res_pred_error", "res_irregularity", "res_kurtosis"]


def residual_feature_names(order: int = 16) -> list:
    return [f"{base}_{stat}_p{order}" for stat in ("mean", "std", "median") for base in BASE_NAMES]


def _shannon_entropy(x: np.ndarray, bins: int = 64) -> float:
    hist, _ = np.histogram(x, bins=bins, density=True)
    p = hist / (hist.sum() + 1e-12)
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def _residual_from_frame(frame: np.ndarray, order: int, min_energy: float):
    frame_win = frame * np.hamming(len(frame))
    if float(np.mean(frame_win ** 2)) < min_energy:
        return None
    a = librosa.lpc(frame_win.astype(float), order=order)
    return lfilter(a, [1.0], frame_win).astype(np.float32)


def residual_feature_vector(x: np.ndarray, order: int = 16, frame_ms: float = 25.0, hop_ms: float = 10.0,
                            sr: int = 16000, min_energy: float = 1e-8) -> np.ndarray:
    frame_len, hop_len = int(sr * frame_ms / 1000), int(sr * hop_ms / 1000)
    frames = librosa.util.frame(x, frame_length=frame_len, hop_length=hop_len).T.copy()
    feats = []
    for frame in frames:
        e = _residual_from_frame(frame, order, min_energy)
        if e is None:
            continue
        sig_energy = float(np.mean(frame ** 2))
        energy = float(np.mean(e ** 2))
        irregularity = float(np.mean(np.abs(np.diff(e)))) / (float(np.std(e)) + 1e-9)
        kurt = float(scipy_kurtosis(e, fisher=False, bias=False))
        feats.append([energy, _shannon_entropy(e), energy / (sig_energy + 1e-9), irregularity, kurt])
    arr = np.asarray(feats, dtype=float)
    if len(arr) == 0:
        return np.full(15, np.nan, dtype=np.float32)
    return np.concatenate([np.nanmean(arr, axis=0), np.nanstd(arr, axis=0), np.nanmedian(arr, axis=0)]).astype(np.float32)
