# Preprocessing Alvin — alur training, alur web, dan selisihnya

Sumber riset: repo `alvinrw/skripsi_final` (commit `8b6e4a6`), folder `skripsi_residual_modulasi/` (`configs/baseline.yaml`,
`src/audio_io.py`, `spectral_features.py`, `lfcc.py`, `residual_features.py`, `modulation_features.py`,
`extract_features.py`, `train_baseline.py`) dan `checkpoints/README.md`. Repo itu hanya **dibaca**, tidak dijalankan.

Kode web: `features.py` (di folder ini). Checkpoint: `backend/checkpoints/alvin/models_checkpoints_alvin.zip`
(10 berkas `*_seed42.joblib`).

---

## 1. Alur preprocessing saat TRAINING (referensi yang benar)

Semua parameter dari `configs/baseline.yaml` (seed 42, label REAL=0, FAKE=1).

### 1.1 Memuat audio (`audio_io.load_audio`)
1. `librosa.load(path, sr=16000, mono=True)` — resample ke 16 kHz dan mono sekaligus.
2. Tolak jika ada NaN/Inf atau durasi < **1,0 detik**.
3. **Peak normalization** per utterance: `x / max(|x|)` (lantai 1e-6).

### 1.2 Segmentasi (`audio_io.segment_audio`)
* Segmen **2,0 detik**, hop **2,0 detik** (tidak overlap): 32.000 sampel per segmen.
* Jika seluruh audio < 2 detik: di-pad nol menjadi 1 segmen.
* Sisa ekor yang kurang dari 2 detik (jika audio > 2 detik) **dibuang**.
* Audio 60 detik -> 30 segmen.

### 1.3 Fitur per segmen, lalu dirata-rata antar segmen (`np.nanmean`)

| Grup | Dimensi | Resep |
| --- | --- | --- |
| **MFCC** | 240 | `librosa.feature.mfcc`: 20 koef., `n_fft=512`, `hop=160`, `win_length=400`; + `delta` dan `delta2` (default librosa, width 9). Tiap matriks diringkas: mean, std, Q25, Q75 per koefisien (4 x 20 = 80); 3 matriks = 240 |
| **LFCC** | 40 | `scipy.signal.stft` (`nperseg=400`, `noverlap=240`, `nfft=512`) -> daya -> **filterbank segitiga linier 40 filter**, tepi `linspace(0, 8000, 42)` Hz -> `log(x + 1e-8)` -> DCT tipe-2 ortho -> 20 koef. pertama; ringkas mean dan std per koefisien (2 x 20) |
| **Residual LPC** (p=16) | 15 | frame 25 ms / hop 10 ms; per frame: Hamming, lewati jika energi < 1e-8, `librosa.lpc` orde 16, residual = `lfilter(a, [1], frame)`. 5 fitur per frame (energi, entropi Shannon 64-bin, rasio galat prediksi, iregularitas `mean|diff|/std`, kurtosis non-Fisher). Ringkas mean, std, median -> 15 |
| **Modulasi** | 7 | envelope `abs(hilbert(x))` -> lowpass Butterworth orde 4 @ 40 Hz -> `resample_poly` ke 100 Hz -> kurangi mean -> FFT berjendela Hann -> daya 0-20 Hz. 4 energi pita relatif (0,5-2; 2-4; 4-8; 8-20 Hz), centroid, entropi spektral, kedalaman modulasi `std/mean` |

Nama kolom (urutan penting; sama dengan `features` di checkpoint):
`mfcc_{mean,std,q25,q75}_NN`, `mfcc_d1_...`, `mfcc_d2_...`, `lfcc_{mean,std}_NN`,
`res_{energy,entropy,pred_error,irregularity,kurtosis}_{mean,std,median}_p16`,
`mod_band_0.5_2`, `mod_band_2_4`, `mod_band_4_8`, `mod_band_8_20`, `mod_centroid`, `mod_entropy`, `mod_depth`.

### 1.4 Model (`train_baseline.make_pipeline`)
`SimpleImputer(median) -> StandardScaler -> classifier` (scaler hanya difit pada train).
* SVM RBF: `C=10`, `probability=True`, `class_weight="balanced"`
* Random Forest: 200 pohon (`class_weight="balanced"`)
* XGBoost: 200 pohon, depth 6, lr 0,05
* Threshold = **EER dari validation set** (`val_threshold` di checkpoint). Skor = `predict_proba[:, 1]` = P(FAKE).
* Split berdasarkan speaker (GroupShuffleSplit), tanpa kebocoran speaker.

### 1.5 Isi 10 checkpoint

| ID | Algoritma | Grup fitur | Dim. | Threshold |
| --- | --- | --- | --- | --- |
| B0 | SVM | MFCC | 240 | 0.4359 |
| B1 | SVM | LFCC | 40 | 0.3821 |
| B2 | SVM | MFCC+LFCC | 280 | 0.4346 |
| B3 | RF | MFCC+LFCC | 280 | 0.4329 |
| **B4** | XGBoost | MFCC+LFCC | 280 | 0.3793 |
| E4a | SVM | Residual | 15 | 0.4028 |
| E4b | SVM | Modulasi | 7 | 0.4766 |
| E4c | SVM | Residual+Modulasi | 22 | 0.4095 |
| E4d | RF | Residual+Modulasi | 22 | 0.4833 |
| E4e | XGBoost | Residual+Modulasi | 22 | 0.4249 |

---

## 2. Alur di WEB (sudah disamakan dengan training)

Berkas di folder ini: `features.py` (alur + MFCC + LFCC), `residual_features.py` (15 fitur), `modulation_features.py` (7 fitur).

1. `audio_loading.load_audio` memuat audio (native sample rate).
2. `prepare_audio`: mono, resample 16 kHz, tolak NaN/Inf dan durasi < 1 detik, peak normalization.
3. `segment_audio`: segmen 2 detik tanpa overlap (ekor < 2 detik dibuang; audio < 2 detik di-pad nol).
4. Per segmen: MFCC 240, LFCC 40 (40 filter), residual LPC 15, modulasi 7; dirata-rata antar segmen (`nanmean`).
5. `extract_alvin_features` mengembalikan dict 302 fitur bernama. Engine mengambil **kolom sesuai nama** di `features` checkpoint.
   Jika ada kolom yang tidak tersedia, engine melempar error (tidak ada lagi cadangan "ambil N kolom pertama").

## 3. Status perbaikan

| # | Selisih lama | Status |
| --- | --- | --- |
| 1 | E4a-e diberi MFCC, bukan residual/modulasi | **Diperbaiki**: fitur `res_*` dan `mod_*` dihitung, dipilih per nama |
| 2 | LFCC 20 filter | **Diperbaiki**: 40 filter, stft scipy 400/240/512, `log(x+1e-8)` |
| 3 | Tanpa peak normalization | **Diperbaiki** |
| 4 | Tanpa segmentasi 2 detik | **Diperbaiki** |
| 5 | Durasi minimum 0,25 detik | **Diperbaiki**: 1,0 detik |
| 6 | Slider sensitivitas menimpa threshold | Tetap (fitur UI); threshold checkpoint = `checkpointThreshold` di respons |

Verifikasi:
* MFCC dan LFCC web identik dengan re-implementasi independen resep training (korelasi 1,0; selisih 0) pada `data/demo/*.mp3`;
  skor B0/B1/B4 sama persis dengan versi training-style.
* `tests/test_alvin_preprocessing.py`: 302 fitur, semua kolom 10 checkpoint tersedia, invarian skala (peak norm), segmentasi, durasi minimum.
* **Belum terverifikasi numerik**: `residual_features.py` dan `modulation_features.py` ditulis ulang baris per baris dari kode Alvin
  tetapi kode aslinya tidak dijalankan di sini, jadi belum dibandingkan nilai demi nilai. Cara memastikan: jalankan
  `extract_utterance_features` milik Alvin pada satu audio dan bandingkan 22 fitur `res_*`/`mod_*` dengan `extract_alvin_features`.

## 4. Catatan lanjutan
* Demo Alvin (`web_cek/webnya/app.py`) memakai **threshold terkalibrasi** per model (mis. 0,55-0,65) dan mengubah MP3 menjadi WAV
  lewat moviepy. Web ini memakai `val_threshold` dari checkpoint; samakan hanya jika memang diinginkan.
* UI belum menawarkan E4d (Random Forest evidence); tambahkan di `ALVIN_OPTIONS` dan daftar kandidat di `deepguard_engine.py` bila perlu.
