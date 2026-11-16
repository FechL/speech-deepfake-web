"""Alvin modulation features: amplitude-envelope modulation spectrum (0-20 Hz), 7 dims.

Port of the training recipe (skripsi_final / modulation_features.py). Keep identical to training.
"""
from math import gcd

import numpy as np
from scipy.signal import butter, hilbert, resample_poly, sosfiltfilt
from scipy.stats import entropy as scipy_entropy

NAMES = ["mod_band_0.5_2", "mod_band_2_4", "mod_band_4_8", "mod_band_8_20", "mod_centroid", "mod_entropy", "mod_depth"]
BANDS = [(0.5, 2.0), (2.0, 4.0), (4.0, 8.0), (8.0, 20.0)]


def modulation_feature_names() -> list:
    return list(NAMES)


def modulation_features(x: np.ndarray, sr: int = 16000, envelope_sr: int = 100,
                        lowpass_hz: float = 40.0, max_hz: float = 20.0) -> np.ndarray:
    env_full = np.abs(hilbert(x.astype(np.float64)))
    sos = butter(4, lowpass_hz, btype="lowpass", fs=sr, output="sos")
    env = sosfiltfilt(sos, env_full)
    g = gcd(envelope_sr, sr)
    env = resample_poly(env, up=envelope_sr // g, down=sr // g)
    env = env - env.mean()
    spec = np.abs(np.fft.rfft(env * np.hanning(len(env)))) ** 2
    freq = np.fft.rfftfreq(len(env), d=1.0 / envelope_sr)
    keep = (freq > 0) & (freq <= max_hz)
    freq, spec = freq[keep], spec[keep]
    if spec.sum() < 1e-20:
        return np.full(len(BANDS) + 3, np.nan, dtype=np.float32)
    p = spec / (spec.sum() + 1e-12)
    bands = [float(spec[(freq >= lo) & (freq < hi)].sum() / (spec.sum() + 1e-12)) for lo, hi in BANDS]
    centroid = float((freq * p).sum())
    mod_entropy = float(scipy_entropy(p + 1e-12))
    mod_depth = float(np.std(env_full) / (np.mean(np.abs(env_full)) + 1e-9))
    return np.asarray(bands + [centroid, mod_entropy, mod_depth], dtype=np.float32)
