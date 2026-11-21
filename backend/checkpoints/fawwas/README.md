# Fawwas checkpoints

The backend uses `glottal_v9/seed_2026.joblib` and `seed_2026.json`. They contain five v9 systems refit from the research run `fe17e2b856dd5d6c` train features with thresholds selected on dev. The JSON includes the feature settings, system list, and SHA256 checksum. Seed 2026 is the only exported seed; `DEEPGUARD_FAWWAS_SEED` can select another seed after exporting it.

`glottal_v8/` is retained as an older research artifact. It is not used by the current backend.
