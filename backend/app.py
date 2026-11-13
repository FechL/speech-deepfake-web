"""
DeepGuard Audio Forensic Verification API
Integrates:
  - Model Alvin B4 (XGBoost baseline - 280 features)
  - Model Fawwas (KNN Forensik - 204 features)
Serves the approved DeepGuard Cyberpunk/Glassmorphism Web UI from dist/.
"""

import os
import sys
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DIST_DIR = PROJECT_ROOT / "dist"

sys.path.insert(0, str(PROJECT_ROOT))
from backend.deepguard_engine import engine, ALLOWED_EXTENSIONS

app = FastAPI(
    title="DeepGuard AI - Forensic Voice Verification API",
    version="2.0.0",
    description="Dual-model deepfake and audio forensic verification system (Model Alvin & Model Fawwas)"
)

# CORS configuration
origins_env = os.getenv("DEEPGUARD_ORIGINS", "")
custom_origins = [x.strip() for x in origins_env.split(",") if x.strip()]
default_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5001",
    "http://localhost:5001",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
origins = list(set(default_origins + custom_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MAX_BYTES = 25 * 1024 * 1024  # 25 MB


@app.get("/health")
@app.get("/api/health")
def health_endpoint():
    status = engine.get_health_status()
    # Format compatible with both legacy clients and new dashboard
    return {
        **status,
        "model_loaded": status["model_alvin_loaded"] or status["model_fawwas_loaded"],
        "model_name": status["alvin"]["name"],
        "decision_threshold": status["alvin"]["decision_threshold"],
        "fawwas_available": status["model_fawwas_loaded"],
        "available_models": [
            {
                "id": "alvin",
                "name": status["alvin"]["name"],
                "type": status["alvin"]["type"],
                "features": status["alvin"]["n_features"],
                "available": status["model_alvin_loaded"],
                "description": "Baseline spektral residual modulasi (280 fitur MFCC & LFCC) menggunakan XGBoost."
            },
            {
                "id": "fawwas",
                "name": status["fawwas"]["name"],
                "type": status["fawwas"]["type"],
                "features": status["fawwas"]["n_features"],
                "available": status["model_fawwas_loaded"],
                "description": "Deteksi re-recording & keaslian vokal forensik (204 fitur akustik) menggunakan KNN."
            }
        ]
    }


@app.get("/api/models")
def models_endpoint():
    status = engine.get_health_status()
    return {
        "models": [
            {
                "id": "alvin",
                "family": "MFCC + LFCC",
                "kind": "XGBoost",
                "dataset": "ASVspoof & Re-recording",
                "seed": 42,
                "description": "Model Alvin B4 (XGBoost) - 280 Fitur Statistik Spektral",
                "pipeline": "residual_modulation",
                "available": status["model_alvin_loaded"],
                "unavailable_reason": status["alvin"]["error"]
            },
            {
                "id": "fawwas",
                "family": "Acoustic + Re-recording",
                "kind": "KNN (N=5)",
                "dataset": "Forensic Re-rec Evaluation",
                "seed": 2026,
                "description": "Model Fawwas (KNN Forensik) - 204 Fitur Akustik Standarisasi",
                "pipeline": "knn_forensic",
                "available": status["model_fawwas_loaded"],
                "unavailable_reason": status["fawwas"]["error"]
            }
        ]
    }


@app.post("/detect")
@app.post("/api/detect")
async def detect_endpoint(
    file: UploadFile = File(...),
    model: str = Form("alvin"),
    threshold: Optional[str] = Form(None)
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Pilih berkas audio terlebih dahulu.")

    raw_ext = Path(file.filename).suffix.lower().lstrip(".")
    if raw_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Format '{raw_ext}' tidak didukung. Gunakan WAV, MP3, M4A, WebM, OGG, atau FLAC."
        )

    # Read audio bytes with max size guard
    blob = await file.read(MAX_BYTES + 1024)
    file_size_bytes = len(blob)
    if file_size_bytes > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran berkas melebihi batas 25 MB.")
    if file_size_bytes == 0:
        raise HTTPException(status_code=400, detail="Berkas audio kosong.")

    # Parse threshold
    parsed_threshold: Optional[float] = None
    if threshold and threshold.strip():
        try:
            parsed_threshold = float(threshold.strip())
            if not 0.05 <= parsed_threshold <= 0.95:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=422, detail="Ambang keputusan harus berupa angka antara 0,05 dan 0,95.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{raw_ext}") as tmp:
            tmp.write(blob)
            temp_path = tmp.name

        result = engine.infer_audio(
            audio_path=temp_path,
            model_choice=model,
            requested_threshold=parsed_threshold,
            file_name=file.filename,
            file_size_bytes=file_size_bytes
        )
        return result

    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Audio tidak dapat diproses: {str(exc)}. Pastikan berkas valid dan codec didukung."
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


# Mount static production UI from dist
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="web")
