# DeepGuard — Audio Research Lab

Webapp berbahasa Indonesia yang mengembangkan konsep [DeepGuard Flutter](https://github.com/alvinrw/Deepfake-audio-detection). Referensi diperiksa 20 Oktober 2026: berisi UI Flutter dan rancangan Stitch; laporan mendasarkan keputusan contoh pada nama file (`analysis_report_screen.dart`), tanpa bobot model atau layanan inferensi. Implementasi ini tidak memakai logika simulasi tersebut.

## Menjalankan webapp lengkap

Dari root `speech-deepfake-glottal`:

```bash
python -m venv web-app/.venv
web-app/.venv/bin/pip install -r web-app/requirements-model.txt
python web-app/backend/setup_local.py
web-app/.venv/bin/uvicorn backend.app:app --app-dir web-app --host 127.0.0.1 --port 8000
```

Buka http://127.0.0.1:8000. Backend menyajikan frontend dan API dari origin yang sama. Setup lokal mendaftarkan 8 model LR v5 seed 2026 (MFCC, LFCC, G0–G3, MFCC+G3, LFCC+G3) dan 9 hasil evaluasi asli dari tiga seed dan tiga skenario. Bobot tetap di folder results; tidak disalin ke hosting. Pilih **Muat hasil asli** pada halaman Evaluasi & metrik untuk membaca skor lokal.

Tanpa registry, analisis browser dan evaluasi CSV tetap berfungsi; tidak ada prediksi REAL/FAKE.

Preview frontend mandiri: `npm --prefix web-app run dev` (port 5173). Tidak memerlukan node_modules atau build. Frontend juga diterbitkan privat melalui Sites; backend Python tetap harus di-host terpisah untuk inferensi dari halaman HTTPS.

## Fitur

- Unggah / drag-drop WAV, MP3, FLAC, OGG sesuai dukungan decoder browser; maksimum 25 MB dan 60 detik. WAV/FLAC direkomendasikan untuk backend SoundFile. Kegagalan decode dilaporkan, tanpa hasil buatan.
- Pemutar, waveform amplitudo puncak, spektrogram berbasis FFT, durasi, RMS dBFS, clipping.
- Perbandingan koefisien MFCC/LFCC mean/std dan pitch track autokorelasi eksploratif. Ekspor seluruh fitur JSON.
- Inferensi beberapa model sekaligus melalui API Python; threshold beku, checksum model, proksi fonasi v4/v5, quality gate/abstention, missing feature count, provenance SHA-256 audio/model. Audio upload tidak disimpan ke disk oleh aplikasi.
- Impor skor CSV untuk evaluasi per dataset/model/seed: ROC-AUC, EER interpolasi, accuracy, balanced accuracy, precision, recall, F1 FAKE, MCC, FPR/FNR, AP FAKE, TPR pada FPR ≤5%, ROC/PR dan confusion matrix.
- Analisis kesalahan berpasangan hanya pada sample_id/dataset/seed/label yang identik. Eksplorasi threshold diberi label; tidak menimpa threshold sumber.
- Ekspor metrik CSV dan laporan sesi JSON. Data contoh sintetis dilabeli eksplisit. Sesi berada di memori browser dan hilang saat reload; URL backend disimpan di localStorage.

## Mendaftarkan model terlatih v4/v5

**Repo referensi tidak menyertakan bobot.** Checkout lokal memiliki bundle riset v4/v5 dalam folder results yang diabaikan Git. Setup lokal memakai run v5 `2b3a5cec0fa4dcd9`; skor asli dimuat dari backend, tidak diunggah ke hosting. Scope subset, retained/excluded, seed, run ID dan checksum sumber masuk laporan. Model ONNX/Torch memerlukan adapter khusus; API saat ini mendukung dictionary spesifikasi Joblib v4/v5 proyek lokal.

Gunakan bundle model terlatih yang dipercaya dan **konfigurasi ekstraksi persis dari training**. Versi library harus cocok dengan lingkungan training; gunakan lock environment training untuk model lama. Jangan memuat file Joblib dari unggahan pengguna atau sumber tidak dipercaya karena format ini mengeksekusi kode Python.

```bash
web-app/.venv/bin/python web-app/backend/register_bundle.py \
  --bundle /absolute/path/seed_2026/models_frozen_v5.joblib \
  --config /absolute/path/resolved_config.json \
  --dataset ASVspoof2019_LA --seed 2026 \
  --output web-app/models/registry.json

DEEPGUARD_REGISTRY="$PWD/web-app/models/registry.json" \
  web-app/.venv/bin/uvicorn backend.app:app --app-dir web-app --host 127.0.0.1 --port 8000
```

`--config` menerima YAML atau JSON dengan `features` atau `settings.features`. File registry hanya berisi lokasi lokal, SHA-256, key spec, konfigurasi fitur, family/kind, dataset dan seed. Script mengganti registry output; gunakan output baru untuk mempertahankan registry sebelumnya. Registry dapat menggabungkan entries dari beberapa bundle dengan ID unik. API tidak menerima path model dari browser.

Backend memakai `src.pipeline_v4.features.extract_audio_v4`, orientasi REAL=0/FAKE=1, dan `scores_v4`, dengan adapter score-fusion dan kalibrator v5. Keluarga fitur meliputi MFCC, LFCC, G0–G3 dan fusion sesuai spec dalam bundle. Model dan preprocessing tetap beku. Skor decision function tidak dikonversi menjadi persentase keyakinan.

## CSV evaluasi

```csv
sample_id,label,score,model,dataset,threshold,seed
real_001,0,0.12,MFCC_LR,test_set,0.5,2026
fake_001,1,0.88,MFCC_LR,test_set,0.5,2026
real_001,0,0.20,LFCC_LR,test_set,0.5,2026
fake_001,1,0.80,LFCC_LR,test_set,0.5,2026
```

`seed` opsional; semua kolom lain wajib. Skor finite dan lebih tinggi berarti FAKE. Label hanya 0/1; threshold wajib tetap dalam grup, ditetapkan di train/dev, **bukan dipilih ulang di test**. sample_id harus unik per dataset/model/seed. Maksimum 10 MB / 100.000 baris. Dataset dan seed tidak digabung otomatis. Nilai undefined ditampilkan `—` dan diekspor `null`/kosong. EER dihitung dengan interpolasi linear titik ROC saat FPR=FNR. Precision–recall memakai titik threshold empiris; AP memakai integral stepwise. Backend juga membaca skor long-format v5 langsung melalui registry; perbandingan utama mempertahankan classifier LR. Belum mendukung CI bootstrap, uji signifikansi, atau t-DCF (memerlukan skor sistem ASV dan cost protocol).

## Perbedaan jalur ekstraksi

Browser: decode Web Audio, downmix mono dan resample 16 kHz. Metadata kHz decoder merupakan rate AudioContext, bukan klaim sample rate file asli. FFT 512, Hann 25 ms, hop 10 ms, 40 triangular filter Mel HTK/linear, natural log dan DCT-II c1–c20; subsampling hingga sekitar 400 frame. F0 merupakan proksi autokorelasi 60–400 Hz, threshold korelasi 0,72. Tidak menyediakan jitter/shimmer palsu. FFT/pitch diekstraksi dari sinyal, tidak berdasarkan nama file.

Python: ekstraktor lengkap v4 dengan filter Mel librosa, window seleksi aktif, normalisasi per window, pooling median/IQR/p10/p90, fitur delta dan fonasi Praat sesuai config training. **Fitur browser tidak dipakai untuk input model**. Fitur glotal merupakan proksi fonasi, bukan aliran glotal terukur; bukan bukti definitif keaslian atau atribusi generator.

## API & deployment

- `GET /api/health`, `GET /api/models`, `GET /api/evaluations/{id}`, `POST /api/infer` (multipart: `audio`, `model_ids` JSON array 1–8 ID).
- Backend default bind loopback. Satu inferensi aktif; request lain menerima 429. Ekstraksi berjalan di thread agar API responsif.
- CORS dibatasi origin lokal dan URL Sites ini; override lewat `DEEPGUARD_ORIGINS` dipisahkan koma. CORS bukan autentikasi. Untuk host remote, tambahkan HTTPS, autentikasi, request-body limit dan rate limit di reverse proxy; jangan expose API tanpa kontrol akses.
- Halaman HTTPS memerlukan backend HTTPS yang terjangkau. Menjalankan backend lokal dan membuka localhost adalah cara termudah memakai model lokal. Hosting Sites ini hanya memuat frontend; model Python tidak dijalankan dalam Cloudflare Worker.
- Registry dan audio tidak dipublikasikan. Tidak ada akun/login palsu atau metrik hardcoded sebagai hasil riil.

## Verifikasi

```bash
npm --prefix web-app test
web-app/.venv/bin/pip install pytest httpx
web-app/.venv/bin/python -m pytest web-app/tests/test_api.py -q
```

Test JS meliputi ranking sempurna/terbalik/ties, metrik single-class, parsing/validasi CSV, threshold, alignment sampel berpasangan, FFT, RMS dan pitch sinyal 140 Hz. Test API mencakup validasi input, inferensi adapter model fixture sintetis (bukan model produksi), dan checksum. Browser QA: pemuatan sinyal contoh, analisis fitur, evaluasi sintetis dan navigasi.

Hasil verifikasi implementasi: 9 test JavaScript, 6 test API; 58.368 skor asli seed 2026 / internal LA dicocokkan dengan `metrics_main.csv` untuk AUC, accuracy, balanced accuracy, F1 dan MCC dengan toleransi 1e-10. Inferensi bundle nyata juga diuji pada MP3 demo 60 detik untuk MFCC/LFCC/G3; semua paket yang dicatat training dan hash source ekstraktor cocok. Hasil model pada demo bukan validasi generalisasi atau jaminan label benar.
