"""
DeepGuard Local API Server (Flask)
Port: 5001
Supports Model Alvin B4 (XGBoost) and Model Fawwas (KNN Forensik)
"""

import datetime
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DIST_DIR = PROJECT_ROOT / "dist"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
INDEX_FILE = UPLOADS_DIR / "samples_index.json"

sys.path.insert(0, str(PROJECT_ROOT))
from backend.deepguard_engine import engine, ALLOWED_EXTENSIONS

app = Flask(__name__, static_folder=str(DIST_DIR) if DIST_DIR.exists() else None, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB


def load_samples_index():
    if not INDEX_FILE.exists():
        return []
    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_samples_index(samples):
    temp_file = INDEX_FILE.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)
    temp_file.replace(INDEX_FILE)


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    allowed_origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5001",
        "http://127.0.0.1:5001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    }
    if origin in allowed_origins or (origin and "localhost" in origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify(
        status="error",
        message="Ukuran berkas melebihi batas 25 MB.",
    ), 413


@app.route("/", methods=["GET"])
def index():
    if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
        return app.send_static_file("index.html")
    return jsonify({
        "name": "DeepGuard AI Backend",
        "status": "online",
        "ui_directory": str(DIST_DIR)
    })


@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    if DIST_DIR.exists() and (DIST_DIR / filename).exists():
        return app.send_static_file(filename)
    if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
        return app.send_static_file("index.html")
    return jsonify(status="error", message="Not found"), 404


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    status = engine.get_health_status()
    return jsonify({
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
    })


@app.route("/api/models", methods=["GET"])
def models():
    status = engine.get_health_status()
    return jsonify({
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
    })


@app.route("/detect", methods=["POST"])
@app.route("/api/detect", methods=["POST"])
def detect_audio():
    uploaded_file = request.files.get("file")
    if uploaded_file is None or not uploaded_file.filename:
        return jsonify(status="error", message="Pilih berkas audio terlebih dahulu."), 400

    safe_name = secure_filename(uploaded_file.filename) or "audio.wav"
    extension = Path(safe_name).suffix.lower().lstrip(".")
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify(
            status="error",
            message=f"Format '{extension}' tidak didukung. Gunakan WAV, MP3, M4A, WebM, OGG, atau FLAC.",
        ), 400

    model_choice = request.form.get("model", "alvin").strip()
    requested_threshold = request.form.get("threshold", "").strip()
    parsed_threshold = None
    if requested_threshold:
        try:
            parsed_threshold = float(requested_threshold)
            if not 0.05 <= parsed_threshold <= 0.95:
                raise ValueError()
        except ValueError:
            return jsonify(
                status="error",
                message="Ambang keputusan harus berada antara 0,05 dan 0,95.",
            ), 422

    sample_id = f"s_{uuid.uuid4().hex[:10]}"
    stored_name = f"{sample_id}_{safe_name}"
    target_path = UPLOADS_DIR / stored_name

    try:
        uploaded_file.save(str(target_path))
        file_size_bytes = os.path.getsize(target_path)
        if file_size_bytes == 0:
            raise ValueError("Berkas audio kosong.")

        result = engine.infer_audio(
            audio_path=str(target_path),
            model_choice=model_choice,
            requested_threshold=parsed_threshold,
            file_name=safe_name,
            file_size_bytes=file_size_bytes
        )

        # Register in samples library
        now_iso = datetime.datetime.now().isoformat()
        eval_key = result["modelName"]
        eval_record = {
            "modelId": model_choice,
            "modelName": result["modelName"],
            "isAuthentic": result["isAuthentic"],
            "confidenceScore": result["confidenceScore"],
            "prob_authentic": result["prob_authentic"],
            "prob_deepfake": result["prob_deepfake"],
            "threshold": result["threshold"],
            "engine": result.get("engine", ""),
            "analyzedAt": now_iso
        }

        sample_entry = {
            "id": sample_id,
            "fileName": safe_name,
            "storedFileName": stored_name,
            "fileFormat": extension.upper(),
            "fileSize": result["fileSize"],
            "fileDuration": result["duration"],
            "uploadedAt": now_iso,
            "lastModel": result["modelName"],
            "lastIsAuthentic": result["isAuthentic"],
            "lastConfidence": result["confidenceScore"],
            "evaluations": {
                eval_key: eval_record
            }
        }

        samples = load_samples_index()
        samples = [sample_entry] + [s for s in samples if s["id"] != sample_id]
        save_samples_index(samples)

        result["sampleId"] = sample_id
        result["audioUrl"] = f"/api/samples/{sample_id}/audio"
        return jsonify(result)

    except (ValueError, RuntimeError) as exc:
        if target_path.exists():
            try:
                target_path.unlink()
            except OSError:
                pass
        return jsonify(status="error", message=str(exc)), 422
    except Exception as exc:
        if target_path.exists():
            try:
                target_path.unlink()
            except OSError:
                pass
        app.logger.exception("Analisis audio gagal")
        return jsonify(
            status="error",
            message=f"Audio tidak dapat diproses: {str(exc)}. Pastikan berkas tidak rusak dan codec didukung.",
        ), 422


@app.route("/api/samples", methods=["GET"])
def get_samples():
    samples = load_samples_index()
    # Enrich audioUrl for frontend playback
    for s in samples:
        s["audioUrl"] = f"/api/samples/{s['id']}/audio"
    return jsonify(status="success", samples=samples)


@app.route("/api/samples/<sample_id>/audio", methods=["GET"])
def get_sample_audio(sample_id):
    samples = load_samples_index()
    match = next((s for s in samples if s["id"] == sample_id), None)
    if not match:
        return jsonify(status="error", message="Sampel tidak ditemukan."), 404
    
    file_path = UPLOADS_DIR / match["storedFileName"]
    if not file_path.exists():
        return jsonify(status="error", message="Berkas audio fisik tidak ditemukan di server."), 404

    ext = match["fileFormat"].lower()
    mime = "audio/wav" if ext == "wav" else ("audio/mpeg" if ext == "mp3" else f"audio/{ext}")
    return send_from_directory(str(UPLOADS_DIR), match["storedFileName"], mimetype=mime)


@app.route("/api/samples/<sample_id>/evaluate", methods=["POST"])
def evaluate_sample(sample_id):
    samples = load_samples_index()
    match = next((s for s in samples if s["id"] == sample_id), None)
    if not match:
        return jsonify(status="error", message="Sampel audio tidak ditemukan."), 404

    file_path = UPLOADS_DIR / match["storedFileName"]
    if not file_path.exists():
        return jsonify(status="error", message="Berkas audio tidak ada di server."), 404

    # Extract parameters
    req_json = request.get_json(silent=True) or {}
    model_choice = request.form.get("model") or req_json.get("model", "alvin")
    thresh_val = request.form.get("threshold") or req_json.get("threshold")
    parsed_threshold = float(thresh_val) if thresh_val else None

    try:
        file_size_bytes = os.path.getsize(file_path)
        result = engine.infer_audio(
            audio_path=str(file_path),
            model_choice=model_choice,
            requested_threshold=parsed_threshold,
            file_name=match["fileName"],
            file_size_bytes=file_size_bytes
        )

        now_iso = datetime.datetime.now().isoformat()
        eval_key = result["modelName"]
        match.setdefault("evaluations", {})[eval_key] = {
            "modelId": model_choice,
            "modelName": result["modelName"],
            "isAuthentic": result["isAuthentic"],
            "confidenceScore": result["confidenceScore"],
            "prob_authentic": result["prob_authentic"],
            "prob_deepfake": result["prob_deepfake"],
            "threshold": result["threshold"],
            "engine": result.get("engine", ""),
            "analyzedAt": now_iso
        }
        match["lastModel"] = result["modelName"]
        match["lastIsAuthentic"] = result["isAuthentic"]
        match["lastConfidence"] = result["confidenceScore"]

        save_samples_index(samples)
        result["sampleId"] = sample_id
        result["audioUrl"] = f"/api/samples/{sample_id}/audio"
        return jsonify(status="success", result=result, sample=match)

    except Exception as exc:
        return jsonify(status="error", message=str(exc)), 422


@app.route("/api/samples/<sample_id>/compare", methods=["POST"])
def compare_sample(sample_id):
    samples = load_samples_index()
    match = next((s for s in samples if s["id"] == sample_id), None)
    if not match:
        return jsonify(status="error", message="Sampel audio tidak ditemukan."), 404

    file_path = UPLOADS_DIR / match["storedFileName"]
    if not file_path.exists():
        return jsonify(status="error", message="Berkas audio fisik tidak ada di server."), 404

    req_json = request.get_json(silent=True) or {}
    alvin_model = request.form.get("alvin_model") or req_json.get("alvin_model", "alvin_B4")
    fawwas_model = request.form.get("fawwas_model") or req_json.get("fawwas_model", "fawwas_rerec_knn_5")

    try:
        file_size_bytes = os.path.getsize(file_path)
        # 1. Run Alvin
        res_alvin = engine.infer_audio(
            audio_path=str(file_path),
            model_choice=alvin_model,
            file_name=match["fileName"],
            file_size_bytes=file_size_bytes
        )
        # 2. Run Fawwas
        res_fawwas = engine.infer_audio(
            audio_path=str(file_path),
            model_choice=fawwas_model,
            file_name=match["fileName"],
            file_size_bytes=file_size_bytes
        )

        now_iso = datetime.datetime.now().isoformat()
        evals = match.setdefault("evaluations", {})
        evals[res_alvin["modelName"]] = {
            "modelId": alvin_model,
            "modelName": res_alvin["modelName"],
            "isAuthentic": res_alvin["isAuthentic"],
            "confidenceScore": res_alvin["confidenceScore"],
            "prob_authentic": res_alvin["prob_authentic"],
            "prob_deepfake": res_alvin["prob_deepfake"],
            "threshold": res_alvin["threshold"],
            "engine": res_alvin.get("engine", ""),
            "analyzedAt": now_iso
        }
        evals[res_fawwas["modelName"]] = {
            "modelId": fawwas_model,
            "modelName": res_fawwas["modelName"],
            "isAuthentic": res_fawwas["isAuthentic"],
            "confidenceScore": res_fawwas["confidenceScore"],
            "prob_authentic": res_fawwas["prob_authentic"],
            "prob_deepfake": res_fawwas["prob_deepfake"],
            "threshold": res_fawwas["threshold"],
            "engine": res_fawwas.get("engine", ""),
            "analyzedAt": now_iso
        }
        match["lastModel"] = "Komparasi Lintas Model (Alvin & Fawwas)"
        save_samples_index(samples)

        return jsonify(
            status="success", 
            alvin=res_alvin, 
            fawwas=res_fawwas, 
            sample=match
        )

    except Exception as exc:
        return jsonify(status="error", message=str(exc)), 422


@app.route("/api/samples/<sample_id>", methods=["DELETE"])
def delete_sample(sample_id):
    samples = load_samples_index()
    match = next((s for s in samples if s["id"] == sample_id), None)
    if not match:
        return jsonify(status="error", message="Sampel tidak ditemukan."), 404

    file_path = UPLOADS_DIR / match.get("storedFileName", "")
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            pass

    updated = [s for s in samples if s["id"] != sample_id]
    save_samples_index(updated)
    return jsonify(status="success", message="Sampel berhasil dihapus dari koleksi.")


if __name__ == "__main__":
    port = int(os.getenv("DEEPGUARD_PORT", 5001))
    print(f"[*] DeepGuard local API berjalan di http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)

