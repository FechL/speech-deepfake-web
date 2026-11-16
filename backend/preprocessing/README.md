# preprocessing/

Satu paket mandiri per model, supaya perubahan pada satu model tidak menyentuh yang lain.

```
preprocessing/
├── audio_loading.py   # langkah bersama: file audio -> gelombang mono float + sample rate asli
├── alvin/             # preprocessing Alvin (280 fitur spektral)  -> lihat alvin/README.md
└── fawwas/            # preprocessing + loader model Fawwas       -> lihat fawwas/README.md
```

Alur di `backend/deepguard_engine.py` (`infer_audio`):
1. `load_audio()` (bersama) -> `audio, sample_rate`
2. Model `fawwas*` -> `preprocessing.fawwas.FawwasGlottal.score(...)`
   Model lain -> `preprocessing.alvin.extract_alvin_features(...)`
3. Engine menerapkan threshold dan membentuk respons.

Menambah model baru: buat folder `preprocessing/<nama>/` berisi ekstraktor + README, lalu tambahkan cabang di `infer_audio`.
