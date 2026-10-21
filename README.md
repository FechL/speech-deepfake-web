# DeepGuard — Audio Research Lab

Webapp inferensi dan evaluasi speech deepfake dengan dua repo penelitian terpisah:

```text
Myrepos/
├── speech-deepfake-web/                   # frontend + API ini
├── speech-deepfake-glottal/               # src/pipeline_v4, results/... v5
└── speech-deepfake-residual-modulation/   # skripsi_residual_modulasi/src + checkpoints
```

Konsep visual dikembangkan dari [DeepGuard Flutter](https://github.com/alvinrw/Deepfake-audio-detection). Definisi model mengikuti kode training dan metadata checkpoint, bukan judul pada demo Flask atau klaim di dokumen.

## Menjalankan dari repo web ini

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements-model.txt
.venv/bin/python backend/setup_local.py
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Buka http://127.0.0.1:8000. Gunakan `python -m ...` karena shebang console script virtualenv lama masih dapat merujuk lokasi sebelum folder dipindah. Virtualenv baru dianjurkan saat mengkloning ke mesin lain. Frontend saja: `npm run dev` (port 5173); tidak membutuhkan node_modules/build.

Default path repo saudara ditentukan relatif terhadap repo web, bukan cwd. Untuk lokasi lain, set `DEEPGUARD_GLOTTAL_ROOT` dan `DEEPGUARD_RESIDUAL_ROOT` **saat setup dan saat menjalankan server**. Registry default: `models/registry.json`; override dengan `DEEPGUARD_REGISTRY`. Model, registry lokal, dan hasil riset tidak disalin ke hosting atau dimasukkan Git.

## Model glotal

Setup mendaftarkan delapan model LR seed 2026 dari run v5 `2b3a5cec0fa4dcd9`: MFCC, LFCC, G0, G1, G2, G3, MFCC+G3, LFCC+G3. Ekstraksi menggunakan `src.pipeline_v4.features.extract_audio_v4` dari repo glotal, sesuai konfigurasi, pooling, hash source, dan versi package training yang dibekukan. Threshold berasal dari spec bundle. Sembilan evaluasi asli mencakup tiga seed dan tiga skenario (LA subset, MLAAD, DF subset).

## Model residual modulation

Source utama: `skripsi_residual_modulasi/src/train_baseline.py` dan `configs/baseline.yaml`.

| ID | Input | Classifier | Dimensi |
| --- | --- | --- | --- |
| B0 | MFCC | SVM RBF | 240 |
| B1 | LFCC | SVM RBF | 40 |
| B2 | MFCC + LFCC | SVM RBF | 280 |
| B3 | MFCC + LFCC | Random Forest | 280 |
| B4 | MFCC + LFCC | XGBoost | 280 |
| E4a | LP residual | SVM RBF | 15 |
| E4b | Modulasi | SVM RBF | 7 |
| E4c | Residual + modulasi | SVM RBF | 22 |
| E4d | Residual + modulasi | Random Forest | 22 |
| E4e | Residual + modulasi | XGBoost | 22 |

Sepuluh checkpoint residual kini tersedia di `speech-deepfake-residual-modulation/models_checkpoints/`. Metadata ID, keluarga fitur, classifier, seed, kelas dan threshold validation telah diperiksa. UI mengaktifkan model yang bobotnya ditemukan; file yang hilang tetap ditandai tidak tersedia. Tidak ada fallback ke model glotal.

Letakkan checkpoint dipercaya `{ID}_seed42.joblib` di salah satu folder:

- `speech-deepfake-residual-modulation/models_checkpoints/` (prioritas pertama)
- `speech-deepfake-residual-modulation/skripsi_residual_modulasi/checkpoints/`
- `speech-deepfake-residual-modulation/web_cek/model/`

Atau registrasikan lokasi lain:

```bash
.venv/bin/python backend/setup_local.py --residual-checkpoints /absolute/path/checkpoints
```

Restart backend setelah mengganti lokasi repo atau environment. Registry dibaca ulang pada request, sehingga penambahan bobot cukup diikuti setup ulang dan tombol **Perbarui** di UI.

Adapter memakai `extract_utterance_features` **asli** melalui worker Python terisolasi. Import flat (`audio_io`, `lfcc`, dll.) dari repo residual tidak mencemari namespace `src` glotal. Audio decoding divalidasi oleh API, lalu diteruskan sebagai WAV float sementara; loader residual tetap menjalankan mono/resampling, peak normalization, segmentasi 2 detik hop 2 detik, padding audio 1–2 detik, LPC p16, MFCC/LFCC dan agregasi mean asli. Audio <1 detik atau sunyi menghasilkan abstention. WAV sementara otomatis dihapus.

Checkpoint residual adalah dictionary `model`, `features`, `feature_group`, `model_type`, `experiment_id`, `seed`, `val_threshold`. Adapter memvalidasi metadata, urutan fitur, kelas REAL=0/FAKE=1 dan checksum; memakai **predict_proba kelas FAKE** dan **val_threshold checkpoint**. Skor ini probabilitas classifier, belum tentu terkalibrasi. Threshold hardcoded demo Flask tidak digunakan. `source_hashes` mengikat registry pada source yang diperiksa saat setup; versi training residual tidak diketahui tanpa metadata lingkungan aslinya. Ketidakcocokan binary/dependency harus diselesaikan dengan environment training, bukan retraining otomatis.

Joblib hanya boleh berasal dari operator/sumber dipercaya karena dapat mengeksekusi kode Python. File checkpoint tidak diterima sebagai unggahan browser.

## Evaluasi residual yang sudah tersedia

Backend membaca `hasil_validasi/validation_external_predictions.csv`: 272 segmen, sepuluh model, total 2.720 skor. Tiga opsi evaluasi tersedia:

1. **Validation checkpoint**: memakai `val_threshold` dari sepuluh checkpoint asli seed 42; tidak dituning pada data eksternal.
2. **Standar 0.5**: cutoff probabilitas standar, bukan threshold validation checkpoint.
3. **Threshold laporan sumber**: memakai `calibrated_thresh` pada `validation_external_metrics.csv`; asal pemilihannya belum diverifikasi. Istilah tersebut tidak membuktikan probabilitas terkalibrasi. Threshold ini **tidak** dipakai untuk inferensi.

Metrik dihitung ulang dari CSV probabilitas yang dibulatkan empat desimal; ringkasan metrik sumber tidak disalin sebagai hasil hitung. EER webapp menggunakan interpolasi ROC. Selisih EER dengan ringkasan sumber belum diaudit sepenuhnya dan tidak diasumsikan hanya akibat pembulatan. Identitas sampel memakai `rel_path` yang dinormalisasi, bukan basename. Dataset residual tidak digabung dengan populasi evaluasi glotal dan tidak diberi peringkat lintas dataset. Sumber, scope, policy threshold, pengecualian dan SHA-256 masuk laporan JSON.

## Antarmuka dan metrik

- Unggah/drag-drop audio (maksimal 25 MB / 60 detik), pemutar, waveform dan spektrogram.
- Pemilihan model dikelompokkan glotal dan residual/modulasi, dengan status ketersediaan bobot. Maksimum 18 model per request.
- Fitur browser MFCC/LFCC dan pitch autokorelasi bersifat eksploratif. Tidak menjadi input model. Fitur Python masing-masing pipeline tampil terpisah; residual menampilkan 15 fitur residual dan tujuh modulasi, jumlah segmen dan failure rate.
- ROC-AUC, EER interpolasi, accuracy, balanced accuracy, precision/recall/F1 FAKE, MCC, FPR/FNR, average precision, TPR@FPR≤5%, ROC/PR dan confusion matrix.
- Perbandingan berpasangan mensyaratkan sample_id, dataset, seed, label identik. Tidak mengklaim independensi statistik atau generalisasi dari perbedaan skor. CI bootstrap, uji signifikansi, dan t-DCF belum diimplementasikan.
- Ekspor fitur/laporan JSON dan metrik CSV. Contoh sintetis selalu dilabeli. Sesi hanya di memori browser; URL backend tersimpan di localStorage.

CSV impor manual wajib: `sample_id,label,score,model,dataset,threshold`; `seed` opsional. Label 0=REAL, 1=FAKE; skor lebih tinggi berarti FAKE; `score >= threshold` memprediksi FAKE. Threshold tetap per model/dataset/seed. Maksimal 10 MB / 100.000 baris. Nilai undefined tampil `—` dan diekspor null/kosong. EER memakai interpolasi linear ROC saat FPR=FNR.

## API dan hosting

`GET /api/health`, `GET /api/models`, `GET /api/evaluations/{id}`, `POST /api/infer` multipart (`audio`, `model_ids` JSON array). Backend hanya menjalankan satu inferensi pada suatu waktu, request bersamaan menerima 429. CORS dibatasi origin lokal dan Site privat; override `DEEPGUARD_ORIGINS` dengan daftar dipisahkan koma. CORS bukan autentikasi. Deployment remote Python memerlukan HTTPS, autentikasi, batas body dan rate limit.

Hosting Sites hanya menyajikan frontend; untuk inferensi lokal dan hasil penelitian, gunakan localhost server Python di atas. Halaman HTTPS memerlukan backend HTTPS yang dapat dijangkau browser. Tidak ada bobot/data penelitian yang dipublikasikan.

## Pengujian

```bash
npm test
.venv/bin/python -m pip install pytest httpx
.venv/bin/python -m pytest tests/test_api.py -q
```

Pengujian mencakup metrik/CSV/FFT, path repo saudara, inferensi glotal, adapter checkpoint residual dengan fixture sintetis, ekstraktor residual asli, isolasi import, checkpoint hilang, checksum, dan kedua kebijakan threshold evaluasi residual. Selain fixture sintetis, lakukan smoke test inferensi pada semua checkpoint asli setelah bobot ditambahkan atau diganti. Checkpoint XGBoost lama dapat mengeluarkan peringatan serialisasi; kecocokan numerik dengan environment training perlu diverifikasi terpisah.

Checkpoint asli B0–B4/E4a–E4e telah lulus smoke test inferensi bersama delapan model glotal (18 model, cuplikan speech 4 detik). B4 memunculkan peringatan serialisasi XGBoost lama; peringatan ditampilkan bersama prediksi. Tidak ada bobot asli yang dikonversi atau ditimpa.

## Unggah berlabel dan analisis batch (lokal)

Halaman **Analisis batch** menerima banyak file sekaligus, drag/drop, atau folder audio (sesuai dukungan browser). Maksimum 100 file dalam antrean, 25 MB dan 60 detik per file. Pilih model pada halaman **Analisis audio**; daftar ID model disalin saat run dimulai.

Untuk data campuran:

1. Aktifkan **label untuk file yang ditambahkan**, pilih **REAL**, lalu tambahkan file REAL.
2. Ganti pilihan menjadi **FAKE**, lalu tambahkan file FAKE. Label file REAL sebelumnya tetap REAL.
3. Periksa/edit label setiap baris antrean, lalu klik **Jalankan / lanjutkan batch**.

Label tidak pernah diambil otomatis dari nama file/folder dan tidak menjadi input classifier. Label opsional: tanpa label, prediksi tetap berjalan, tetapi file tidak masuk metrik akurasi/AUC/F1. Pada halaman unggah tunggal juga tersedia checkbox label ground truth dan pilihan REAL/FAKE. Mengubah label unggah tunggal membersihkan hasil sebelumnya agar analisis berikutnya memakai metadata label terbaru.

Batch memakai POST `/api/infer` berurutan per file, dengan `model_ids` dan field opsional `ground_truth` (`0` REAL, `1` FAKE). API menolak label di luar 0/1, mengembalikan label sebagai metadata, dan menambahkan `correct` pada prediksi; nilainya `null` untuk abstain/tanpa label. Label tidak dikirim ke fungsi ekstraksi/skoring. Kesalahan satu file dicatat dan batch melanjutkan file berikutnya. Tombol berhenti menunggu request aktif selesai; file yang masih menunggu dapat dilanjutkan. Tombol ulangi mengantrekan kembali file gagal. Mengubah label antrean setelah run membersihkan hasil file itu dan mengantrekannya ulang.

Ringkasan per model mencakup jumlah file dicoba, berprediksi, abstain, error, coverage keseluruhan serta REAL/FAKE, jumlah skor berlabel, accuracy pada sampel lolos, balanced accuracy, AUC dan F1 FAKE. Denominator coverage hanya file yang sudah dicoba pada model tersebut; file pending tidak dimasukkan. File tanpa label ikut coverage keseluruhan tetapi tidak coverage per kelas atau metrik berlabel. Jika hanya satu kelas lolos, AUC/balanced accuracy tidak dihitung. Jika threshold berbeda antarrun, metrik gabungan diblokir; gunakan antrean baru. Abstain tidak diganti menjadi REAL/FAKE dan tidak disembunyikan dari coverage. Aturan trim/jendela glotal tidak berubah.

Hasil tiap file/model bisa difilter dan diekspor sebagai **JSON** / **CSV** (termasuk label, status, skor, threshold, kesesuaian, alasan, SHA-256). Tombol **Buka skor berlabel di Evaluasi** menampilkan ROC/confusion matrix untuk skor yang lolos; provenance tetap mencatat coverage dan pengecualian. Laporan sesi JSON juga menyertakan seluruh ringkasan batch. Sesi/antrean hilang ketika halaman dimuat ulang; ekspor sebelum menutup halaman. Audio tetap di perangkat sampai request lokal per file dikirim dan tidak disimpan sebagai dataset oleh backend.

Setelah memperbarui kode, restart backend dan muat ulang browser agar field label baru dikenali server.
