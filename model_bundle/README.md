# DeepForensic model bundle

This bundle collects the model artifacts found in `speech-deepfake-web` and three distinct local glottal seed bundles in the run referenced by `models/registry.json`. The ten residual checkpoint files named in the registry are byte-for-byte identical to the files inside the Alvin ZIP, so they are included once in that archive. The three Fawwas ZIP files were retrieved from this repository's Git LFS storage and verified against their LFS SHA-256 identifiers.

## Files

| Path in this bundle | Contents |
| --- | --- |
| `alvin/models_checkpoints_alvin.zip` | Ten residual-modulation checkpoints, each a `*_seed42.joblib` file. |
| `fawwas/seed_2026-20261114T080650Z-1-001.zip` | Fawwas seed 2026 experiment, including `models_frozen_v6.joblib`, 86 `selected.joblib` files, and `frozen_selection_v6.json`. |
| `fawwas/seed_2027-20261114T080650Z-1-001.zip` | Same Fawwas experiment layout for seed 2027. |
| `fawwas/seed_2028-20261114T080651Z-1-001.zip` | Same Fawwas experiment layout for seed 2028. |
| `glottal/models_frozen_v5_seed_2026.joblib` | Frozen glottal bundle referenced by the local registry for eight model keys. |
| `glottal/models_frozen_v5_seed_2027.joblib` | Same glottal run's seed 2027 frozen model bundle. |
| `glottal/models_frozen_v5_seed_2028.joblib` | Same glottal run's seed 2028 frozen model bundle. |
| `metadata/registry.json` | Snapshot of the web app's model registry. Its absolute source paths refer to the original machine and need updating if used elsewhere. |
| `metadata/fawwas_README.md` | Original Fawwas checkpoint notes from the web repository. |
| `metadata/requirements-model.txt` | Model dependency list from the web repository. |
| `SHA256SUMS.txt` | SHA-256 checksums for the seven model artifact files. |

## Alvin / residual models

The archive contains the following checkpoint names. The model families and algorithms come from `models/registry.json`. All checkpoints have seed 42.

| Checkpoint | Feature family | Algorithm |
| --- | --- | --- |
| `B0_seed42.joblib` | MFCC | SVM with RBF kernel |
| `B1_seed42.joblib` | LFCC | SVM with RBF kernel |
| `B2_seed42.joblib` | MFCC + LFCC | SVM with RBF kernel |
| `B3_seed42.joblib` | MFCC + LFCC | Random Forest |
| `B4_seed42.joblib` | MFCC + LFCC | XGBoost |
| `E4a_seed42.joblib` | Residual | SVM with RBF kernel |
| `E4b_seed42.joblib` | Modulation | SVM with RBF kernel |
| `E4c_seed42.joblib` | Evidence | SVM with RBF kernel |
| `E4d_seed42.joblib` | Evidence | Random Forest |
| `E4e_seed42.joblib` | Evidence | XGBoost |

The web app loads `B4_seed42.joblib` from this archive for Alvin detection. Its checkpoint metadata reports 280 feature names and a validation decision threshold of 0.3792776763. The other variants are also packaged in the same archive.

## Fawwas experiments

Each seed archive contains 86 model specifications and 86 matching `selected.joblib` files, plus the frozen model bundle. Specifications span four training regimes: `la_only` (20), `concat_naive` (20), `domain_equal` (20), and `additional_x2` (26). The model families recorded in `frozen_selection_v6.json` are:

`MFCC`, `LFCC`, `MFCC_LFCC`, `G0_prosody`, `G1_perturb_hnr`, `G2_harmonic`, `G3_glottal`, `G3_without_prosody`, `G3_without_perturb_hnr`, `G3_without_harmonic`, `MFCC_plus_G3`, `LFCC_plus_G3`, `QC_strict`, and `Missing_only`.

The recorded algorithm kinds are Logistic Regression (`lr`), Random Forest (`rf`), and RBF SVM (`svm_rbf`). Each specification records its exact family, algorithm, regime, feature columns, and threshold in the seed archive's `frozen_selection_v6.json`.

These research archives are different from the KNN checkpoint and scaler expected by the current web runtime (`rerec_KNN_N=5.pkl` and `knn_rerec_scaler.joblib`). The archives do not include the audio feature extractor needed to use them directly in the current Fawwas inference route.

## Registered glottal bundle

The registry points to the included seed 2026 `models_frozen_v5.joblib` for eight model keys: `MFCC@lr`, `LFCC@lr`, `G0_prosody@lr`, `G1_perturb_hnr@lr`, `G2_harmonic@lr`, `G3_glottal@lr`, `MFCC_plus_G3@lr`, and `LFCC_plus_G3@lr`. These are Logistic Regression variants for MFCC, LFCC, and glottal feature families. The same local run also has seed 2027 and 2028 bundles, included here under `glottal/`. These v5 bundles are distinct from the v6 Fawwas seed archives.

## Use and verification

Extract this ZIP first. The Alvin and Fawwas files are themselves ZIP archives; open those archives to access their individual checkpoint and metadata files. To use the Alvin archive with this web app, place `alvin/models_checkpoints_alvin.zip` at `backend/checkpoints/alvin/models_checkpoints_alvin.zip` and install the dependencies listed in the web app's `requirements.txt`.

Verify the model artifacts from the extracted bundle directory with `sha256sum -c SHA256SUMS.txt`. Python `joblib` files are serialized Python objects; load them only when you trust their source and have a compatible Python environment.
