import io
import sys
from pathlib import Path
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import app
from backend.deepguard_engine import engine
from backend.server import app as flask_app

client = TestClient(app)


def generate_wav(seconds: float = 3.0, freq: float = 440.0, sr: int = 16000) -> bytes:
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    # Sine wave with simple harmonics
    signal = 0.5 * np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * freq * 2 * t)
    buffer = io.BytesIO()
    sf.write(buffer, signal, sr, format="WAV")
    return buffer.getvalue()


def test_health_endpoints():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("healthy", "ok")
    assert data["model_alvin_loaded"] is True
    assert data["model_fawwas_loaded"] is True
    assert "alvin" in data and "fawwas" in data
    assert data["alvin"]["n_features"] == 280
    assert data["fawwas"]["n_features"] == 204

    # API prefix version
    res_api = client.get("/api/health")
    assert res_api.status_code == 200


def test_models_metadata():
    res = client.get("/api/models")
    assert res.status_code == 200
    models = res.json()["models"]
    ids = [m["id"] for m in models]
    assert "alvin" in ids
    assert "fawwas" in ids


def test_detect_model_alvin():
    wav_bytes = generate_wav(seconds=2.0)
    res = client.post(
        "/detect",
        files={"file": ("test_sample.wav", wav_bytes, "audio/wav")},
        data={"model": "alvin", "threshold": "0.38"}
    )
    assert res.status_code == 200, res.text
    result = res.json()
    assert result["status"] == "success"
    assert result["fileName"] == "test_sample.wav"
    assert "Model Alvin" in result["modelName"]
    assert "XGBoost" in result["modelName"]
    assert 0.0 <= result["prob_authentic"] <= 1.0
    assert 0.0 <= result["prob_deepfake"] <= 1.0
    assert isinstance(result["isAuthentic"], bool)
    assert 0.0 <= result["confidenceScore"] <= 1.0
    assert result["threshold"] == pytest.approx(0.38, abs=1e-4)


def test_detect_model_fawwas():
    wav_bytes = generate_wav(seconds=3.0)
    res = client.post(
        "/detect",
        files={"file": ("fawwas_test.wav", wav_bytes, "audio/wav")},
        data={"model": "fawwas", "threshold": "0.50"}
    )
    assert res.status_code == 200, res.text
    result = res.json()
    assert result["status"] == "success"
    assert result["fileName"] == "fawwas_test.wav"
    assert "Model Fawwas" in result["modelName"]
    assert "KNN" in result["modelName"]
    assert 0.0 <= result["prob_authentic"] <= 1.0
    assert 0.0 <= result["prob_deepfake"] <= 1.0
    assert isinstance(result["isAuthentic"], bool)
    assert 0.0 <= result["confidenceScore"] <= 1.0
    assert result["threshold"] == pytest.approx(0.50, abs=1e-4)


def test_detect_invalid_file_format():
    res = client.post(
        "/detect",
        files={"file": ("document.pdf", b"Fake PDF bytes", "application/pdf")},
        data={"model": "alvin"}
    )
    assert res.status_code == 400
    assert "Format" in res.json()["detail"]


def test_detect_empty_file():
    res = client.post(
        "/detect",
        files={"file": ("empty.wav", b"", "audio/wav")},
        data={"model": "alvin"}
    )
    assert res.status_code == 400


def test_flask_server_endpoints():
    with flask_app.test_client() as flask_client:
        h = flask_client.get("/health")
        assert h.status_code == 200
        assert h.json["model_alvin_loaded"] is True
        assert h.json["model_fawwas_loaded"] is True

        wav_bytes = generate_wav(seconds=2.0)
        d = flask_client.post(
            "/detect",
            data={
                "file": (io.BytesIO(wav_bytes), "flask_test.wav"),
                "model": "alvin",
                "threshold": "0.40"
            },
            content_type="multipart/form-data"
        )
        assert d.status_code == 200
        assert d.json["status"] == "success"
        assert d.json["fileName"] == "flask_test.wav"
