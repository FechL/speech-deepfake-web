"""Model Fawwas: frozen glottal v8 models (pipeline forensic_reference_glottal_v8, LA + ADDITIONAL).

Loads models from backend/checkpoints/fawwas/fawwas_glottal_v8_bundle.zip and scores audio
with the feature extractor the models were trained with (glottal_features.extract_audio_v4).
"""
import io
import json
import os
import zipfile
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd

from . import glottal_features as gf

BUNDLE = Path(__file__).resolve().parents[2] / "checkpoints" / "fawwas" / "fawwas_glottal_v8_bundle.zip"
SEED = int(os.environ.get("DEEPGUARD_FAWWAS_SEED", "2026"))
MAX_SECONDS = 60.0  # same centre crop used for the ADDITIONAL training audio

# web id -> (frozen system key, label, tag, description)
VARIANTS = {
    "glottal_g3": ("G3_glottal@svm_rbf", "Glottal G3 · SVM", "Model Utama",
                   "44 fitur glotal (prosodi, perturbasi/HNR, harmonik) dengan SVM RBF."),
    "glottal_g3_rf": ("G3_glottal@rf", "Glottal G3 · Random Forest", "Glotal RF",
                      "44 fitur glotal dengan Random Forest."),
    "glottal_g3_xgb": ("G3_glottal@xgb", "Glottal G3 · XGBoost", "Glotal XGB",
                       "44 fitur glotal dengan XGBoost."),
    "glottal_mfcc_g3": ("MFCC_plus_G3@xgb", "MFCC + Glottal G3 · XGBoost", "Fusi MFCC & Glotal",
                        "Fusi MFCC 240 + glotal G3 44 fitur dengan XGBoost."),
    "glottal_lfcc_g3": ("LFCC_plus_G3@xgb", "LFCC + Glottal G3 · XGBoost", "Fusi LFCC & Glotal",
                        "Fusi LFCC 240 + glotal G3 44 fitur dengan XGBoost."),
}
DEFAULT_VARIANT = "glottal_g3"


def resolve_variant(model_choice: str) -> str:
    """Map a request id such as 'fawwas_glottal_g3_rf' to a known variant id (longest match)."""
    text = str(model_choice).lower().strip()
    for vid in sorted(VARIANTS, key=len, reverse=True):
        if vid in text:
            return vid
    return DEFAULT_VARIANT


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
        if not BUNDLE.is_file():
            self.error = f"Bundel model Fawwas tidak ditemukan: {BUNDLE.name}"
            return
        try:
            with zipfile.ZipFile(BUNDLE) as z:
                self.cfg = json.loads(z.read("config/features_config.json"))
                self.run_id = json.loads(z.read("config/run_identity.json")).get("settings", {}).get("profile", "")
                blob = z.read(f"models/seed_{SEED}/models_frozen_v8.joblib")
            self.systems = joblib.load(io.BytesIO(blob))
            missing = [v[0] for v in VARIANTS.values() if v[0] not in self.systems]
            if missing:
                raise KeyError(f"Sistem tidak ada dalam bundel: {missing}")
            self.error = None
        except Exception as exc:  # noqa: BLE001
            self.systems = {}
            self.error = str(exc)

    def score(self, audio: np.ndarray, sample_rate: int, variant: str) -> Dict[str, Any]:
        key = VARIANTS[variant][0]
        spec = self.systems[key]
        x = np.asarray(audio, dtype=float)
        max_n = int(MAX_SECONDS * sample_rate)
        if len(x) > max_n:
            start = (len(x) - max_n) // 2
            x = x[start:start + max_n]
        feats = gf.extract_audio_v4(x, sample_rate, self.cfg)
        if feats.get("analysis_status") != "ok":
            raise ValueError(
                "Audio tidak memiliki jendela suara yang layak (butuh ucapan/suara aktif minimal ±2 detik)."
            )
        row = pd.DataFrame([{c: feats.get(c, np.nan) for c in spec["cols"]}], columns=spec["cols"])
        proba = spec["model"].predict_proba(row)[0]
        classes = list(spec["model"].classes_)
        p_fake = float(proba[classes.index(1)])
        return {
            "prob_deepfake": p_fake,
            "threshold": float(spec["threshold"]),
            "system": key,
            "experiment_id": spec.get("experiment_id", key),
            "n_features": len(spec["cols"]),
            "kind": spec.get("kind", ""),
            "pitch_valid": bool(feats.get("pitch_valid", False)),
        }
