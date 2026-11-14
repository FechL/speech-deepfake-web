# DeepGuard AI — Forensic Voice Verification Web App

Aplikasi web modern untuk verifikasi forensik audio dan klasifikasi deteksi speech deepfake. Antarmuka menggunakan **UI/UX DeepGuard** (Glassmorphism Cyberpunk) yang telah disetujui, terintegrasi penuh dengan dua mesin model AI utama:

1. **Model Alvin B4 (XGBoost)**: Baseline spektral residual modulasi (280 fitur statistik MFCC & LFCC) untuk deteksi speech deepfake.
2. **Model Fawwas (KNN Forensik)**: Model stabil berbasis K-Nearest Neighbors (204 fitur akustik: MFCC, LFCC, ZCR, RMS, Delta MFCC) untuk deteksi rekaman ulang (*re-recording*) dan keaslian forensik vokal.

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
Mode development Vite secara otomatis melakukan proxy permintaan `/detect` dan `/health` ke backend port 5001.

### 3. Kompilasi Ulang Frontend untuk Produksi

Jika Anda melakukan perubahan kode komponen React di `frontend/src/`:

```powershell
cd frontend
npm run build
```
Hasil build produksi otomatis dikompilasi ke folder `dist/`.

---

## 🧠 Struktur Model & Perannya

| Model | Algoritma | Fitur | Peran Forensik | File Checkpoint |
|---|---|---|---|---|
| **Model Alvin** | XGBoost (B4) | 280 Fitur (MFCC 20 stat + Delta + Delta2 + LFCC 20 mean/std) | Deteksi manipulasi speech deepfake vokal & kloning AI | `backend/checkpoints/alvin/models_checkpoints_alvin.zip` (`B4_seed42.joblib`) |
| **Model Fawwas** | KNN (N=5) | 204 Fitur (MFCC 40 + LFCC 40 + ZCR + RMS + Delta) | Deteksi rekaman ulang (*re-recording*) & anomali akustik forensik | `backend/models/rerec_KNN_N=5.pkl` & `knn_rerec_scaler.joblib` |

Arsip checkpoint Alvin berukuran sekitar 196 MB dan dikonfigurasi menggunakan Git LFS (`.gitattributes`) agar dapat disertakan di GitHub.

Kedua model bekerja secara mandiri. Varian model dipilih dari menu **Pengaturan** dan digunakan pada layar deteksi.

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
| Fawwas KNN N=5 | 0.5000 (50.0%) |
| Fawwas KNN N=3 | 0.5000 (50.0%) |
| Fawwas KNN N=7 | 0.5000 (50.0%) |
| Fawwas Glottal G3 | 0.5000 (50.0%) |
| Fawwas LFCC + Glottal G3 | 0.5000 (50.0%) |

---

## 🎨 Fitur UI/UX (Sesuai Standar Web Disetujui)

- **Authentication Gate**: Halaman Masuk (Login) dan Pendaftaran (Register) dengan validasi akun dan penyimpanan lokal (`localStorage`).
- **Shell Navigasi Responsif**: Sidebar kiri untuk desktop (>650px) dan Bottom Navigation Bar untuk mobile (<=650px).
- **Tema Gelap & Terang**: Dukungan beralih tema Dark/Light mode instan melalui tombol pada header.
- **Bento Grid Dashboard**: Kartu aksi "Mulai Deteksi" beranimasi scanner, kartu statistik total file, dan daftar 5 riwayat analisis terbaru.
- **Metode Input Ganda**: Perekaman mikrofon langsung dengan visualizer gelombang dinamis real-time, atau unggah file audio (WAV, MP3, M4A, FLAC, WebM, OGG).
- **Pemindai Forensik Interaktif**: Tampilan gelombang radar pemindaian, progress bar, dan konsol log elektronik real-time sesuai model yang dipilih.
- **Laporan Forensik Lengkap**: Circular gauge meter persentase keyakinan, badge keamanan (AUTENTIK / TERINDIKASI DEEPFAKE), player gelombang audio, metadata teknis, dan ekspor ringkasan forensik `.txt`.
- **Setelan Analis**: Konfigurasi ID Investigator dan slider sensitivitas threshold keputusan AI (0.05 – 0.95).

---

## 🧪 Pengujian Unit & Verifikasi

Jalankan test suite backend untuk memvalidasi performa kedua model dan endpoint API:

```powershell
python -u run_tests.py
```
Semua 6 pengujian (kesehatan mesin, metadata model, deteksi Model Alvin, deteksi Model Fawwas, validasi format, dan Flask client) dipastikan lulus (*PASS*).
