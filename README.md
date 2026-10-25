# TUMBUHSEHAT SURVEILLANCE & POSYANDU ECOSYSTEM
> Production-grade Clinical Surveillance Dashboard (Express.js) & Offline-First Field Assistant (Android Kotlin).

---

## MANDATORY AGENT EXECUTION RULES (ANTI-SLOP DIRECTIVE)
Setiap Agent yang membaca repositori ini WAJIB mematuhi seluruh klausul di bawah ini sebelum mengeksekusi, memodifikasi, atau membuat kode:

### 1. Zero AI-Slop Code & Token Efficiency
- **Strictly No Obvious Comments**: Hapus seluruh komentar generik yang menjelaskan hal sepele (contoh: `// panggil fungsi`, `// inisialisasi variabel`, `// ini adalah middleware`). Kode harus bersifat *self-documenting*.
- **Keep Critical Comments Only**: Komentar hanya diizinkan untuk formula medis rumit (seperti rumus WHO Box-Cox LMS, evaluasi Faltering T/2T, dan skema enkripsi AES-128-CBC).
- **No Dead or Redundant Code**: Dilarang membuat fungsi duplikat, blok `console.log` liar di rute produksi, atau deklarasi pustaka tanpa pemakaian nyata.
- **Brevity & Direct Execution**: Jangan menghasilkan respons bertele-tele atau pengantar artifisial. Utamakan ketepatan teknis dan hemat token.

### 2. Clinical Editorial Minimalist UI/UX Standard
- **No AI-Gradients / Glassmorphism**: Dilarang menggunakan gradien ungu/biru murahan, border mengkilap berlebihan, drop shadow buram, atau efek kartu melayang.
- **Color Discipline**:
  - Primary / Background: Solid White (#FFFFFF), Slate (#F8FAFC), Dark Spruce (#0C2E28).
  - Status Indicators: Sage Green (#4E8752) untuk Normal/Baik, Terracotta (#C85A32) untuk Faltering/Stunted/Danger.
  - Border: Solid 1px (#E2E8F0).
- **Typography & Layout**:
  - Gunakan font fungsional (Inter, Plus Jakarta Sans, Roboto).
  - Nilai desimal metriks klinis wajib menggunakan format `tabular-nums` atau monospace dengan 2 desimal pasti.
  - Mobile Touch Target: Minimal 48x48dp, grid ritmis kelipatan 8dp.
  - No Floating Pills: Hindari elemen berbentuk kapsul melayang dengan radius 9999dp tanpa kontur. Gunakan radius 4dp hingga 8dp dengan solid border.

### 3. Production Security & Data Architecture
- **PII & Medical Protection**: NIK balita dan rekam medis wajib terenkripsi menggunakan AES-128-CBC (`crypto.js`) saat transmisi jaringan cloud.
- **Rate Limiting Hard Gate**: Endpoint autentikasi wajib diproteksi `authLimiter` (maksimal 3 request per 7 menit per IP, HTTP 429). Endpoint publik dibatasi `apiLimiter` (100 request per 15 menit).
- **Caching & Performance**: Terapkan Caching Hybrid (Redis dengan fallback transparan Node-Cache) dan Gzip Compression Level 9 untuk payload > 1 KB.
- **Offline-First Consistency**: Room DB lokal adalah sumber kebenaran data di perangkat mobile; mutasi antrean wajib idempotent dengan dukungan transaksi ACID saat sinkronisasi dua arah.

---

## Arsitektur Repositori
- `backend/`: Server Express.js, MySQL Connection Pool, Redis/Node-Cache, Gzip Level 9, e-PPGBM Export Engine, dan WHO Engine.
- `mobile/`: Aplikasi Android Kotlin native, Room Database lokal, WorkManager Background Sync, Offline-First WHO Engine, dan Material Clinical UI.
- `.agents/skills/`: Kumpulan skill Anti-Slop (antislop, antislop-code, antislop-ui, antislop-human, antislop-copywriting, antislop-layoutmobile).