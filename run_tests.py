import io
import sys
import unittest
from pathlib import Path
import numpy as np
import soundfile as sf

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from backend.deepguard_engine import engine
from backend.server import app as flask_app


def generate_wav(seconds: float = 3.0, freq: float = 440.0, sr: int = 16000) -> bytes:
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    signal = 0.5 * np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * freq * 2 * t)
    buffer = io.BytesIO()
    sf.write(buffer, signal, sr, format="WAV")
    return buffer.getvalue()


class DeepGuardEngineTestCase(unittest.TestCase):
    def test_engine_health(self):
        status = engine.get_health_status()
        print("Engine status:", status["status"])
        self.assertTrue(status["model_alvin_loaded"], "Model Alvin should be loaded")
        self.assertTrue(status["model_fawwas_loaded"], "Model Fawwas should be loaded")
        self.assertEqual(status["alvin"]["n_features"], 280)
        self.assertEqual(status["fawwas"]["n_features"], 204)

    def test_flask_health_endpoint(self):
        with flask_app.test_client() as client:
            res = client.get("/health")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["status"], "healthy")
            self.assertTrue(data["model_loaded"])
            self.assertTrue(data["fawwas_available"])

    def test_flask_models_endpoint(self):
        with flask_app.test_client() as client:
            res = client.get("/api/models")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            ids = [m["id"] for m in data["models"]]
            self.assertIn("alvin", ids)
            self.assertIn("fawwas", ids)

    def test_detect_alvin(self):
        wav_bytes = generate_wav(seconds=2.0)
        with flask_app.test_client() as client:
            res = client.post(
                "/detect",
                data={
                    "file": (io.BytesIO(wav_bytes), "alvin_sample.wav"),
                    "model": "alvin",
                    "threshold": "0.38"
                },
                content_type="multipart/form-data"
            )
            self.assertEqual(res.status_code, 200, res.data.decode())
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["fileName"], "alvin_sample.wav")
            self.assertIn("Model Alvin", data["modelName"])
            self.assertIn("XGBoost", data["modelName"])
            self.assertGreaterEqual(data["prob_authentic"], 0.0)
            self.assertLessEqual(data["prob_authentic"], 1.0)
            self.assertGreaterEqual(data["prob_deepfake"], 0.0)
            self.assertLessEqual(data["prob_deepfake"], 1.0)
            self.assertIsInstance(data["isAuthentic"], bool)
            self.assertAlmostEqual(data["threshold"], 0.38, places=2)
            print("[PASS] Model Alvin Detection passed:", data["modelName"], "isAuthentic:", data["isAuthentic"])

    def test_detect_fawwas(self):
        wav_bytes = generate_wav(seconds=3.0)
        with flask_app.test_client() as client:
            res = client.post(
                "/detect",
                data={
                    "file": (io.BytesIO(wav_bytes), "fawwas_sample.wav"),
                    "model": "fawwas",
                    "threshold": "0.50"
                },
                content_type="multipart/form-data"
            )
            self.assertEqual(res.status_code, 200, res.data.decode())
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["fileName"], "fawwas_sample.wav")
            self.assertIn("Model Fawwas", data["modelName"])
            self.assertIn("KNN", data["modelName"])
            self.assertGreaterEqual(data["prob_authentic"], 0.0)
            self.assertLessEqual(data["prob_authentic"], 1.0)
            self.assertGreaterEqual(data["prob_deepfake"], 0.0)
            self.assertLessEqual(data["prob_deepfake"], 1.0)
            self.assertIsInstance(data["isAuthentic"], bool)
            self.assertAlmostEqual(data["threshold"], 0.50, places=2)
            print("[PASS] Model Fawwas Detection passed:", data["modelName"], "isAuthentic:", data["isAuthentic"])

    def test_detect_alvin_b0(self):
        wav_bytes = generate_wav(seconds=2.0)
        with flask_app.test_client() as client:
            res = client.post(
                "/detect",
                data={
                    "file": (io.BytesIO(wav_bytes), "alvin_b0_sample.wav"),
                    "model": "alvin_B0",
                },
                content_type="multipart/form-data"
            )
            self.assertEqual(res.status_code, 200, res.data.decode())
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertIn("B0", data["modelName"])
            print("[PASS] Model Alvin B0 (SVM) passed:", data["modelName"])

    def test_detect_fawwas_knn3(self):
        wav_bytes = generate_wav(seconds=2.0)
        with flask_app.test_client() as client:
            res = client.post(
                "/detect",
                data={
                    "file": (io.BytesIO(wav_bytes), "fawwas_knn3_sample.wav"),
                    "model": "fawwas_rerec_knn_3",
                },
                content_type="multipart/form-data"
            )
            self.assertEqual(res.status_code, 200, res.data.decode())
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertIn("N=3", data["modelName"])
            print("[PASS] Model Fawwas KNN N=3 passed:", data["modelName"])

    def test_samples_library_and_reevaluation(self):
        wav_bytes = generate_wav(seconds=2.0)
        with flask_app.test_client() as client:
            # 1. Upload sample via /detect
            res = client.post(
                "/detect",
                data={
                    "file": (io.BytesIO(wav_bytes), "library_test.wav"),
                    "model": "alvin_B4",
                },
                content_type="multipart/form-data"
            )
            self.assertEqual(res.status_code, 200)
            det_data = res.get_json()
            sample_id = det_data.get("sampleId")
            self.assertIsNotNone(sample_id, "Response should include sampleId")

            # 2. Verify sample appears in /api/samples
            res_list = client.get("/api/samples")
            self.assertEqual(res_list.status_code, 200)
            samples = res_list.get_json().get("samples", [])
            matched = next((s for s in samples if s["id"] == sample_id), None)
            self.assertIsNotNone(matched, "Sample must be in library")
            self.assertEqual(matched["fileName"], "library_test.wav")

            # 3. Audio stream check
            res_audio = client.get(f"/api/samples/{sample_id}/audio")
            self.assertEqual(res_audio.status_code, 200)
            self.assertEqual(res_audio.content_type, "audio/wav")

            # 4. Re-evaluate with Fawwas without re-uploading
            res_eval = client.post(
                f"/api/samples/{sample_id}/evaluate",
                json={"model": "fawwas_rerec_knn_5"}
            )
            self.assertEqual(res_eval.status_code, 200)
            eval_data = res_eval.get_json()
            self.assertEqual(eval_data["status"], "success")
            self.assertIn("Fawwas", eval_data["result"]["modelName"])

            # 5. One-shot comparison
            res_comp = client.post(
                f"/api/samples/{sample_id}/compare",
                json={"alvin_model": "alvin_B0", "fawwas_model": "fawwas_rerec_knn_3"}
            )
            self.assertEqual(res_comp.status_code, 200)
            comp_data = res_comp.get_json()
            self.assertIn("alvin", comp_data)
            self.assertIn("fawwas", comp_data)
            print("[PASS] Samples library & re-evaluation test passed for sample:", sample_id)

            # 6. Delete sample
            res_del = client.delete(f"/api/samples/{sample_id}")
            self.assertEqual(res_del.status_code, 200)

    def test_invalid_format(self):
        with flask_app.test_client() as client:
            res = client.post(
                "/detect",
                data={
                    "file": (io.BytesIO(b"fake txt"), "sample.txt"),
                    "model": "alvin"
                },
                content_type="multipart/form-data"
            )
            self.assertEqual(res.status_code, 400)

    @classmethod
    def tearDownClass(cls):
        # Clean up any test samples created during unit tests
        uploads_dir = BASE_DIR / "backend" / "uploads"
        if uploads_dir.exists():
            for p in uploads_dir.glob("s_*.wav"):
                try:
                    p.unlink()
                except Exception:
                    pass
            index_path = uploads_dir / "samples_index.json"
            try:
                index_path.write_text("[]", encoding="utf-8")
            except Exception:
                pass


if __name__ == "__main__":
    unittest.main()

