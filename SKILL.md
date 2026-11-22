---
name: deepforensic-web-design
description: Panduan struktur repo, hubungan README dengan tab aplikasi, dan sistem visual terminal DEEPFORENSIC untuk membuat atau mengubah frontend aktif.
---

# DEEPFORENSIC: struktur repo dan desain antarmuka

Gunakan dokumen ini saat membuat, mengubah, atau merapikan web di repositori ini. DEEPFORENSIC adalah alat riset deteksi audio deepfake. Pertahankan istilah dan alur analisis audio yang benar, sambil menjaga skala visual, ruang, artikel Markdown, kartu, dan navigasi konsisten dengan GRAMMAR.LOG. Periksa kode aktif sebelum bekerja karena implementasi adalah sumber kebenaran terakhir.

## Peta repositori dan alur data

| Lokasi | Fungsi dan hubungan |
| --- | --- |
| `README.md` di root | Sumber konten tab `00 / README.md` di aplikasi, sekaligus dokumentasi utama repo. Perubahan berkas ini memengaruhi keduanya setelah Vite membangun ulang. |
| `frontend/src/main.jsx` | Entry point React; memuat CSS global dan merender `App.jsx`. |
| `frontend/src/App.jsx` | Shell halaman, lima tab, renderer README, input Single/Batch, tabel hasil, state tema, keluarga dan ukuran font, serta pemanggilan API. |
| `frontend/src/index.css` | Impor empat font, pilihan `data-font` dan `data-font-size`, reset, dasar body, fokus, seleksi, serta scrollbar komponen. |
| `frontend/src/themes.css` | Nilai warna setiap tema dan token turunan. |
| `frontend/src/App.css` | Layout aktif, tipografi, panel, Markdown, tabel, kontrol, dan media query. |
| `frontend/src/themes.js` | Urutan/nama/mode tema, tiga swatch, serta pilihan keluarga dan ukuran font pada Configuration. ID tema harus cocok dengan selektor di `themes.css`. |
| `frontend/src/analysisCatalog.json` | Katalog model/fitur yang ditampilkan antarmuka. |
| `frontend/src/researchConfigs.js` | Parameter riset read-only pada Configuration. |
| `frontend/src/metrics.js`, `tableSort.js` | Perhitungan metrik dan pengurutan tabel; jangan duplikasi logikanya di komponen. |
| `frontend/vite.config.js` | Build ke `dist/` di root; proxy `/api`, `/detect`, `/health` ke backend lokal port 5001. |
| `backend/server.py` | Server Flask lokal, endpoint analisis dan penyajian build statis. `backend/app.py` juga menyediakan API FastAPI; ikuti jalur yang dijalankan oleh perintah proyek. |
| `backend/preprocessing/`, `backend/checkpoints/` | Pemrosesan audio dan aset model. Perubahan UI tidak boleh mengubah kontrak prediksi secara diam-diam. |
| `tests/`, `run_tests.py` | Uji API, batch, metrik, dan preprocessing. |
| `frontend/src/components/`, `frontend/src/features/` | Sisa iterasi dashboard lama; tidak diimpor oleh entry point aktif. Jangan jadikan glassmorphism dan token lamanya acuan desain aktif. |

Root `package.json` menjalankan `npm run dev`, `npm run build`, dan `npm test`. Dependensi frontend ada di `frontend/package.json`; `npm --prefix frontend run lint` memeriksa frontend. Build Vite menghasilkan `dist/` di root. Untuk pemeriksaan visual, jalankan dev server port 5173 dan uji desktop serta mobile. Analisis sungguhan memerlukan backend dan aset model yang tersedia; kegagalan backend tidak boleh disamarkan sebagai masalah CSS.

### Kontrak README ↔ tab README

`App.jsx` mengimpor `../../README.md?raw`. Fungsi `Readme()` memecah teks pada heading tingkat dua (`## `). Konten utama menjadi artikel kiri. Tiga heading **persis** `## Repositories`, `## Contributors`, dan `## Credits and sources` dipindahkan menjadi kartu sidebar kanan, dalam urutan tersebut. Di viewport ≤900px sidebar berada di atas artikel. Mengganti ejaan heading ini tanpa memperbarui `sidebarTitles` di `Readme()` akan memindahkan konten ke artikel utama atau menghilangkan kartu yang diharapkan.

`MarkdownContent()` adalah renderer Markdown sederhana, bukan parser CommonMark lengkap. Saat ini ia mendukung heading `#`–`###`, paragraf, daftar `- `, daftar bernomor, garis `---`, blok kode berpagar, dan tautan/tebal/kode inline. Daftar harus menjadi blok tersendiri dengan baris kosong sebelum dan sesudah. Bila README memerlukan tabel, gambar, kutipan, atau Markdown bersarang, perluas renderer dan CSS dengan aman sebelum memakai sintaks itu. Jangan salin teks README ke JSX: satu sumber konten harus tetap `README.md`.

Saat memperbarui dokumentasi, cek hasil pada tab README karena berkas yang bagus di GitHub belum tentu terbaca sama oleh renderer sederhana ini. Saat mengubah layout tab README, pertahankan hubungan sumber, pemisahan sidebar, dan urutan DOM yang mendukung mobile.

## Karakter desain

- Antarmuka terminal riset yang padat, tenang, dan mudah dipindai. Identitas `DEEPFORENSIC`, tab bernomor, panel tipis, tabel numerik, dan label singkat. Pertahankan kosakata UI aktif berbahasa Inggris.
- Kanvas mengikuti mode gelap atau terang terpilih dengan radial glow halus di atas. Panel berbeda jelas dari kanvas, border 1px, radius kecil, dan hampir tanpa bayangan. Hindari kartu bulat besar, efek kaca, ilustrasi dekoratif, dan gradient mencolok.
- Warna mendukung makna: cyan untuk tautan/fokus, kuning untuk aksi; warna aksen tema untuk judul utama, hijau untuk REAL/berhasil, merah untuk FAKE/gagal. Status harus selalu tertulis, bukan hanya dibedakan dengan warna.
- Hindari klaim kepastian forensik. Confidence adalah skor kelas prediksi, bukan bukti mutlak.

## Tema dan token

Semua warna komponen berasal dari CSS custom properties. Tema awal `jellybeans` mengikuti palet GRAMMAR.LOG. Nilai default dan peran utama:

| Token | Jellybeans | Peran |
| --- | --- | --- |
| `--bg` | `#151515` | Kanvas, teks tombol solid |
| `--fg` | `#e8e8d3` | Teks isi dan judul |
| `--surface` | `#1c1c1c` | Panel dan kartu |
| `--raised` | `#252334` | Bidang naik, daftar, kepala tabel |
| `--border` | `#3b3b3b` | Garis utama |
| `--muted` | `#adadad` | Keterangan dan metadata |
| `--accent` | `#597bc5` | Tab, border aksi sekunder |
| `--cyan` | `#71b9f8` | Tautan dan fokus |
| `--yellow` | `#d8ad4c` | Tombol utama dan peringatan |
| `--violet` | `#a037b0` | Detail kecil |
| `--red` | `#cf6a4c` | FAKE dan error |
| `--green` | `#99ad6a` | REAL dan berhasil |

`themes.css` mendefinisikan pula `--glow`, `--active-bg`, `--hover-bg`, `--input-bg`, `--soft-border`, `--head-fg`, `--button-text`, dan latar status dengan `color-mix()`. Gunakan token turunan tersebut, bukan warna heksadesimal baru dalam komponen. Configuration membagi 14 palet menjadi **Dark** (Jellybeans, Horizon, Everforest, Ayu Dark, Dracula, Nord, Gruvbox Dark, Solarized Dark, Tokyo Night, Catppuccin Mocha) dan **Light** (Jellybeans Light, Solarized Light, Nord Light, Catppuccin Latte). Nama tema jangan diberi suffix warna seperti `· Red` atau `· Green`. Mode terang menetapkan `color-scheme: light` agar kontrol native sesuai palet; mode gelap menetapkan `color-scheme: dark`.

Tiga swatch di tiap tombol selalu menampilkan nilai CSS **`--accent`, `--cyan`, `--yellow`** dalam urutan itu, bukan pilihan dekoratif yang terpisah. Saat mengubah palet, perbarui nilai pada `themes.css` dan `themes.js` bersama, lalu bandingkan ketiganya untuk setiap ID. ID yang sama di GRAMMAR.LOG harus memakai nilai warna yang sama. Tema, keluarga font, dan ukuran font disimpan terpisah di `localStorage` sebagai `deepguard-theme`, `deepguard-font`, dan `deepguard-font-size`; validasi nilai tersimpan terhadap daftar sebelum dipakai dan gunakan Jellybeans, Geist Mono, serta 100% sebagai fallback.

## Tipografi, ruang, dan panel

- Font default Geist Mono, dengan pilihan **Inter, IBM Plex Mono, dan Source Sans 3** di panel Font family tepat di bawah Color scheme. `index.css` mengimpor semuanya, `data-font` pada `<html>` memilih `--app-font`, dan `body` memakai variabel tersebut. Fallback `monospace` untuk keluarga mono, `sans-serif` untuk keluarga lain. Font pilihan juga berlaku untuk artikel README. Dasar halaman `16px / 1.55`. Judul merek `clamp(28px, 3vw, 38px)` dengan tracking `-.075em`; pada mobile `clamp(21px, 5vw, 28px)`.
- Panel Font size berada tepat setelah Font family, dengan pilihan **90%, 100%, 110%, 120%, 130%**. Default 100%. `data-font-size` pada `<html>` menetapkan `--font-scale` (`.9`, `1`, `1.1`, `1.2`, `1.3`). Kalikan ukuran teks literal `px` dan batas `clamp()` pada CSS aktif dengan skala ini; ukuran berbasis `em`/`inherit` mengikuti induknya. Skala mengubah teks di navigasi, artikel README, kartu, tabel, dan kontrol tanpa memperbesar padding atau dimensi panel. Jangan memakai `zoom` pada seluruh halaman. Bila menambah aturan `font-size` baru, gunakan pola skala yang sama.
- `.workspace` maksimum 1380px, padding desktop `28px 22px 50px`, mobile `22px 12px 35px`. Topbar memiliki padding bawah 22px di desktop, 14px di mobile.
- Tab desktop tingginya minimal 48px dengan padding `10px 17px`, teks 13px, border bawah aktif 2px, dan bidang `--active-bg`. Gap antarpanel 12px.
- `.panel`: border `1px solid var(--border)`, radius 4px, latar `--surface`, `min-width: 0`, overflow tersembunyi. `.panel-head`: padding `12px 16px`, border bawah lembut, judul uppercase 13px/700/tracking `.05em`.
- Tombol utama dan impor minimal 42px, padding `10px 15px`, radius 3px, latar kuning. Tombol sekunder berbatas `--accent`, teks `--cyan`. State fokus keyboard harus jelas.
- Tabel minimal 770px di dalam `.table-scroll`; biarkan scroll horizontal pada layar sempit. Head sticky, teks 10px uppercase, sel 13px dengan padding `10px 13px`. Nilai penting jangan diperkecil menjadi ukuran metadata.
- Scrollbar halaman disembunyikan, tetapi area scroll internal (tabel, antrean, notifikasi, kode) punya scrollbar tipis dengan warna tema. Jangan mematikan kemampuan scroll atau fokus keyboard.

### Artikel dan Markdown

Terapkan gaya `.readme-article` untuk konten Markdown yang dibaca panjang: lebar paragraf mengikuti area artikel penuh (tanpa `max-width` sempit), padding `34px clamp(20px, 4vw, 48px) 44px`, dan pada mobile `24px 20px 34px`. `h1` memakai `--accent` `clamp(24px, 3vw, 36px)` dengan border bawah; `h2` `clamp(19px, 2vw, 24px)` dengan border atas; `h3` cyan 17px. Paragraf 15px/1.9, paragraf pembuka 16px. Daftar 14px/1.75 di bidang `--raised` berbatas tipis; tautan cyan bergaris bawah; kode inline kuning dan blok kode pada bidang naik dengan garis aksen kiri. Teks harus mengalir hingga kanan card tanpa ruang kosong artifisial.

Sidebar README memakai lebar 300px, gap 12px, sticky di desktop. Setiap seksi adalah `.panel` dengan `.panel-head` dan `.readme-side-body` berpadding 16px; isi sidebar 12px/1.65. Pada ≤900px layout satu kolom, sidebar di atas artikel. Jangan menerapkan skala artikel utama pada teks kecil sidebar.

## Sinkronisasi visual dengan GRAMMAR.LOG

Repositori `english-tracker` memakai palet dan kerangka terminal yang sama. Saat pengguna meminta kedua web konsisten, bandingkan **komponen aktif** pada kedua repo, bukan menyalin seluruh halaman. Judul `h1` Markdown di artikel lesson dan README GRAMMAR.LOG serta judul `h1` README DEEPFORENSIC memakai `--accent` tema aktif, ukuran `clamp(24px, 3vw, 36px)`, line-height `1.25`, tracking `-.055em`, margin bawah `31px`, padding bawah `26px`, dan border bawah `--soft-border`. Pertahankan satu aturan judul per jenis konten agar README dan lesson tidak berubah sendiri-sendiri.

Halaman Configuration DEEPFORENSIC menjadi acuan bagi Configuration GRAMMAR.LOG: panel dengan padding 24px (16px pada mobile), heading 22px/1.4, paragraf 14px/1.8, lalu grid tema maksimum 680px, dua kolom dengan gap `4px 12px` dan satu kolom di ≤700px. Kelompok Dark dan Light berada dalam satu panel Color scheme; Font family dan Font size menjadi dua panel berikutnya dengan grid dan ukuran tombol yang sama. Tiap pilihan tema berupa tombol datar 12px dengan padding `9px 10px`, tiga swatch 9px, border transparan, dan tanda ✓ hanya pada pilihan aktif. Pilihan font menampilkan nama, sampel `Aa 0123`, dan tanda ✓; pilihan ukuran menampilkan nama serta persentase. State aktif memakai `--accent` dan `--active-bg`. Urutan, empat font, lima ukuran, 14 palet, dan tiga swatch harus konsisten di kedua web. Teks, kunci penyimpanan, serta fitur riset/grammar tetap sesuai tujuan repo masing-masing.

Jangan menyalin fitur GRAMMAR.LOG yang tidak relevan ke DEEPFORENSIC. Ask Bot di GRAMMAR.LOG saat ini diarsipkan dan tidak ditampilkan; ia bukan bagian dari pola UI DEEPFORENSIC.

## Alur dan pola halaman aktif

1. `00 / README.md`: dokumentasi root menjadi artikel kiri; Repositories, Contributors, Credits and sources menjadi tiga kartu kanan. Pertahankan struktur heading yang diperlukan parser.
2. `01 / Single`: input audio, drag/drop, pemutar, Run/Clear. Tabel prediksi model dan fitur muncul sebagai dua panel berjudul; saat belum ada hasil, nilai `—` menjaga struktur.
3. `02 / Batch Unlabeled`: impor banyak audio, antrean, Run batch/Stop, ringkasan per model, lalu hasil per berkas dalam disclosure `<details>`.
4. `03 / Batch Labeled`: area REAL dan FAKE terpisah, ground truth tiap baris dapat diubah, serta ringkasan metrik Accuracy, Precision, Recall, F1, Balanced acc., AUC, EER, TP/FP/TN/FN. Pisahkan label referensi dari prediksi.
5. `99 / Configuration`: panel Color scheme berisi kelompok Dark dan Light, panel Font family dan Font size setelahnya, lalu panel Research parameters menampilkan parameter riset read-only dua kolom dari `researchConfigs.js`. Jangan menjadikan parameter ini form yang dapat diubah tanpa fitur backend terkait.

Unggahan menerima WAV, MP3, M4A, WEBM, OGG, FLAC sampai 25 MB per berkas dan maksimal 50 item batch. Tampilkan state kosong, siap, berjalan, selesai, error, serta berhenti secara eksplisit. Pencarian dan pengurutan fitur, metrik, tag keputusan, dan aria pada kontrol merupakan bagian dari perilaku yang harus dipertahankan ketika merapikan tampilan.

## Responsif dan aksesibilitas

- Pada ≤900px, artikel README dan konfigurasi menjadi satu kolom. Di README, sidebar masuk sebelum artikel sesuai urutan DOM.
- Pada ≤700px, tab desktop diganti menu daftar penuh. Setelah memilih tab, tampilkan `← Menu` dan nama halaman. Kontrol Single tetap bisa dipakai; slider dan waktu audio boleh disembunyikan untuk memberi ruang.
- Tabel dan antrean tetap dapat digulir. Teks nama berkas yang panjang memakai ellipsis. Form fitur tersusun vertikal pada mobile.
- Pertahankan `role`, `aria-label`, `aria-selected`, `aria-pressed`, `aria-sort`, label input, dan outline fokus. Uji pilihan tema dan font, hover, disabled, hasil, error, serta notifikasi pada desktop dan mobile. Cek kontras teks dan kontrol pada palet gelap maupun terang.

## Langkah kerja dan verifikasi

1. Temukan entry point serta komponen yang benar sebelum mengubah UI. Periksa apakah berkas di `features/` benar-benar dipakai; desain aktif ada di `App.jsx`.
2. Jika mengubah `README.md`, cek struktur heading dan kemampuan `MarkdownContent()`. Untuk konten baru, perbarui README sebagai sumber tunggal, bukan salinan JSX.
3. Gunakan token dan pola panel yang ada. Jika menambah data/API, cek kontrak backend serta kasus loading/error; perubahan visual tidak boleh merusak analisis.
4. Jalankan `npm run build` dan `npm --prefix frontend run lint` untuk perubahan frontend. Jalankan `npm test` saat logika API, batch, atau metrik berubah. Periksa tab README, Single, Batch, Configuration pada desktop serta viewport di bawah 900px dan 700px. Cek sedikitnya Jellybeans, satu palet terang, setiap pilihan font dan ukuran, persistensi setelah reload, pembesaran teks artikel tanpa pembesaran padding panel, serta kecocokan tiga swatch dengan token CSS.
5. Jika struktur repo, parser README, tema, atau sistem visual berubah, perbarui dokumen ini agar tetap sesuai implementasi.
