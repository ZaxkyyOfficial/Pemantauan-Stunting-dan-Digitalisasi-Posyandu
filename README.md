# TumbuhSehat: Sistem Surveilans Stunting & Digitalisasi Posyandu Terintegrasi

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Android](https://img.shields.io/badge/Android-Kotlin_Native-3DDC84?logo=android&logoColor=white)](https://developer.android.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq_AI-Llama_3.3_70B-F55036?logo=fastapi&logoColor=white)](https://groq.com/)

**TumbuhSehat** adalah platform ekosistem kesehatan digital berbasis *Three-Tier Synchronized Architecture* yang dirancang untuk mengatasi kesenjangan konektivitas internet pada posyandu pedesaan. Sistem ini mengintegrasikan aplikasi mobile lapangan berorientasi *offline-first* bagi kader posyandu dengan portal web surveilans epidemiologis bagi Puskesmas serta dinas kesehatan.

---

## 1. Tentang Aplikasi & Platform Web

TumbuhSehat menyelesaikan kendala pencatatan manual buku KIA yang lambat dan rentan inkonsistensi deviasi antropometri balita. Platform ini terdiri dari dua komponen utama:

1. **Aplikasi Mobile Lapangan (Android Native Kotlin)**:
   - Beroperasi secara penuh tanpa koneksi internet (*offline-first*) menggunakan penyimpanan basis data SQLite Room.
   - Dilengkapi *engine* antropometri baku Box-Cox LMS standar WHO ($Z$-score BB/U, TB/U, BB/TB) dengan batasan matematis $[-5.0\text{ SD}, +5.0\text{ SD}]$.
   - Visualisasi pertumbuhan riil kurva persentil KMS Digital (MPAndroidChart).
   - Layanan asisten klinis AI berbasis Groq (LLaMA 3.3 70B) untuk rekomendasi intervensi pangan lokal dan penentuan rujukan Puskesmas saat terjadi *growth faltering*.

2. **Web Portal Surveilans Puskesmas (Express.js & EJS)**:
   - Dasbor analitik prevalensi stunting, *wasting*, dan *underweight* per posyandu dan per desa.
   - Modul ekspor laporan otomatis berstandar impor e-PPGBM Kementerian Kesehatan (format Excel `.xlsx` dan Dokumen Berita Acara Resmi `.pdf`).
   - Sistem replikasi data asinkronus ke Supabase Cloud PostgreSQL dengan enkripsi NIK AES-128-CBC dan perlindungan *Row Level Security* (RLS).

---

## 2. Tujuan & Manfaat Sistem

### Tujuan
- Menghilangkan *human-error* kader posyandu dalam plotting manual grafik KMS dan perhitungan umur kronologis anak.
- Menyediakan arsitektur sinkronisasi toleran jaringan (*fault-tolerant*) yang menjamin tidak adanya data hilang saat kader beroperasi di area *blank spot*.
- Menyediakan instrumen audit surveilans epidemiologis yang siap diserahkan ke Dinas Kesehatan secara berkala.

### Manfaat
- **Bagi Kader Posyandu**: Mempercepat proses pencatatan meja penimbangan dari rata-rata 5-7 menit per balita menjadi kurang dari 1 menit.
- **Bagi Tim Medis Puskesmas**: Mendeteksi secara dini kasus gagal tumbuh (*growth faltering*) sebelum balita jatuh ke kondisi *severe stunting*.
- **Bagi Pemerintah Daerah / Dinas Kesehatan**: Menyajikan data cakupan penimbangan yang valid, terverifikasi secara kriptografis, dan bebas manipulasi.

---

## 3. Tim Pengembang & Peran Kontributor

Proyek ini dikembangkan secara kolaboratif dengan pemisahan tanggung jawab berbasis siklus Agile Sprint:

| Nama Pengembang | Peran & Modul Utama | Kontribusi Git / Fitur |
| :--- | :--- | :--- |
| **Zaky (ZaxkyyOfficial)** | Architecture, Mobile Core & DevOps | Android Room DB, Network Cleartext LAN, WHO Box-Cox Kotlin Engine, Groq AI Integration |
| **Lana & Romiz** | Backend Core & Database Architecture | Express REST Gateway, MySQL Pooling, Supabase Cloud Replicator, Seeder Akun Resmi |
| **Esy (esyauliatria)** | Synchronization Logic Specialist | Two-Way Sync Batch API, Android WorkManager (`SyncWorker`), Idempotency Mutation Queue |
| **Aldo** | UI/UX Clinical Editorial & Reporting | MPAndroidChart KMS Digital, e-PPGBM Excel/PDF Generator, Standar UI Clinical Minimalist |

---

## 4. Arsitektur Teknis (Three-Tier Sync Gateway)

```
[ Android Mobile (Room DB) ]
             │
             ▼ (HTTP REST / AES-128 Encrypted Payload / LAN)
[ Express.js Gateway (0.0.0.0:3000) ] ◄───► [ MySQL Transaksional ]
             │
             ▼ (Asynchronous Batch Replication / Service Key)
[ Supabase Cloud (PostgreSQL with RLS) ]
```

---

## 5. Petunjuk Instalasi & Menjalankan Sistem

### Kebutuhan Lingkungan (Prerequisites)
- **Node.js**: versi 18.x atau lebih baru
- **MySQL Server**: versi 8.0.x (disarankan XAMPP atau MySQL Workbench)
- **Android Studio**: Ladybug / Hedgehog dengan Android SDK Platform 34
- **Perangkat Fisik Android**: Android 8.0 (Oreo) ke atas
- **Koneksi Jaringan**: Komputer server dan HP Android berada dalam satu jaringan Wi-Fi / Hotspot yang sama

---

### Langkah 1: Persiapan Basis Data MySQL Lokal
1. Pastikan servis MySQL aktif (misalnya melalui XAMPP Control Panel).
2. Buat basis data bernama `db_posyandu_stunting`:
   ```sql
   CREATE DATABASE db_posyandu_stunting;
   ```
3. Impor skema tabel awal dari berkas `db_posyandu_stunting.sql`.

---

### Langkah 2: Konfigurasi & Menjalankan Backend Express

1. Masuk ke direktori backend:
   ```bash
   cd backend
   ```
2. Pasang pustaka dependensi:
   ```bash
   npm install
   ```
3. Salin berkas lingkungan dan sesuaikan variabel koneksi:
   ```bash
   cp .env.example .env
   ```
   *Konfigurasi isi `.env`:*
   ```env
   PORT=3000
   NODE_ENV=development

   # Database MySQL
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=db_posyandu_stunting

   # JWT & Security
   JWT_SECRET=tumbuhsehat_supersecret_key_2026
   JWT_EXPIRES_IN=24h
   CRYPTO_SECRET_KEY=TumbuhSehatSecretKey16B
   CRYPTO_IV=TumbuhSehatIV16B!

   # Supabase Cloud Replicator
   SUPABASE_URL=https://kdgxbwxphzpvmsmzlutt.supabase.co
   SUPABASE_KEY=sb_publishable_FMKD13g-D8jSeb1mZtW...
   SUPABASE_SYNC_INTERVAL_MS=300000

   # Groq AI Service
   GROQ_API_KEY=gsk_...
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
4. Jalankan seeder akun resmi:
   ```bash
   node src/seeds/seedCleanProduction.js
   ```
5. Buka port firewall Windows (Jalankan PowerShell Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "NodeJS Backend 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
6. Jalankan server backend:
   ```bash
   npm run dev
   ```
   *Server akan aktif pada `http://0.0.0.0:3000`.*

---

### Langkah 3: Konfigurasi & Menjalankan Aplikasi Android

1. Buka folder `mobile/` menggunakan **Android Studio**.
2. Periksa alamat IP laptop server Anda melalui terminal:
   ```cmd
   ipconfig
   ```
   *(Contoh: IPv4 Wi-Fi menunjukkan `10.172.79.234` atau `192.168.100.199`)*.
3. Sinkronkan Gradle (`Sync Project with Gradle Files`).
4. Hubungkan perangkat HP fisik melalui USB Debugging atau Wi-Fi Pairing.
5. Jalankan aplikasi (*Run 'app'*).
6. Pada layar login aplikasi, ketuk tombol **Atur IP Host Server**, masukkan alamat IP laptop hasil `ipconfig`, lalu simpan.

---

## 6. Tabel Akun Resmi Sistem (Produksi)

| No | Peran / Jabatan | Wilayah Binaan | Email Akses | Kata Sandi |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Admin Puskesmas (Web)** | Kecamatan Dringu | `admin.dringu@tumbuhsehat.id` | `AdminDringu2026!` |
| **2** | Kader Posyandu Mawar 1 | Desa Dringu | `kader.mawar1@tumbuhsehat.id` | `KaderMawar12026!` |
| **3** | Kader Posyandu Mawar 2 | Desa Dringu | `kader.mawar2@tumbuhsehat.id` | `KaderMawar22026!` |
| **4** | Kader Posyandu Melati 1 | Desa Kedungdalem | `kader.melati1@tumbuhsehat.id` | `KaderMelati12026!` |
| **5** | Kader Posyandu Melati 2 | Desa Kedungdalem | `kader.melati2@tumbuhsehat.id` | `KaderMelati22026!` |
| **6** | Kader Posyandu Anggrek 1 | Desa Kalirejo | `kader.anggrek1@tumbuhsehat.id` | `KaderAnggrek12026!` |
| **7** | Kader Posyandu Anggrek 2 | Desa Kalirejo | `kader.anggrek2@tumbuhsehat.id` | `KaderAnggrek22026!` |
| **8** | Kader Posyandu Kamboja 1 | Desa Pabean | `kader.kamboja1@tumbuhsehat.id` | `KaderKamboja12026!` |
| **9** | Kader Posyandu Kamboja 2 | Desa Pabean | `kader.kamboja2@tumbuhsehat.id` | `KaderKamboja22026!` |
| **10** | Kader Posyandu Kenanga 1 | Desa Tamansari | `kader.kenanga1@tumbuhsehat.id` | `KaderKenanga12026!` |
| **11** | Kader Posyandu Kenanga 2 | Desa Tamansari | `kader.kenanga2@tumbuhsehat.id` | `KaderKenanga22026!` |

---

## 7. Lisensi & Distribusi

Hak Cipta © 2026 **Tim Pengembang TumbuhSehat** bekerjasama dengan Unit Pelaksana Teknis Puskesmas Dringu. Dikembangkan untuk keperluan akademik dan implementasi surveilans kesehatan masyarakat berstandar Kementerian Kesehatan Republik Indonesia.
