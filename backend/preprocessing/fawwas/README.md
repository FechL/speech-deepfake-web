# Fawwas preprocessing (Glottal v9)

`features_v9.py` is copied from `speech-deepfake-glottal/src/pipeline_v9/features.py`. It extracts whole-utterance phonation, MFCC, LFCC, and measurement-quality features. The web uses a maximum 60-second centre crop, matching the v9 research configuration. The minimum analyzable duration is 0.3 seconds; missing phonation measurements remain missing while spectral features can still be scored.

`model.py` loads `backend/checkpoints/fawwas/glottal_v9/seed_2026.joblib` and its JSON metadata, verifies the SHA256 checksum, and scores five v9 systems. The saved classifiers were refit from the v9 train feature cache with the exact presets in `scripts/run_pipeline_v9.py`; thresholds came from the dev split. Eval and external splits were not used in fitting or threshold selection. Use `scripts/export_fawwas_v9.py` to reproduce the checkpoint from the sibling research repository.

The research v9 pipeline stores raw decision scores, not calibrated probabilities. The web maps each raw score monotonically through a sigmoid centered on its dev threshold. A displayed value of 0.5 is therefore the research decision boundary; the displayed score is **not a calibrated probability**.

The older `glottal_features.py` and `glottal_v8/` checkpoint remain for reference and are not loaded by the current backend.
