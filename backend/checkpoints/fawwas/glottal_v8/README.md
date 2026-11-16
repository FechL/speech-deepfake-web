# Fawwas — Glottal v8 model bundle (LA + ADDITIONAL)

Newest trained models from `speech-deepfake-glottal` (pipeline `forensic_reference_glottal_v8`,
profile `la_additional`, run id `baef033a6a80d0fa`, frozen 2026-10-24).

## Contents
| Path | What |
| --- | --- |
| `models/seed_<seed>/models_frozen_v8.joblib` | dict of 26 frozen systems per seed (2026, 2027, 2028). Each entry: `model` (sklearn Pipeline: median imputer -> StandardScaler -> SVM/RF/XGBoost), `cols` (input feature names, in order), `threshold` (dev-EER, frozen), `operating_thresholds`, metadata. |
| `models/seed_<seed>/frozen_selection_v8.json` | specs, thresholds and provenance for the above |
| `extractor/glottal_features.py` | feature extractor (`extract_audio_v4`) that produces the columns the models expect |
| `config/features_config.json` | extractor settings used in training (16 kHz, 2 s windows, ...) |
| `config/run_identity.json`, `config/resolved_config.json` | run provenance |
| `SHA256SUMS.txt` | checksums of the model files |

## Systems exposed in the website (seed 2026)
Score = P(FAKE) from `predict_proba`; label FAKE if score >= frozen threshold.

| Web id | System | Experiment | #features | Threshold | Dev AUC | AUC ADDITIONAL test | AUC LA internal | AUC MLAAD | AUC DF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `glottal_g3` | `G3_glottal@svm_rbf` | G3_SVM | 44 | 0.3767 | 0.778 | 0.796 | 0.661 | 0.540 | 0.581 |
| `glottal_g3_rf` | `G3_glottal@rf` | G3_RF | 44 | 0.3567 | 0.780 | 0.903 | 0.680 | 0.535 | 0.562 |
| `glottal_g3_xgb` | `G3_glottal@xgb` | G3_XGB | 44 | 0.4474 | 0.788 | 0.913 | 0.676 | 0.543 | 0.581 |
| `glottal_lfcc_g3` | `LFCC_plus_G3@xgb` | LFCC_plus_G3_xgb | 284 | 0.4473 | 0.872 | 0.950 | 0.697 | 0.276 | 0.612 |
| `glottal_mfcc_g3` | `MFCC_plus_G3@xgb` | MFCC_plus_G3_xgb | 284 | 0.4468 | 0.809 | 0.979 | 0.704 | 0.656 | 0.620 |

(Test AUC = mean over seeds 2026-2028 from `report/all_metrics.csv`.)

## Honest limitations
* Glottal-only features generalise weakly to external data (MLAAD AUC about 0.54, DF about 0.58, LA internal about 0.66-0.68).
  Treat the output as research evidence, not a verdict.
* `glottal_lfcc_g3` scores AUC 0.28 on MLAAD (worse than chance: its ranking inverts there). Prefer `glottal_mfcc_g3` or the G3 variants for unfamiliar audio.
* ADDITIONAL has few REAL examples (13 dev / 12 test); its high AUC is optimistic and its split is exploratory.
* Thresholds are frozen from the dev set; they are not calibrated for any new domain.

## Usage
```python
import joblib, numpy as np, pandas as pd, librosa, json
from extractor.glottal_features import extract_audio_v4   # run from the bundle root
cfg = json.load(open('config/features_config.json'))
spec = joblib.load('models/seed_2026/models_frozen_v8.joblib')['G3_glottal@svm_rbf']
x, sr = librosa.load('audio.wav', sr=None, mono=True)
feats = extract_audio_v4(x, sr, cfg)
p_fake = spec['model'].predict_proba(pd.DataFrame([{c: feats[c] for c in spec['cols']}]))[0, 1]
is_fake = p_fake >= spec['threshold']
```
Requirements: scikit-learn 1.6.x, xgboost >= 3.0, librosa 0.11, praat-parselmouth 0.4.x, numpy, scipy, pandas, joblib.
