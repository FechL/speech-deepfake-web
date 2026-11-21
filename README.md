# DeepGuard AI — Forensic Voice Verification Web App

Aplikasi web untuk analisis audio dan deteksi speech deepfake. Antarmuka branch `aliy` memakai tema terminal dengan alur uji satu audio dan batch, terintegrasi dengan dua kelompok model penelitian:

1. **Model Alvin B4 (XGBoost)**: Baseline spektral residual modulasi (280 fitur statistik MFCC & LFCC) untuk deteksi speech deepfake.
2. **Model Fawwas (Glottal v8)**: Model beku hasil pipeline `forensic_reference_glottal_v8` (ASVspoof 2019 LA + ADDITIONAL) yang memakai fitur fonasi glotal G3 (44 fitur) dan fusi dengan MFCC/LFCC; classifier SVM / Random Forest / XGBoost.

---

## 🚀 Cara Menjalankan Aplikasi

Pastikan Python 3.10+ dan Node.js 20+ tersedia pada perangkat Anda.

### 1. Menjalankan Backend (Server API)

Backend menyediakan dua opsi server (keduanya mendukung inferensi Model Alvin & Model Fawwas secara penuh):

**Opsi A (Flask — Port 5001, Rekomendasi Standar UI):**
```powershell
python -m pip install -r requirements.txt
python backend/server.py
```
Backend akan aktif di `http://127.0.0.1:5001`.

**Opsi B (FastAPI / Uvicorn — Port 8000):**
```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```
Backend akan aktif di `http://127.0.0.1:8000` dan langsung menyajikan web UI terkompilasi dari `dist/`.

---

### 2. Menjalankan Frontend (Pengembangan Web)

Frontend berbasis **React + Vite** terletak di dalam folder `frontend/`:

```powershell
cd frontend
npm install
npm run dev
```

Buka `http://127.0.0.1:5173` pada browser Anda.
Mode development Vite secara otomatis melakukan proxy permintaan `/api/analyze`, `/detect`, dan `/health` ke backend port 5001.

### 3. Kompilasi Ulang Frontend untuk Produksi

Jika Anda melakukan perubahan kode komponen React di `frontend/src/`:

```powershell
cd frontend
npm run build
```
Hasil build produksi otomatis dikompilasi ke folder `dist/`.

---

## 📁 Struktur Preprocessing

Preprocessing tiap model berada di paket sendiri dengan README masing-masing:
`backend/preprocessing/alvin/`, `backend/preprocessing/fawwas/`, dan langkah bersama `backend/preprocessing/audio_loading.py`
(lihat `backend/preprocessing/README.md`).

---

## 🧠 Struktur Model & Perannya

| Model | Algoritma | Fitur | Peran Forensik | File Checkpoint |
|---|---|---|---|---|
| **Model Alvin** | XGBoost (B4) | 280 Fitur (MFCC 20 stat + Delta + Delta2 + LFCC 20 mean/std) | Deteksi manipulasi speech deepfake vokal & kloning AI | `backend/checkpoints/alvin/*_seed42.joblib` (10 berkas, langsung di repo) |
| **Model Fawwas** | Glottal v8 (SVM, RF, XGBoost; seed 2026) | 44 fitur glotal G3, atau fusi MFCC/LFCC 240 + G3 (284 fitur) | Bukti fonasi glotal untuk deteksi deepfake | `backend/checkpoints/fawwas/glottal_v8/` |

Semua model sudah ada di repo sebagai berkas biasa (tanpa zip, tanpa Git LFS): cukup `git clone`. Alvin: 10 berkas `*_seed42.joblib` (B3 dan E4d dikompres joblib agar < 100 MB; prediksi identik). Fawwas: `backend/checkpoints/fawwas/glottal_v8/` berisi model beku seed 2026, konfigurasi ekstraktor, dan README; ubah seed dengan env `DEEPGUARD_FAWWAS_SEED` (hanya seed 2026 yang ada di repo). Arsip v6 lama tidak dipakai. Catatan: fitur glotal murni generalisasinya lemah pada data eksternal (AUC MLAAD ≈ 0,54; DF ≈ 0,58) — lihat `glottal_v8/README.md`.

Kedua keluarga model bekerja secara mandiri. Layar analisis baru menjalankan semua checkpoint yang tersedia dan menampilkan hasil per model.

### Referensi Threshold Model

Nilai threshold disimpan di dokumentasi ini sebagai referensi; nilai tersebut tidak ditampilkan pada layar Pengaturan.

| Model | Threshold |
|---|---:|
| Alvin B4 | 0.3793 (37.9%) |
| Alvin B0 | 0.4359 (43.6%) |
| Alvin B1 | 0.3821 (38.2%) |
| Alvin B2 | 0.4346 (43.5%) |
| Alvin B3 | 0.4329 (43.3%) |
| Alvin E4c | 0.4095 (41.0%) |
| Alvin E4a | 0.4028 (40.3%) |
| Alvin E4b | 0.4766 (47.7%) |
| Alvin E4e | 0.4249 (42.5%) |
| Fawwas Glottal G3 · SVM (`glottal_g3`) | 0.3767 |
| Fawwas Glottal G3 · RF (`glottal_g3_rf`) | 0.3567 |
| Fawwas Glottal G3 · XGBoost (`glottal_g3_xgb`) | 0.4474 |
| Fawwas MFCC + G3 · XGBoost (`glottal_mfcc_g3`) | 0.4468 |
| Fawwas LFCC + G3 · XGBoost (`glottal_lfcc_g3`) | 0.4473 |

---

## Terminal analisis (branch `aliy`)

- Tampilan ringkas bertema terminal memakai Geist Mono dengan judul **DEEPGUARD** di atas.
- Dua tab langsung: **Satu audio** dan **Batch**. Format: WAV, MP3, M4A, FLAC, WebM, OGG; maksimum 25 MB per file.
- `POST /api/analyze` menjalankan semua checkpoint Alvin dan Fawwas yang tersedia. Respons berisi prediksi per model, ambang keputusan beku, serta tabel nilai fitur MFCC/LFCC, residual LPC, modulasi, glotal G0/G1/G2, dan QC.
- Jalur Alvin dan Fawwas diekstrak masing-masing satu kali per audio. Jika satu jalur gagal, hasil jalur yang berhasil tetap ditampilkan bersama alasan kegagalannya.
- Pada **Satu audio**, pilihan model pada tabel mengubah keputusan dan confidence utama. Confidence adalah probabilitas kelas hasil model (`P(FAKE)` atau `1-P(FAKE)`), **bukan** kalibrasi kepastian forensik.
- Pada **Batch**, file diproses berurutan dengan status per file, tombol berhenti, dan detail prediksi serta fitur per file. Label asli REAL/FAKE opsional; nama folder `REAL`/`FAKE` terdeteksi otomatis dan bisa diubah. Metrik per model (accuracy, precision, recall, F1, balanced accuracy, AUC, EER, confusion counts) dihitung hanya dari file yang memiliki label asli. Tanpa dua kelas referensi, AUC/EER ditampilkan sebagai tidak tersedia.
- Batch berjalan di browser dan memakai endpoint analisis per file. Hasil batch berada dalam memori tab selama sesi halaman; endpoint ini tidak menambahkan file ke koleksi sampel Flask.

---

## 🧪 Pengujian Unit & Verifikasi

Jalankan test suite backend untuk memvalidasi kedua model dan endpoint API:

```powershell
python -u run_tests.py
```
Metrik batch juga dapat diuji dengan `node tests/terminal_metrics.test.mjs`.
