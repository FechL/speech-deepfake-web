"""
DeepGuard Core Model Engine
Unified inference engine supporting:
  - Model Alvin B4 (XGBoost - 280 features MFCC + LFCC)
  - Model Fawwas (Glottal v8 - fitur glotal G3 + MFCC/LFCC; SVM / RF / XGBoost beku)
"""

import io
import os
import tempfile
import warnings
import zipfile
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

# Suppress harmless third-party warnings
warnings.filterwarnings("ignore", category=UserWarning, module="joblib")
warnings.filterwarnings("ignore", category=DeprecationWarning)

# Silence Loky process warning on Windows
if "LOKY_MAX_CPU_COUNT" not in os.environ:
    os.environ["LOKY_MAX_CPU_COUNT"] = str(os.cpu_count() or 4)

import joblib
import librosa
import numpy as np

from .preprocessing.audio_loading import load_audio
from .preprocessing.alvin import extract_alvin_features
from .preprocessing.fawwas import FawwasGlottal, VARIANTS as FAWWAS_VARIANTS, resolve_variant as resolve_fawwas_variant


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
MODELS_DIR = BASE_DIR / "models"

TARGET_SR = 16_000
ALLOWED_EXTENSIONS = {"wav", "mp3", "m4a", "webm", "ogg", "flac"}

# ─────────────────────────────────────────────────────────────
# Model Alvin Specifications (280 features)
# ─────────────────────────────────────────────────────────────
ALVIN_DIR = BASE_DIR / "checkpoints" / "alvin"
ALVIN_ARCHIVE_CANDIDATES = [
    BASE_DIR / "checkpoints" / "alvin" / "models_checkpoints_alvin.zip",
    MODELS_DIR / "models_checkpoints.zip",
    PROJECT_ROOT / "models_checkpoints.zip",
    PROJECT_ROOT.parent / "Website_lama" / "models_checkpoints.zip",
]
ALVIN_MODEL_FILENAME = "B4_seed42.joblib"

class DeepGuardEngine:
    def __init__(self):
        self.alvin_cache: Dict[str, Dict[str, Any]] = {}
        self.alvin_checkpoint: Optional[Dict[str, Any]] = None
        self.alvin_model: Any = None
        self.alvin_features: list = []
        self.alvin_threshold: float = 0.38
        self.alvin_error: Optional[str] = None

        self.fawwas: Optional[FawwasGlottal] = None
        self.fawwas_error: Optional[str] = None

        self._load_alvin_model()
        self._load_fawwas_model()

    def get_alvin_checkpoint(self, model_id: str = "B4") -> Dict[str, Any]:
        normalized_id = model_id.upper().strip()
        if normalized_id in self.alvin_cache:
            return self.alvin_cache[normalized_id]

        # 1) plain files committed in the repo: backend/checkpoints/alvin/<ID>_seed42.joblib
        loose = ALVIN_DIR / f"{normalized_id}_seed42.joblib"
        if loose.is_file():
            cp = joblib.load(loose)
            self.alvin_cache[normalized_id] = cp
            return cp

        # 2) legacy fallback: zip archive
        archive_path = next((p for p in ALVIN_ARCHIVE_CANDIDATES if p.exists()), None)
        if not archive_path:
            raise RuntimeError(f"Checkpoint Alvin {normalized_id} tidak ditemukan di {ALVIN_DIR}.")

        target_name = f"{normalized_id}_seed42.joblib"
        with zipfile.ZipFile(archive_path) as archive:
            candidates = archive.namelist()
            match = next((c for c in candidates if c.lower() == target_name.lower()), None)
            if not match:
                match = next((c for c in candidates if c.lower().startswith(normalized_id.lower())), None)
            if not match:
                match = ALVIN_MODEL_FILENAME
            model_bytes = archive.read(match)

        cp = joblib.load(io.BytesIO(model_bytes))
        self.alvin_cache[normalized_id] = cp
        return cp

    def _load_alvin_model(self):
        has_loose = (ALVIN_DIR / "B4_seed42.joblib").is_file()
        archive_path = next((p for p in ALVIN_ARCHIVE_CANDIDATES if p.exists()), None)
        if not has_loose and not archive_path:
            self.alvin_error = "Checkpoint Alvin tidak ditemukan di backend/checkpoints/alvin/."
            print(f"[!] Model Alvin: {self.alvin_error}")
            return

        try:
            cp = self.get_alvin_checkpoint("B4")
            required = {"model", "features", "val_threshold", "experiment_id"}
            if not required.issubset(cp.keys()):
                raise ValueError(f"Checkpoint tidak lengkap: {required.difference(cp.keys())}")
            
            self.alvin_checkpoint = cp
            self.alvin_model = cp["model"]
            self.alvin_features = cp["features"]
            self.alvin_threshold = float(cp["val_threshold"])
            self.alvin_error = None
            print(
                f"[*] Model Alvin ({cp['experiment_id']}) siap: "
                f"{len(self.alvin_features)} fitur, threshold={self.alvin_threshold:.4f}"
            )
        except Exception as exc:
            self.alvin_error = str(exc)
            print(f"[!] Model Alvin gagal dimuat: {exc}")

    def _load_fawwas_model(self):
        try:
            fawwas = FawwasGlottal()
        except Exception as exc:
            self.fawwas_error = str(exc)
            print(f"[!] Model Fawwas gagal dimuat: {exc}")
            return
        if fawwas.loaded:
            self.fawwas = fawwas
            self.fawwas_error = None
            print(f"[*] Model Fawwas (Glottal v8, profil {fawwas.run_id}) siap: {len(FAWWAS_VARIANTS)} varian.")
        else:
            self.fawwas_error = fawwas.error
            print(f"[!] Model Fawwas: {fawwas.error}")

    # ─────────────────────────────────────────────────────────────
    # Inference Router
    # ─────────────────────────────────────────────────────────────
    def infer_audio(
        self,
        audio_path: str,
        model_choice: str = "alvin",
        requested_threshold: Optional[float] = None,
        file_name: str = "audio.wav",
        file_size_bytes: int = 0
    ) -> Dict[str, Any]:
        # Shared preprocessing step 1 (see backend/preprocessing/audio_loading.py)
        audio, sample_rate = load_audio(audio_path)

        duration_seconds = float(librosa.get_duration(y=audio, sr=sample_rate))
        minutes = int(duration_seconds // 60)
        seconds = int(duration_seconds % 60)
        duration_str = f"{minutes:02d}:{seconds:02d}"
        file_size_mb = f"{file_size_bytes / (1024 * 1024):.2f} MB" if file_size_bytes else "1.00 MB"

        normalized_choice = str(model_choice).lower().strip()

        if "fawwas" in normalized_choice:
            if self.fawwas is None:
                raise RuntimeError(f"Model Fawwas belum siap. {self.fawwas_error or 'Periksa bundel model Fawwas.'}")

            variant = resolve_fawwas_variant(normalized_choice)
            _, label, _, _ = FAWWAS_VARIANTS[variant]
            result = self.fawwas.score(audio, sample_rate, variant)
            prob_deepfake = result["prob_deepfake"]
            prob_authentic = 1.0 - prob_deepfake
            checkpoint_threshold = result["threshold"]

            threshold_used = requested_threshold if requested_threshold is not None else checkpoint_threshold
            if not 0.05 <= threshold_used <= 0.95:
                threshold_used = checkpoint_threshold

            is_authentic = prob_deepfake < threshold_used
            confidence = prob_authentic if is_authentic else prob_deepfake

            return {
                "status": "success",
                "fileName": file_name,
                "fileSize": file_size_mb,
                "durationSeconds": duration_seconds,
                "duration": duration_str,
                "prediction": 0 if is_authentic else 1,
                "prob_authentic": prob_authentic,
                "prob_deepfake": prob_deepfake,
                "isAuthentic": is_authentic,
                "confidenceScore": confidence,
                "modelName": f"Model Fawwas ({label})",
                "threshold": threshold_used,
                "checkpointThreshold": checkpoint_threshold,
                "engine": f"{result['kind'].upper()} Glottal v8 ({result['n_features']} Fitur)",
            }

        else:
            # Model Alvin
            import pandas as pd

            # Determine which Alvin checkpoint is requested (B4, B0, B1, B2, B3, E4c, etc.)
            alvin_id = "B4"
            for candidate in ["b0", "b1", "b2", "b3", "b4", "e4c", "e4a", "e4b", "e4e"]:
                if candidate in normalized_choice:
                    alvin_id = candidate.upper()
                    break

            try:
                cp = self.get_alvin_checkpoint(alvin_id)
            except Exception:
                cp = self.alvin_checkpoint or self.get_alvin_checkpoint("B4")

            model = cp["model"]
            req_cols = cp["features"]
            eer_threshold = float(cp.get("val_threshold", 0.3793))

            feats = extract_alvin_features(audio, sample_rate)
            missing = [c for c in req_cols if c not in feats]
            if missing:
                raise RuntimeError(f"Fitur model Alvin {alvin_id} tidak tersedia dari preprocessing: {missing[:3]}...")
            input_df = pd.DataFrame([{c: feats[c] for c in req_cols}], columns=req_cols)

            probabilities = model.predict_proba(input_df)[0]
            classes = list(model.classes_)
            deepfake_index = classes.index(1) if 1 in classes else 1
            prob_deepfake = float(probabilities[deepfake_index])
            prob_authentic = 1.0 - prob_deepfake

            threshold_used = requested_threshold if requested_threshold is not None else eer_threshold
            if not 0.05 <= threshold_used <= 0.95:
                threshold_used = eer_threshold

            is_authentic = prob_deepfake < threshold_used
            confidence = prob_authentic if is_authentic else prob_deepfake
            
            exp_id = cp.get("experiment_id", alvin_id)
            mod_type = cp.get("model_type", "xgb")
            alg_display = {
                "xgb": "XGBoost",
                "svm_rbf": "SVM RBF",
                "rf": "Random Forest",
            }.get(mod_type, mod_type.upper())

            return {
                "status": "success",
                "fileName": file_name,
                "fileSize": file_size_mb,
                "durationSeconds": duration_seconds,
                "duration": duration_str,
                "prediction": 0 if is_authentic else 1,
                "prob_authentic": prob_authentic,
                "prob_deepfake": prob_deepfake,
                "isAuthentic": is_authentic,
                "confidenceScore": confidence,
                "modelName": f"Model Alvin {exp_id} ({alg_display})",
                "threshold": threshold_used,
                "checkpointThreshold": eer_threshold,
                "engine": f"{alg_display} ({len(req_cols)} Fitur Spektral)",
            }

    def get_health_status(self) -> Dict[str, Any]:
        return {
            "status": "healthy" if (self.alvin_model or self.fawwas) else "degraded",
            "model_alvin_loaded": self.alvin_model is not None,
            "model_fawwas_loaded": self.fawwas is not None,
            "alvin": {
                "name": f"Model Alvin {self.alvin_checkpoint['experiment_id']}" if self.alvin_checkpoint else "Model Alvin B4",
                "type": self.alvin_checkpoint.get("model_type", "xgb") if self.alvin_checkpoint else "xgb",
                "feature_group": self.alvin_checkpoint.get("feature_group", "mfcc_lfcc") if self.alvin_checkpoint else "mfcc_lfcc",
                "n_features": len(self.alvin_features) or 280,
                "decision_threshold": self.alvin_threshold,
                "error": self.alvin_error,
            },
            "fawwas": {
                "name": "Model Fawwas (Glottal v8)",
                "type": "glottal_v8",
                "feature_group": "glottal_g3",
                "n_features": 44,
                "decision_threshold": self.fawwas.systems[FAWWAS_VARIANTS["glottal_g3"][0]]["threshold"] if self.fawwas else 0.3767,
                "variants": [{"id": k, "label": v[1], "tag": v[2]} for k, v in FAWWAS_VARIANTS.items()],
                "error": self.fawwas_error,
            }
        }


# Singleton instance
engine = DeepGuardEngine()
