"""
DeepGuard Core Model Engine
Unified inference engine supporting:
  - Model Alvin B4 (XGBoost - 280 features MFCC + LFCC)
  - Model Fawwas (KNN Forensik - 204 features MFCC, LFCC, ZCR, RMS, Delta MFCC)
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
from scipy.fftpack import dct


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
MODELS_DIR = BASE_DIR / "models"

TARGET_SR = 16_000
ALLOWED_EXTENSIONS = {"wav", "mp3", "m4a", "webm", "ogg", "flac"}

# ─────────────────────────────────────────────────────────────
# Model Alvin Specifications (280 features)
# ─────────────────────────────────────────────────────────────
ALVIN_ARCHIVE_CANDIDATES = [
    BASE_DIR / "checkpoints" / "alvin" / "models_checkpoints_alvin.zip",
    MODELS_DIR / "models_checkpoints.zip",
    PROJECT_ROOT / "models_checkpoints.zip",
    PROJECT_ROOT.parent / "Website_lama" / "models_checkpoints.zip",
]
ALVIN_MODEL_FILENAME = "B4_seed42.joblib"
ALVIN_N_COEFFS = 20
ALVIN_N_FFT = 512
ALVIN_HOP_LENGTH = 160

# ─────────────────────────────────────────────────────────────
# Model Fawwas Specifications (204 features)
# ─────────────────────────────────────────────────────────────
FAWWAS_MODEL_CANDIDATES = [
    MODELS_DIR / "rerec_KNN_N=5.pkl",
    BASE_DIR / "rerec_KNN_N=5.pkl",
    PROJECT_ROOT.parent / "Website_lama" / "backend" / "rerec_KNN_N=5.pkl",
]
FAWWAS_SCALER_CANDIDATES = [
    MODELS_DIR / "knn_rerec_scaler.joblib",
    BASE_DIR / "knn_rerec_scaler.joblib",
    PROJECT_ROOT.parent / "Website_lama" / "backend" / "knn_rerec_scaler.joblib",
]
FAWWAS_TARGET_LEN = 48_000  # 3 seconds @ 16kHz
FAWWAS_N_MFCC = 40
FAWWAS_N_LFCC = 40
FAWWAS_N_FFT = 512
FAWWAS_HOP = 160


class DeepGuardEngine:
    def __init__(self):
        self.alvin_cache: Dict[str, Dict[str, Any]] = {}
        self.alvin_checkpoint: Optional[Dict[str, Any]] = None
        self.alvin_model: Any = None
        self.alvin_features: list = []
        self.alvin_threshold: float = 0.38
        self.alvin_error: Optional[str] = None

        self.fawwas_model: Any = None
        self.fawwas_scaler: Any = None
        self.fawwas_error: Optional[str] = None

        self._load_alvin_model()
        self._load_fawwas_model()

    def get_alvin_checkpoint(self, model_id: str = "B4") -> Dict[str, Any]:
        normalized_id = model_id.upper().strip()
        if normalized_id in self.alvin_cache:
            return self.alvin_cache[normalized_id]

        archive_path = next((p for p in ALVIN_ARCHIVE_CANDIDATES if p.exists()), None)
        if not archive_path:
            raise RuntimeError("Arsip checkpoint Alvin tidak ditemukan. Letakkan models_checkpoints_alvin.zip di backend/checkpoints/alvin/.")

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
        archive_path = next((p for p in ALVIN_ARCHIVE_CANDIDATES if p.exists()), None)
        if not archive_path:
            self.alvin_error = "Arsip checkpoint Alvin tidak ditemukan. Letakkan models_checkpoints_alvin.zip di backend/checkpoints/alvin/."
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
        model_path = next((p for p in FAWWAS_MODEL_CANDIDATES if p.exists()), None)
        scaler_path = next((p for p in FAWWAS_SCALER_CANDIDATES if p.exists()), None)

        if not model_path or not scaler_path:
            self.fawwas_error = "File model rerec_KNN_N=5.pkl atau scaler tidak ditemukan."
            print(f"[!] Model Fawwas: {self.fawwas_error}")
            return

        try:
            self.fawwas_model = joblib.load(model_path)
            self.fawwas_scaler = joblib.load(scaler_path)
            self.fawwas_error = None
            print(
                f"[*] Model Fawwas (KNN Forensik) siap: "
                f"n_neighbors={getattr(self.fawwas_model, 'n_neighbors', 5)}, "
                f"{self.fawwas_model.n_features_in_} fitur."
            )
        except Exception as exc:
            self.fawwas_error = str(exc)
            print(f"[!] Model Fawwas gagal dimuat: {exc}")

    # ─────────────────────────────────────────────────────────────
    # Alvin Feature Extraction Helpers (280 features)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def _alvin_aggregate(matrix: np.ndarray) -> np.ndarray:
        return np.concatenate([
            np.mean(matrix, axis=1),
            np.std(matrix, axis=1),
            np.percentile(matrix, 25, axis=1),
            np.percentile(matrix, 75, axis=1),
        ])

    @staticmethod
    def _alvin_linear_filterbank(sr: int, n_fft: int, n_filters: int = ALVIN_N_COEFFS) -> np.ndarray:
        frequencies = np.linspace(0, sr / 2, n_filters + 2)
        bins = np.floor((n_fft + 1) * frequencies / sr).astype(int)
        filters = np.zeros((n_filters, n_fft // 2 + 1))
        for index in range(n_filters):
            left, center, right = bins[index : index + 3]
            if center > left:
                filters[index, left:center] = (np.arange(left, center) - left) / (center - left)
            if right > center:
                filters[index, center:right] = (right - np.arange(center, right)) / (right - center)
        return filters

    def extract_alvin_features(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        if audio.ndim > 1:
            audio = librosa.to_mono(audio)
        if sample_rate != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=TARGET_SR)
            sample_rate = TARGET_SR
        if audio.size < int(0.25 * sample_rate):
            raise ValueError("Durasi audio minimal 0,25 detik.")
        if not np.isfinite(audio).all():
            raise ValueError("Audio mengandung sampel yang tidak valid.")

        audio = audio[: sample_rate * 300]
        mfcc = librosa.feature.mfcc(
            y=audio,
            sr=sample_rate,
            n_mfcc=ALVIN_N_COEFFS,
            n_fft=ALVIN_N_FFT,
            hop_length=ALVIN_HOP_LENGTH,
        )
        delta_width = min(9, mfcc.shape[1] if mfcc.shape[1] % 2 else mfcc.shape[1] - 1)
        if delta_width < 3:
            raise ValueError("Audio terlalu pendek untuk ekstraksi fitur Alvin.")
        mfcc_delta = librosa.feature.delta(mfcc, width=delta_width)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2, width=delta_width)

        spectrum = np.abs(librosa.stft(audio, n_fft=ALVIN_N_FFT, hop_length=ALVIN_HOP_LENGTH)) ** 2
        energies = self._alvin_linear_filterbank(sample_rate, ALVIN_N_FFT) @ spectrum
        log_energies = np.log(np.maximum(energies, np.finfo(float).eps))
        lfcc = dct(log_energies, type=2, axis=0, norm="ortho")[:ALVIN_N_COEFFS]

        features = np.concatenate([
            self._alvin_aggregate(mfcc),
            self._alvin_aggregate(mfcc_delta),
            self._alvin_aggregate(mfcc_delta2),
            np.mean(lfcc, axis=1),
            np.std(lfcc, axis=1),
        ]).astype(np.float64)

        if features.size != len(self.alvin_features):
            raise ValueError(
                f"Jumlah fitur tidak cocok: {features.size}, seharusnya {len(self.alvin_features)}."
            )
        if not np.isfinite(features).all():
            raise ValueError("Ekstraksi menghasilkan fitur yang tidak valid.")
        return features.reshape(1, -1)

    # ─────────────────────────────────────────────────────────────
    # Fawwas Feature Extraction Helpers (204 features)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def _fawwas_linear_filterbank(sr: int, n_fft: int, n_filters: int = FAWWAS_N_LFCC) -> np.ndarray:
        hz_points = np.linspace(0.0, sr / 2.0, n_filters + 2)
        bin_points = np.floor((n_fft + 1) * hz_points / sr).astype(int)
        filters = np.zeros((n_filters, n_fft // 2 + 1))
        for i in range(n_filters):
            left, center, right = bin_points[i], bin_points[i + 1], bin_points[i + 2]
            if center > left:
                filters[i, left:center] = (np.arange(left, center) - left) / (center - left)
            if right > center:
                filters[i, center:right] = (right - np.arange(center, right)) / (right - center)
        return filters

    def extract_fawwas_features(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        if audio.ndim > 1:
            audio = librosa.to_mono(audio)
        if sample_rate != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=TARGET_SR)
            sample_rate = TARGET_SR

        if len(audio) > FAWWAS_TARGET_LEN:
            y = audio[:FAWWAS_TARGET_LEN]
        else:
            y = np.pad(audio, (0, FAWWAS_TARGET_LEN - len(audio)))

        # 1. MFCC 40 (mean 40 + std 40 = 80)
        mfcc = librosa.feature.mfcc(y=y, sr=sample_rate, n_mfcc=FAWWAS_N_MFCC)
        mfcc_mean = np.mean(mfcc, axis=1)
        mfcc_std = np.std(mfcc, axis=1)

        # 2. LFCC 40 (mean 40 + std 40 = 80)
        D = librosa.stft(y, n_fft=FAWWAS_N_FFT, hop_length=FAWWAS_HOP)
        power_spec = np.abs(D) ** 2
        lf_matrix = self._fawwas_linear_filterbank(sr=sample_rate, n_fft=FAWWAS_N_FFT, n_filters=FAWWAS_N_LFCC)
        lf_energies = np.dot(lf_matrix, power_spec)
        log_lf = librosa.power_to_db(lf_energies)
        lfcc = dct(log_lf, type=2, axis=0, norm="ortho")[:FAWWAS_N_LFCC]
        lfcc_mean = np.mean(lfcc, axis=1)
        lfcc_std = np.std(lfcc, axis=1)

        # 3. ZCR (mean 1 + std 1 = 2)
        zcr = librosa.feature.zero_crossing_rate(y)
        zcr_mean = np.mean(zcr)
        zcr_std = np.std(zcr)

        # 4. RMS (mean 1 + std 1 = 2)
        rms = librosa.feature.rms(y=y)
        rms_mean = np.mean(rms)
        rms_std = np.std(rms)

        # 5. Delta MFCC (mean 40)
        delta_mfcc = librosa.feature.delta(mfcc)
        delta_mfcc_mean = np.mean(delta_mfcc, axis=1)

        raw_features = np.concatenate([
            mfcc_mean,
            mfcc_std,
            lfcc_mean,
            lfcc_std,
            [zcr_mean, zcr_std],
            [rms_mean, rms_std],
            delta_mfcc_mean,
        ]).astype(np.float64)

        if self.fawwas_scaler is not None:
            scaled = self.fawwas_scaler.transform(raw_features.reshape(1, -1))
        else:
            scaled = ((raw_features - raw_features.mean()) / (raw_features.std() + 1e-8)).reshape(1, -1)

        return scaled

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
        # Robust audio loading with multiple fallbacks
        try:
            audio, sample_rate = librosa.load(audio_path, sr=None, mono=True)
        except Exception as load_err:
            try:
                import soundfile as sf
                audio, sample_rate = sf.read(audio_path)
                if audio.ndim > 1:
                    audio = np.mean(audio, axis=1)
                audio = audio.astype(np.float32)
            except Exception:
                try:
                    from scipy.io import wavfile
                    sample_rate, audio = wavfile.read(audio_path)
                    if audio.ndim > 1:
                        audio = np.mean(audio, axis=1)
                    if audio.dtype == np.int16:
                        audio = audio.astype(np.float32) / 32768.0
                    else:
                        audio = audio.astype(np.float32)
                except Exception:
                    raise ValueError(
                        f"Format audio tidak dapat dibaca: {load_err}. "
                        "Pastikan berkas adalah audio yang valid (WAV, MP3, M4A, OGG) dan durasi minimal 1 detik."
                    )

        if audio is None or len(audio) < int(0.25 * sample_rate):
            raise ValueError("Durasi audio terlalu singkat. Diperlukan rekaman minimal 0.5–1 detik.")

        duration_seconds = float(librosa.get_duration(y=audio, sr=sample_rate))
        minutes = int(duration_seconds // 60)
        seconds = int(duration_seconds % 60)
        duration_str = f"{minutes:02d}:{seconds:02d}"
        file_size_mb = f"{file_size_bytes / (1024 * 1024):.2f} MB" if file_size_bytes else "1.00 MB"

        normalized_choice = str(model_choice).lower().strip()

        if "fawwas" in normalized_choice:
            if self.fawwas_model is None:
                raise RuntimeError(
                    f"Model Fawwas belum siap. {self.fawwas_error or 'Periksa file model KNN.'}"
                )

            # Determine KNN neighbors count if specified
            n_neighbors = 5
            knn_tag = "N=5"
            if "knn_3" in normalized_choice or "n=3" in normalized_choice:
                n_neighbors = 3
                knn_tag = "N=3 (Sensitif)"
            elif "knn_7" in normalized_choice or "n=7" in normalized_choice:
                n_neighbors = 7
                knn_tag = "N=7 (Konservatif)"

            if hasattr(self.fawwas_model, "n_neighbors"):
                self.fawwas_model.n_neighbors = n_neighbors

            features = self.extract_fawwas_features(audio, sample_rate)
            probabilities = self.fawwas_model.predict_proba(features)[0]
            prob_authentic = float(probabilities[0])
            prob_deepfake = float(probabilities[1])

            threshold_used = requested_threshold if requested_threshold is not None else 0.50
            if not 0.05 <= threshold_used <= 0.95:
                threshold_used = 0.50

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
                "modelName": f"Model Fawwas (KNN {knn_tag})",
                "threshold": threshold_used,
                "checkpointThreshold": 0.50,
                "engine": f"KNN Forensik ({knn_tag} · 204 Fitur Akustik)",
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

            features_raw = self.extract_alvin_features(audio, sample_rate)
            
            # Check if features match Alvin's spectral family
            if set(req_cols).issubset(set(self.alvin_features)):
                df_all = pd.DataFrame(features_raw, columns=self.alvin_features)
                input_df = df_all[req_cols]
            else:
                input_df = features_raw[:, :len(req_cols)]

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
            "status": "healthy" if (self.alvin_model or self.fawwas_model) else "degraded",
            "model_alvin_loaded": self.alvin_model is not None,
            "model_fawwas_loaded": self.fawwas_model is not None,
            "alvin": {
                "name": f"Model Alvin {self.alvin_checkpoint['experiment_id']}" if self.alvin_checkpoint else "Model Alvin B4",
                "type": self.alvin_checkpoint.get("model_type", "xgb") if self.alvin_checkpoint else "xgb",
                "feature_group": self.alvin_checkpoint.get("feature_group", "mfcc_lfcc") if self.alvin_checkpoint else "mfcc_lfcc",
                "n_features": len(self.alvin_features) or 280,
                "decision_threshold": self.alvin_threshold,
                "error": self.alvin_error,
            },
            "fawwas": {
                "name": "Model Fawwas (KNN Forensik)",
                "type": "knn",
                "feature_group": "acoustic_rerec",
                "n_features": self.fawwas_model.n_features_in_ if self.fawwas_model else 204,
                "decision_threshold": 0.50,
                "error": self.fawwas_error,
            }
        }


# Singleton instance
engine = DeepGuardEngine()
