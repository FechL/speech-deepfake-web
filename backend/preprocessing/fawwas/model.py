"""Fawwas whole-utterance v9 model loader and scorer."""

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd

from . import features_v9 as gf

MODEL_DIR = Path(__file__).resolve().parents[2] / "checkpoints" / "fawwas" / "glottal_v9"
SEED = int(os.environ.get("DEEPGUARD_FAWWAS_SEED", "2026"))
MAX_SECONDS = 60.0

VARIANTS = {
    "glottal_g3": ("glottal_g3", "Glottal G3 · Logistic Regression", "Glottal LR", "Whole-utterance glottal G3, v9."),
    "glottal_g3_svm": ("glottal_g3_svm", "Glottal G3 · SVM", "Glottal SVM", "Whole-utterance glottal G3, v9."),
    "glottal_g3_rf": ("glottal_g3_rf", "Glottal G3 · Random Forest", "Glottal RF", "Whole-utterance glottal G3, v9."),
    "glottal_g3_hgb": ("glottal_g3_hgb", "Glottal G3 · HistGradientBoosting", "Glottal HGB", "Whole-utterance glottal G3, v9."),
    "glottal_lfcc_g3": ("glottal_lfcc_g3", "LFCC + Glottal G3 · Logistic Regression", "LFCC + G3", "Whole-utterance LFCC and glottal G3, v9."),
}
DEFAULT_VARIANT = "glottal_g3"


def resolve_variant(model_choice: str) -> str:
    choice = str(model_choice).lower().strip()
    for variant in sorted(VARIANTS, key=len, reverse=True):
        if choice == variant or choice == f"fawwas_{variant}":
            return variant
    return DEFAULT_VARIANT


def _score(model, frame, kind):
    if kind in {"lr", "svm_rbf"}:
        return float(model.decision_function(frame)[0])
    return float(model.predict_proba(frame)[0, 1])


class FawwasGlottal:
    def __init__(self):
        self.systems: Dict[str, Any] = {}
        self.cfg: Optional[dict] = None
        self.run_id = ""
        self.error: Optional[str] = None
        self._load()

    @property
    def loaded(self) -> bool:
        return bool(self.systems)

    def _load(self):
        model_path = MODEL_DIR / f"seed_{SEED}.joblib"
        metadata_path = MODEL_DIR / f"seed_{SEED}.json"
        try:
            metadata = json.loads(metadata_path.read_text())
            if metadata.get("schema") != 9:
                raise ValueError("Invalid Fawwas v9 checkpoint schema")
            if hashlib.sha256(model_path.read_bytes()).hexdigest() != metadata["model_sha256"]:
                raise ValueError("Fawwas v9 checkpoint checksum mismatch")
            self.systems = joblib.load(model_path)
            self.cfg = metadata["features"]
            self.run_id = metadata["run_id"]
            missing = [key for key, *_ in VARIANTS.values() if key not in self.systems]
            if missing:
                raise KeyError(f"Fawwas v9 systems missing: {missing}")
        except Exception as exc:  # noqa: BLE001
            self.systems = {}
            self.error = str(exc)

    def extract(self, audio: np.ndarray, sample_rate: int) -> Dict[str, Any]:
        x = np.asarray(audio, dtype=float)
        max_n = int(MAX_SECONDS * sample_rate)
        if len(x) > max_n:
            start = (len(x) - max_n) // 2
            x = x[start:start + max_n]
        features = gf.extract_audio_v9(x, sample_rate, self.cfg)
        if features["analysis_status"] == "too_short":
            raise ValueError("Audio is too short for Fawwas v9 analysis (minimum 0.3 s).")
        return features

    def score_features(self, features: Dict[str, Any], variant: str) -> Dict[str, Any]:
        key = VARIANTS[variant][0]
        spec = self.systems[key]
        frame = pd.DataFrame([{col: features.get(col, np.nan) for col in spec["cols"]}], columns=spec["cols"])
        raw = _score(spec["model"], frame, spec["kind"])
        scale = max(float(spec["score_scale"]), 1e-8)
        z = np.clip((raw - spec["raw_threshold"]) / scale, -40, 40)
        score = float(1.0 / (1.0 + np.exp(-z)))
        return dict(prob_deepfake=score, threshold=0.5, system=key,
                    experiment_id=f"v9/{self.run_id}/{key}", n_features=len(spec["cols"]),
                    kind=spec["kind"], pitch_valid=bool(features.get("f0_valid", False)))

    def score(self, audio: np.ndarray, sample_rate: int, variant: str) -> Dict[str, Any]:
        return self.score_features(self.extract(audio, sample_rate), variant)
