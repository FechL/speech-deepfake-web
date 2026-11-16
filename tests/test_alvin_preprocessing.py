"""Alvin preprocessing must follow the training recipe (see backend/preprocessing/alvin/README.md)."""
import sys
from pathlib import Path

import joblib
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.preprocessing.alvin import extract_alvin_features
from backend.preprocessing.alvin.features import (
    lfcc_feature_names, mfcc_feature_names, prepare_audio, segment_audio,
)

CKPT_DIR = ROOT / "backend" / "checkpoints" / "alvin"
SR = 16000


def speechlike(seconds=6.0, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(SR * seconds)) / SR
    f0 = 130 * (1 + 0.03 * np.sin(2 * np.pi * 2 * t))
    x = sum(np.sin(2 * np.pi * f0 * k * t) / k for k in range(1, 8))
    x *= 0.5 * (1 + np.sin(2 * np.pi * 3 * t))
    return (0.2 * x + 0.003 * rng.standard_normal(len(t))).astype(np.float32)


def test_feature_names_and_counts():
    f = extract_alvin_features(speechlike(), SR)
    assert len(mfcc_feature_names()) == 240 and len(lfcc_feature_names()) == 40
    assert len(f) == 240 + 40 + 15 + 7
    assert all(np.isfinite(v) for v in f.values())


def test_every_checkpoint_gets_all_its_columns():
    f = extract_alvin_features(speechlike(), SR)
    files = sorted(CKPT_DIR.glob("*_seed42.joblib"))
    assert len(files) == 10, "all 10 Alvin checkpoints must be committed as plain files"
    for path in files:
        cp = joblib.load(path)
        assert set(cp["features"]) <= set(f), path.name


def test_peak_normalisation_makes_features_scale_invariant():
    x = speechlike()
    a, b = extract_alvin_features(x, SR), extract_alvin_features(x * 0.25, SR)
    for k in ("mfcc_mean_01", "lfcc_mean_03", "mod_band_2_4", "res_energy_mean_p16"):
        assert a[k] == pytest.approx(b[k], rel=1e-3, abs=1e-5)


def test_segmentation_two_second_no_overlap_and_tail_dropped():
    x = np.zeros(int(SR * 7.5), dtype=np.float32)
    assert len(segment_audio(x)) == 3 and all(len(s) == 2 * SR for s in segment_audio(x))
    assert len(segment_audio(np.zeros(SR, dtype=np.float32))) == 1  # padded


def test_minimum_duration_is_one_second():
    with pytest.raises(ValueError):
        prepare_audio(np.ones(int(SR * 0.8), dtype=np.float32) * 0.1, SR)


def test_lfcc_uses_forty_filters_recipe():
    # training LFCC: 40 triangular filters, edges linspace(0, 8000, 42)
    from backend.preprocessing.alvin import features as F
    assert F.LFCC_FILTERS == 40 and F.LFCC_FMAX == 8000.0 and F.WIN == 400
