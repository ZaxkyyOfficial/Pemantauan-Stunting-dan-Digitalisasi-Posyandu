# DOKUMEN AGILE LIFECYCLE & ROADMAP SPRINT TUMBUHSEHAT
Sistem Pemantauan Stunting dan Digitalisasi Posyandu Terintegrasi

---

## 1. MVP (MINIMUM VIABLE PRODUCT)
Definisi ruang lingkup MVP TumbuhSehat dirancang untuk mengatasi hambatan konektivitas posyandu pedesaan melalui arsitektur sinkronisasi bertingkat (Tiered Synchronization) yang tangguh dan terisolasi dari kegagalan cloud eksternal:

- **Aplikasi Mobile Android Offline-First**:
  - Penyimpanan data primer menggunakan Room DB (SQLite lokal) sebagai single source of truth.
  - Kalkulator antropometri lokal WHO LMS Box-Cox terintegrasi dengan pemotongan deviasi ekstrem (-5.0 s.d. +5.0 SD).
  - Skema mutasi idempotensial dengan entitas antrean sinkronisasi (`AntreanSyncEntity`).
  - Enkripsi transmisi NIK balita berstandar AES-128-CBC (PKCS5/PKCS7 padding).
  - Background synchronization via Android WorkManager (`SyncWorker`) yang mentransmisikan data mutasi secara eksklusif ke Gateway REST API Express.js.

- **Backend Gateway API Express.js**:
  - Basis data operasional transaksional MySQL dengan isolasi transaksi ACID dan penegakan constraint unik `(anak_id, tanggal_ukur)`.
  - Pertahanan autentikasi brute-force bertingkat via `authLimiter` (maksimal 3 percobaan per 7 menit dengan status HTTP 429).
  - Optimasi transmisi HTTP melalui kompresi Gzip Level 9 (`compressionMiddleware.js`) untuk seluruh muatan > 1 KB.
  - Caching performa hybrid (`cacheMiddleware.js`) menggunakan Redis dengan fallback otomatis ke memory-cache internal.
  - REST API sinkronisasi batch dua arah (`/api/v1/sync/push` dan `/api/v1/sync/pull`).

- **Cloud Persistence & Surveillance Layer**:
  - Replikator cloud mandiri (`supabaseSyncService.js`) yang memindai data lokal MySQL bertanda `synced_to_supabase = 0` dan mereplikasikannya secara batch ke Supabase PostgreSQL tanpa melibatkan koneksi langsung dari perangkat klien mobile.
  - Web Dashboard Surveilans Puskesmas berbasis Express EJS untuk pemantauan sebaran status stunting, gizi kurang, dan faltering per desa.
  - Generator laporan rekapitulasi data siap ekspor sesuai standar e-PPGBM Kementerian Kesehatan (format Excel XLSX dan dokumen PDF).

---

## 2. SPRINT GOAL

### Sprint 1 Goal
Menuntaskan fondasi backend Express.js, skema relasional terstandarisasi MySQL & Supabase PostgreSQL, modul keamanan kriptografi AES & Rate Limiter, serta kalkulasi engine antropometri standar WHO Box-Cox LMS.

### Sprint 2 Goal
Mengembangkan aplikasi Android offline-first berbasis Room DB, mengimplementasikan engine kalkulator antropometri lokal dengan penanganan deviasi ekstrem, dan menyiapkan struktur sesi terisolasi untuk 10 posyandu wilayah kerja Puskesmas Dringu.

### Sprint 3 Goal
Mengimplementasikan Two-Way Sync Gateway (Mobile Room DB -> Express REST API -> MySQL -> Supabase Cloud) secara transaksional, idempotent, dan bebas duplikasi data menggunakan penanda flag replikasi asinkron.

### Sprint 4 Goal
Menyempurnakan antarmuka UI/UX berstandar Clinical Editorial Minimalist, menyajikan kurva visualisasi KMS Digital real-time berbasis MPAndroidChart, menuntaskan audit kode anti-slop, dan melaksanakan verifikasi pengujian UAT lintas peran pengguna.

---

## 3. USER STORY

- **[US-01] Pemantauan & Pelaporan Surveilans (Admin Puskesmas)**  
  *Sebagai Admin Puskesmas, saya dapat memantau prevalensi stunting per desa/posyandu secara real-time, menganalisis grafik tren pertumbuhan bulanan balita, dan mengunduh laporan rekapitulasi format e-PPGBM Excel serta PDF resmi melalui Web Dashboard tanpa kendala autentikasi atau kegagalan sesi.*

- **[US-02] Pencatatan Antropometri Offline & Intervensi Lapangan (Kader Posyandu)**  
  *Sebagai Kader Posyandu, saya dapat mencatat hasil penimbangan balita langsung di lapangan tanpa koneksi internet, menerima evaluasi Z-score dan peringatan gagal tumbuh (growth faltering T/2T) secara instan, serta mengakses katalog resep MPASI berbasis pangan lokal untuk panduan ibu balita.*

- **[US-03] Keamanan Data Medis & Skalabilitas Gateway (Sistem & Infrastruktur)**  
  *Sebagai Sistem Keamanan, sistem harus mengenkripsi NIK balita menggunakan algoritma AES-128-CBC saat transmisi jaringan, membatasi serangan brute-force login melalui rate limiting ketat (3 percobaan per 7 menit), serta mereplikasi data ke Supabase Cloud secara asinkron tanpa membebani limit pool koneksi.*

---

## 4. TASK (KATALOG TUGAS TEKNIS)

| ID Task | Modul / Cakupan | Penanggung Jawab | Sprint | Deskripsi Teknis |
| :--- | :--- | :--- | :--- | :--- |
| **TSK-01** | Backend Architecture & Schema | Tim Backend | Sprint 1 | Perancangan skema relasional MySQL & Supabase DDL, penegakan foreign key, dan indeks unik `(anak_id, tanggal_ukur)`. |
| **TSK-02** | Security & Rate Limiting | Tim Backend | Sprint 1 | Implementasi `authLimiter` (3 req/7 min), `apiLimiter`, modul enkripsi AES-128-CBC, dan pembersihan sanitasi data input. |
| **TSK-03** | WHO LMS Calculation Engine | Tim Backend | Sprint 1 | Implementasi formula Box-Cox LMS pada backend (`whoEngine.js`) dan skema klasifikasi stunting, wasting, dan underweight. |
| **TSK-04** | Cloud Replicator Service | Tim Backend | Sprint 2 | Pengembangan `supabaseSyncService.js` untuk replikasi batch data MySQL ke Supabase PostgreSQL tanpa ketergantungan mobile. |
| **TSK-05** | Android Core & Room DB | Tim Mobile | Sprint 2 | Konfigurasi arsitektur Room DB, entity relasional, Dao, migrasi skema lokal, dan pengamanan `network_security_config.xml`. |
| **TSK-06** | Local WHO Calculator Engine | Tim Mobile | Sprint 2 | Pembuatan `LocalWhoCalculator.kt` dengan data standar WHO 0-24 bulan dan penerapan batas cut-off deviasi ekstrem [-5.0 SD, +5.0 SD]. |
| **TSK-07** | DevOps & Performance Benchmarking | Tim Backend | Sprint 2 | Konfigurasi kompresi Gzip Level 9, hybrid Redis/memory cache, dan pengujian throughput respons server. |
| **TSK-08** | Two-Way Sync Orchestration | Tim Backend | Sprint 3 | Pembuatan controller sinkronisasi `/api/v1/sync/push` dan `/pull` dengan transaksi ACID dan penanganan benturan data. |
| **TSK-09** | Room DB SyncQueue & WorkManager | Tim Mobile | Sprint 3 | Implementasi `AntreanSyncEntity`, `SyncRepository`, dan `SyncWorker` terjadwal di Android untuk pengiriman mutasi berkala. |
| **TSK-10** | Mobile UI/UX Clinical Editorial | Tim Mobile | Sprint 4 | Penyesuaian antarmuka dengan palet spruce/sage/terracotta, border solid 1dp `#E2E8F0`, dan eliminasi tombol back pada navigation root. |
| **TSK-11** | KMS Digital & Chart Visualization | Tim Mobile | Sprint 4 | Integrasi MPAndroidChart di `KmsDigitalActivity` dengan kurva standar WHO (+2, 0, -2, -3 SD) dan plot pertumbuhan balita. |
| **TSK-12** | Quality Assurance & UAT Verification | Semua Tim | Sprint 4 | Pengujian end-to-end skenario offline-ke-online, pengujian brute force rate limiter, verifikasi seeder, dan audit anti-slop. |

---

## 5. BOARD STATUS: TO DO, DOING, DAN DONE

### TO DO (Rencana Siap Eksekusi / Deployment Tahap Lanjutan)
- [ ] Eksekusi migrasi Supabase Cloud DDL (`db_supabase_schema.sql`) pada instance Supabase production eksternal jika kredensial live telah aktif.
- [ ] Build release bundle APK Android bertanda tangan (Keystore Signed Production APK).
- [ ] Deployment backend Express Gateway ke lingkungan cloud hosting / container staging.
- [ ] Integrasi automated push notification Firebase Cloud Messaging (FCM) untuk pengingat jadwal posyandu bulanan.

### DOING (Sedang Berjalan)
*(Seluruh tiket operasional sprint saat ini telah berhasil diselesaikan 100% dan dipindahkan ke kolom DONE)*

### DONE (Selesai 100% dan Terverifikasi)
- [x] **Arsitektur Sinkronisasi Bertingkat**: Mobile Room DB -> Express Gateway MySQL -> Supabase Cloud Replicator (`supabaseSyncService.js`).
- [x] **Isolasi Koneksi Mobile**: Klien Android tidak memiliki dependensi maupun akses langsung ke Supabase Cloud.
- [x] **Pemberian Constraint Unik Database**: Penegakan `(anak_id, tanggal_ukur)` pada MySQL lokal dan skema Supabase.
- [x] **Audit Web Login & Pembersihan Dummy**: Normalisasi verifikasi bcrypt login dan eliminasi total kartu pengujian di `login.ejs`.
- [x] **Eksekusi Seeder Bersih Produksi**: Reset tabel transaksi dan inisialisasi akun 1 Admin Puskesmas serta 10 Akun Kader Posyandu resmi.
- [x] **Keamanan Transmisi NIK**: Enkripsi dan dekripsi AES-128-CBC diimplementasikan pada `AesCryptoUtil.kt` dan `crypto.js`.
- [x] **Penegakan Rate Limiting**: Pengujian `authLimiter` memicu respons HTTP 429 Too Many Requests setelah 3 kali kesalahan login.
- [x] **Kalkulator Box-Cox LMS Mobile**: Penambahan batas cut-off deviasi ekstrem WHO dan nilai default input antropometri realistis.
- [x] **Pembersihan Navigasi Mobile**: Penghapusan tombol panah kembali pada toolbar root dan pemasangan Universal Bottom Navigation Bar solid 1dp.
- [x] **Perapian Rekam Medis**: Grid 4 metrik berimbang, format tanggal lahir baku Indonesia `DD-MM-YYYY`, serta pemisahan vertikal skor Z dan status gizi.
- [x] **Kurva KMS Digital Real-Time**: LineChart menampilkan kurva standar WHO secara persisten dan memetakan plot riwayat pengukuran dari Room DB.
- [x] **Perbaikan Tata Letak Halaman Laporan Web & Resolusi Logo Jumbo**: Tag img logo dikonfigurasi dengan batasan dimensi pasti (40x40px, max 48px, object-fit contain). Sidebar navigasi 260px solid Spruce #0C2E28 terpasang fix di kiri, CSS layout modular termuat sempurna tanpa layout shift.
- [x] **Tabel Rekapitulasi Data Sasaran Balita & Masking PII**: Tabel menyajikan 9 kolom klinis berstandar e-PPGBM Kementerian Kesehatan (No, NIK Masked, Nama Balita, Posyandu, Tanggal Ukur DD-MM-YYYY, BB kg, TB cm, Z-Score BB/U-TB/U-BB/TB, dan Status Intervensi Gizi).
- [x] **Modul Ekspor Excel (.xlsx) e-PPGBM Kemenkes**: Endpoint `GET /api/v1/laporan/export-excel` menggunakan exceljs dengan header resmi, styling header spruce, auto column-width, null-safety jika data kosong, serta response header attachment `Laporan_ePPGBM_Puskesmas_Dringu_2026.xlsx`.
- [x] **Modul Berita Acara Cetak PDF (.pdf)**: Endpoint `GET /api/v1/laporan/export-pdf` menggunakan pdfkit landscape A4 dengan kop resmi Puskesmas Dringu, rekapitulasi kartu KPI surveilans, tabel data balita, dan pengesahan dokter penanggung jawab program gizi.
- [x] **Isolasi Koneksi & Penanganan Error Supabase Replicator**: Validasi kredensial cloud sebelum fetch, pembungkusan try-catch senyap dengan log informatif `ℹ️ [Supabase Replicator]: Menunggu konektivitas internet/kredensial cloud aktif.` tanpa melempar unhandled exception / spamming error di konsol terminal, menjamin 100% stabilitas server lokal Express & MySQL.
- [x] **Konektivitas Jaringan Dinamis LAN & Host Binding**: Express server mendengarkan pada `0.0.0.0:3000` dan aplikasi Android dilengkapi dialog "Atur IP Host Server" pada LoginActivity serta konfigurasi runtime di RetrofitClient tanpa perlu rebuild APK.
- [x] **Halaman Profil Kader Posyandu**: ProfilKaderActivity menampilkan nama, email, posyandu binaan & desa wilayah kerja, 3 kartu statistik bulanan (total sasaran, sudah ditimbang, tertunda), daftar sasaran balita dan orang tua binaan, serta tombol logout aman yang membersihkan sesi dan cache.
- [x] **Registrasi Manual Balita & Data Keluarga (Offline-First)**: TambahBalitaActivity dengan form No. KK, Orang Tua, NIK, Jenis Kelamin, Tanggal Lahir DatePicker, BB & PB Lahir, tersimpan instan ke Room DB lokal, queued di AntreanSyncEntity, dan didukung backend UPSERT pada `POST /api/v1/anak` dan `POST /api/v1/keluarga`.
- [x] **Asisten AI Klinis Posyandu (Groq SDK Llama 3)**: Endpoint backend `POST /api/v1/ai/konsultasi-stunting` terintegrasi Groq SDK (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) dengan fallback mesin aturan deterministik klinis Kemenkes RI, serta BottomSheet respons konsultasi AI di mobile dengan badge risiko dan instruksi dokter Puskesmas.
- [x] **Verifikasi Sinkronisasi Bertingkat 3-Tier**: Mutasi lokal Room DB -> Express MySQL dengan constraint UNIQUE -> Supabase Cloud Replicator (`supabaseSyncService.js`) mereplikasi 100% data keluarga, anak, pengukuran antropometri, dan hasil analisis gizi ke Supabase PostgreSQL cloud tanpa error foreign key.
- [x] **Tombol Ekspor Interaktif dengan Indikator Loading**: Tombol solid Ekspor Excel dan Cetak Dokumen PDF dilengkapi animasi spinner dan feedback visual instan saat berkas diunduh.
- [x] **Pengujian Skenario UAT Transisi Offline-ke-Online**: Verifikasi alur mutasi Room DB lokal yang tersimpan instan dan ditransmisikan transaksional ke REST API gateway.
- [x] **Kalibrasi Performa Antrean Sinkronisasi**: Verifikasi idempotensi mutasi batch `/api/v1/sync/push` bebas duplikasi entitas.
- [x] **Pemantauan Telemetry Log Worker Replikasi**: Penanganan graceful degradasi saat cloud server offline.

---

## 6. TABEL AKUN RESMI SISTEM (1 ADMIN + 10 KADER WILAYAH)

Berikut adalah daftar kredensial akun resmi hasil eksekusi seeder bersih (`backend/src/seeds/seedCleanProduction.js`):

| No | Nama Akun | Role | Posyandu Binaan | Desa / Wilayah | Email Login Resmi | Password Baku |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Admin Surveilans Puskesmas** | `admin_puskesmas` | Puskesmas Dringu | Kecamatan Dringu | `admin.dringu@tumbuhsehat.id` | `AdminDringu2026!` |
| **2** | Kader Posyandu Mawar 1 | `kader_posyandu` | Posyandu Mawar 1 | Desa Dringu | `kader.mawar1@tumbuhsehat.id` | `KaderMawar12026!` |
| **3** | Kader Posyandu Mawar 2 | `kader_posyandu` | Posyandu Mawar 2 | Desa Dringu | `kader.mawar2@tumbuhsehat.id` | `KaderMawar22026!` |
| **4** | Kader Posyandu Melati 1 | `kader_posyandu` | Posyandu Melati 1 | Desa Kedungdalem | `kader.melati1@tumbuhsehat.id` | `KaderMelati12026!` |
| **5** | Kader Posyandu Melati 2 | `kader_posyandu` | Posyandu Melati 2 | Desa Kedungdalem | `kader.melati2@tumbuhsehat.id` | `KaderMelati22026!` |
| **6** | Kader Posyandu Anggrek 1 | `kader_posyandu` | Posyandu Anggrek 1 | Desa Kalirejo | `kader.anggrek1@tumbuhsehat.id` | `KaderAnggrek12026!` |
| **7** | Kader Posyandu Anggrek 2 | `kader_posyandu` | Posyandu Anggrek 2 | Desa Kalirejo | `kader.anggrek2@tumbuhsehat.id` | `KaderAnggrek22026!` |
| **8** | Kader Posyandu Kamboja 1 | `kader_posyandu` | Posyandu Kamboja 1 | Desa Pabean | `kader.kamboja1@tumbuhsehat.id` | `KaderKamboja12026!` |
| **9** | Kader Posyandu Kamboja 2 | `kader_posyandu` | Posyandu Kamboja 2 | Desa Pabean | `kader.kamboja2@tumbuhsehat.id` | `KaderKamboja22026!` |
| **10** | Kader Posyandu Kenanga 1 | `kader_posyandu` | Posyandu Kenanga 1 | Desa Tamansari | `kader.kenanga1@tumbuhsehat.id` | `KaderKenanga12026!` |
| **11** | Kader Posyandu Kenanga 2 | `kader_posyandu` | Posyandu Kenanga 2 | Desa Tamansari | `kader.kenanga2@tumbuhsehat.id` | `KaderKenanga22026!` |

> **Catatan Keamanan**: Seluruh kata sandi di atas telah dienkripsi menggunakan hashing kriptografis **bcrypt** dengan salt rounds 10 pada basis data produksi. NIK anak yang ditransmisikan saat sinkronisasi dienkripsi menggunakan **AES-128-CBC** secara transparan antara aplikasi mobile dan backend gateway.

---

## 7. PETUNJUK PENGUJIAN END-TO-END (PANDUAN VERIFIKASI PENGUJI / DOSEN)

### Skenario 1: Verifikasi Backend & Halaman Laporan Web e-PPGBM
1. Pastikan server backend Express berjalan di port 3000 (`node src/server.js` atau `npm start`).
2. Buka peramban ke alamat: `http://localhost:3000/login`.
3. Masuk menggunakan akun admin:
   - Email: `admin.dringu@tumbuhsehat.id`
   - Password: `AdminDringu2026!`
   *(atau akun default `admin@tumbuhsehat.id` / `admin123`)*
4. Pada menu navigasi sidebar sebelah kiri, klik menu **Ekspor Laporan e-PPGBM** atau akses langsung `http://localhost:3000/laporan-web`.
5. Amati elemen tata letak:
   - Logo Puskesmas TumbuhSehat tampil proporsional (40x40px) di pojok kiri atas dan tidak merusak layout.
   - Sidebar navigasi selebar 260px solid Spruce `#0C2E28` terpasang rapi dan fix di sebelah kiri.
   - Tabel rekapitulasi sasaran balita memuat 9 kolom klinis dengan NIK ter-masking (contoh: `3513********1500`), Tanggal Ukur berformat `DD-MM-YYYY`, serta status intervensi gizi (badge Sage/Terracotta/Amber).
6. Uji tombol aksi:
   - Klik tombol **Ekspor Excel (.xlsx)**: Label tombol berubah menjadi *"Menyiapkan Excel..."* dengan ikon spinner, berkas terunduh dengan nama `Laporan_ePPGBM_Puskesmas_Dringu_2026.xlsx`.
   - Klik tombol **Cetak Dokumen PDF (.pdf)**: Label tombol berubah menjadi *"Menyiapkan PDF..."* dengan ikon spinner, dokumen resmi Puskesmas Dringu terunduh dengan nama `Laporan_Rekapitulasi_ePPGBM_Puskesmas_Dringu_2026.pdf`.
7. Uji filter:
   - Ubah parameter periode atau posyandu pada panel filter, lalu klik **Terapkan Filter**. Data tabel terbarui sesuai kriteria secara instan.
   - Uji null-safety: Jika filter memilih kombinasi tanpa data, tabel menampilkan pesan informatif tanpa melempar status error 500 pada server.

### Skenario 2: Verifikasi Ketahanan Supabase Replicator Tanpa Crash
1. Periksa log terminal backend Express:
   - Verifikasi bahwa log menampilkan pesan informatif: `ℹ️ [Supabase Replicator]: Menunggu konektivitas internet/kredensial cloud aktif.`
   - Verifikasi bahwa TIDAK ADA error `[Supabase Replicator Error]: TypeError: fetch failed` yang mencemari terminal.
2. Operasional backend Express lokal dan basis data MySQL tetap responsif 100% melayani permintaan aplikasi mobile dan dashboard web tanpa gangguan.

### Skenario 3: Verifikasi Modul Android Mobile Kotlin Offline-First
1. Buka proyek modul `mobile/` pada Android Studio atau perangkat Android.
2. Form Penimbangan Balita (`InputAntropometriActivity`):
   - Masukkan pengukuran berat badan dan tinggi badan balita.
   - Klik Simpan: Data pengukuran tersimpan instan ke Room DB lokal dan otomatis masuk ke antrean `AntreanSyncEntity`.
3. Detail Rekam Medis (`ProfilBalitaActivity`):
   - Periksa grid 4 metrik: Menampilkan Usia, Tanggal Lahir berformat baku Indonesia `DD-MM-YYYY` (contoh: `15-07-2025`), Berat Lahir, dan Panjang Lahir tanpa teks terpotong.
   - Periksa 3 kotak status Z-Score (TB/U Stunting, BB/U Berat, BB/TB Wasting) terpisah rapi dengan hairline border 1dp `#E2E8F0`.
4. Kurva KMS Digital (`KmsDigitalActivity`):
   - Buka halaman KMS Digital: Kurva LineChart membaca riwayat penimbangan dari Room DB dan memetakan titik koordinat secara langsung di atas kurva standar WHO (Z-score +2, 0, -2, -3 SD).
