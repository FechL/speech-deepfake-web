# Checkpoint Fawwas

Folder ini menyimpan tiga arsip eksperimen yang diberikan untuk Model Fawwas:

- `seed_2026-20261114T080650Z-1-001.zip`
- `seed_2027-20261114T080650Z-1-001.zip`
- `seed_2028-20261114T080651Z-1-001.zip`

Setiap arsip berisi `models_frozen_v6.joblib`, beberapa `selected.joblib`, dan `frozen_selection_v6.json`. Metadata menunjukkan eksperimen MFCC, LFCC, dan glotal dengan Logistic Regression, SVM RBF, serta Random Forest.

## Status integrasi

Arsip ini berbeda dari checkpoint KNN Fawwas yang saat ini dicari backend (`rerec_KNN_N=5.pkl` dan `knn_rerec_scaler.joblib`). Arsip baru tidak menyertakan kode ekstraksi fitur dari audio mentah. Karena itu file sudah disimpan dan dikonfigurasi untuk Git LFS, tetapi belum dapat dipakai sebagai model inferensi audio sampai extractor yang sesuai tersedia dan checkpoint operasionalnya ditentukan.

Jangan mengganti extractor KNN 204 fitur dengan extractor spektral dari model Alvin; skema fiturnya tidak sama.
