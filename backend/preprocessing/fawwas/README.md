# Preprocessing Fawwas (Glottal v8)

| File | Fungsi |
| --- | --- |
| `glottal_features.py` | Ekstraktor fitur (`extract_audio_v4`). Salinan dari `speech-deepfake-glottal/src/pipeline_v4/features.py`; harus identik dengan training |
| `model.py` | `FawwasGlottal`: memuat bundel model, mengubah audio menjadi fitur, memanggil pipeline sklearn; daftar varian `VARIANTS` |

Bundel model: `backend/checkpoints/fawwas/fawwas_glottal_v8_bundle.zip` (seed 2026 dimuat; ubah via env `DEEPGUARD_FAWWAS_SEED`).
Pengaturan ekstraktor dibaca dari `config/features_config.json` di dalam bundel.

## Alur
1. Input dari `audio_loading.load_audio` (mono, sample rate asli).
2. **Center-crop maks. 60 detik** (sama dengan audio ADDITIONAL saat training).
3. Tolak audio kosong/NaN/inf; hitung `clip_fraction` pada sample rate asli; resample ke **16 kHz**; tolak jika hening total.
4. **Trim** hening awal/akhir (`librosa.effects.trim`, 35 dB).
5. **Pemilihan jendela**: jendela 2 detik, hop 1 detik. Gerbang energi: RMS frame 400/160, ambang = persentil-90 dikurangi 30 dB; jendela dipakai jika >= 50% frame aktif. Maks. **6 jendela**, tersebar merata. Jika tidak ada -> error "tidak ada jendela suara yang layak" (audio terlalu pendek/pelan).
6. Per jendela: kurangi mean, skala ke RMS 1, lalu
   * Praat: F0 (60-400 Hz), voiced ratio, CPPS, HNR, jitter/shimmer pada segmen voiced stabil, harmonik (H1-H2, richness)
   * Spektral: MFCC dan LFCC (20 koef., tanpa c0): rata-rata statis, std statis, rata-rata |delta|
   * Fitur residual LPC tidak diekstrak (`extract_prediction=false`)
7. **Pooling antar jendela**: median, IQR, p10, p90 per fitur + kolom QC dan missingness.
8. Ambil kolom varian (`cols` di spesifikasi): 44 (G3) atau 284 (MFCC/LFCC + G3), urutan sesuai bundel.
9. Pipeline tersimpan: imputasi median -> StandardScaler -> SVM / RF / XGBoost -> `predict_proba[:, 1]` = P(FAKE); label FAKE jika >= threshold beku.

## Varian (`VARIANTS` di `model.py`)
`glottal_g3` (SVM, default), `glottal_g3_rf`, `glottal_g3_xgb`, `glottal_mfcc_g3`, `glottal_lfcc_g3`.
Untuk menambah varian, tambahkan entri di `VARIANTS` dengan kunci sistem dari bundel
(mis. `MFCC_LFCC@xgb`), lalu tambahkan labelnya di frontend.

## Catatan
* Mengganti model/bundel: letakkan zip baru di `backend/checkpoints/fawwas/` dan sesuaikan `BUNDLE`/`SEED` di `model.py`.
* Jika ekstraktor di repo training berubah, salin ulang `glottal_features.py` dan latih ulang; hash fitur harus sama.
