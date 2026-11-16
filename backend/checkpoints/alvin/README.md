# Checkpoint Alvin

10 model `*_seed42.joblib` (B0-B4 baseline spektral, E4a-e residual/modulasi), disimpan langsung di repo.
B3 dan E4d dikompres (`joblib.dump(..., compress=("zlib", 9))`) agar di bawah batas 100 MB GitHub; isi dan prediksi identik.
Format, daftar fitur, dan alur preprocessing: `backend/preprocessing/alvin/README.md`.
`models_checkpoints_alvin.zip` hanya cadangan lama.
