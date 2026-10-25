-- ====================================================================
-- SKEMA BASIS DATA TUMBUHSEHAT (POSTGRESQL / SUPABASE)
-- Konversi Lengkap 23 Tabel dari MySQL ke Dialek PostgreSQL / Supabase
-- Mendukung SERIAL/BIGSERIAL, TIMESTAMPTZ, BOOLEAN, dan JSONB
-- ====================================================================

-- Aktifkan ekstensi pgcrypto untuk hashing jika diperlukan
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------
-- 1. Tabel `wilayah`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS wilayah (
    id SERIAL PRIMARY KEY,
    nama_wilayah VARCHAR(100) NOT NULL,
    tingkat VARCHAR(20) NOT NULL CHECK (tingkat IN ('Desa', 'Kecamatan', 'Kabupaten')),
    induk_id INT REFERENCES wilayah(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 2. Tabel `peran`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS peran (
    id SERIAL PRIMARY KEY,
    nama_peran VARCHAR(50) NOT NULL UNIQUE
);

-- --------------------------------------------------------
-- 3. Tabel `puskesmas`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS puskesmas (
    id SERIAL PRIMARY KEY,
    nama_puskesmas VARCHAR(100) NOT NULL,
    wilayah_id INT REFERENCES wilayah(id) ON DELETE CASCADE,
    alamat TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 4. Tabel `posyandu`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS posyandu (
    id SERIAL PRIMARY KEY,
    nama_posyandu VARCHAR(100) NOT NULL,
    puskesmas_id INT REFERENCES puskesmas(id) ON DELETE SET NULL,
    wilayah_id INT REFERENCES wilayah(id) ON DELETE SET NULL,
    alamat TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 5. Tabel `pengguna`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS pengguna (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    peran_id INT REFERENCES peran(id) ON DELETE RESTRICT,
    posyandu_id INT REFERENCES posyandu(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 6. Tabel `keluarga`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS keluarga (
    id SERIAL PRIMARY KEY,
    no_kk VARCHAR(16) NOT NULL UNIQUE,
    nama_ayah VARCHAR(100),
    nama_ibu VARCHAR(100) NOT NULL,
    alamat_domisili TEXT,
    no_telepon VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 7. Tabel `anak`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS anak (
    id SERIAL PRIMARY KEY,
    keluarga_id INT REFERENCES keluarga(id) ON DELETE CASCADE,
    nik VARCHAR(16) UNIQUE,
    nama_lengkap VARCHAR(150) NOT NULL,
    jenis_kelamin VARCHAR(1) NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
    tanggal_lahir DATE NOT NULL,
    berat_lahir REAL,
    panjang_lahir REAL,
    posyandu_id INT REFERENCES posyandu(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 8. Tabel `jadwal_kegiatan`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS jadwal_kegiatan (
    id SERIAL PRIMARY KEY,
    posyandu_id INT REFERENCES posyandu(id) ON DELETE CASCADE,
    tanggal_kegiatan DATE NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 9. Tabel `kehadiran`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS kehadiran (
    id SERIAL PRIMARY KEY,
    jadwal_id INT REFERENCES jadwal_kegiatan(id) ON DELETE CASCADE,
    anak_id INT REFERENCES anak(id) ON DELETE CASCADE,
    waktu_datang TIME,
    status_hadir VARCHAR(20) DEFAULT 'Hadir' CHECK (status_hadir IN ('Hadir', 'Tidak Hadir')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 10. Tabel `pengukuran_antropometri`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS pengukuran_antropometri (
    id SERIAL PRIMARY KEY,
    kehadiran_id INT REFERENCES kehadiran(id) ON DELETE CASCADE,
    anak_id INT NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
    tanggal_ukur DATE NOT NULL,
    berat_badan REAL NOT NULL,
    tinggi_badan REAL NOT NULL,
    lingkar_kepala REAL,
    kader_id INT REFERENCES pengguna(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_anak_tanggal UNIQUE (anak_id, tanggal_ukur)
);

-- --------------------------------------------------------
-- 11. Tabel `hasil_analisis_gizi`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS hasil_analisis_gizi (
    id SERIAL PRIMARY KEY,
    pengukuran_id INT NOT NULL REFERENCES pengukuran_antropometri(id) ON DELETE CASCADE,
    zscore_bbu REAL,
    zscore_tbu REAL,
    zscore_bbtb REAL,
    status_stunting VARCHAR(50),
    indikasi_faltering BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 12. Tabel `standar_who_zscore`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS standar_who_zscore (
    id SERIAL PRIMARY KEY,
    indikator VARCHAR(10) NOT NULL CHECK (indikator IN ('BBU', 'TBU', 'BBTB')),
    jenis_kelamin VARCHAR(1) NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
    bulan_usia INT NOT NULL,
    l_value REAL NOT NULL,
    m_value REAL NOT NULL,
    s_value REAL NOT NULL
);

-- --------------------------------------------------------
-- 13. Tabel `bahan_pangan_lokal`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS bahan_pangan_lokal (
    id SERIAL PRIMARY KEY,
    nama_bahan VARCHAR(100) NOT NULL,
    kalori REAL,
    protein REAL,
    zat_besi REAL,
    harga_estimasi DECIMAL(10,2)
);

-- --------------------------------------------------------
-- 14. Tabel `resep_mpasi`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS resep_mpasi (
    id SERIAL PRIMARY KEY,
    nama_resep VARCHAR(150) NOT NULL,
    kelompok_usia_bulan VARCHAR(50),
    cara_pembuatan TEXT,
    total_kalori REAL
);

-- --------------------------------------------------------
-- 15. Tabel `komposisi_resep`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS komposisi_resep (
    id SERIAL PRIMARY KEY,
    resep_id INT REFERENCES resep_mpasi(id) ON DELETE CASCADE,
    bahan_id INT REFERENCES bahan_pangan_lokal(id) ON DELETE CASCADE,
    takaran_gram REAL
);

-- --------------------------------------------------------
-- 16. Tabel `rekomendasi_diberikan`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekomendasi_diberikan (
    id SERIAL PRIMARY KEY,
    analisis_id INT REFERENCES hasil_analisis_gizi(id) ON DELETE CASCADE,
    resep_id INT REFERENCES resep_mpasi(id) ON DELETE CASCADE,
    catatan_kader TEXT,
    tanggal_rekomendasi DATE NOT NULL
);

-- --------------------------------------------------------
-- 17. Tabel `peringatan_dini`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS peringatan_dini (
    id SERIAL PRIMARY KEY,
    anak_id INT REFERENCES anak(id) ON DELETE CASCADE,
    tingkat_bahaya VARCHAR(20) NOT NULL CHECK (tingkat_bahaya IN ('Kuning', 'Merah')),
    pesan_peringatan TEXT,
    status_tindak_lanjut VARCHAR(20) DEFAULT 'Belum' CHECK (status_tindak_lanjut IN ('Belum', 'Selesai')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 18. Tabel `imunisasi_master`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS imunisasi_master (
    id SERIAL PRIMARY KEY,
    nama_vaksin VARCHAR(100) NOT NULL,
    usia_wajib_bulan INT NOT NULL
);

-- --------------------------------------------------------
-- 19. Tabel `catatan_imunisasi`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS catatan_imunisasi (
    id SERIAL PRIMARY KEY,
    anak_id INT REFERENCES anak(id) ON DELETE CASCADE,
    imunisasi_id INT REFERENCES imunisasi_master(id) ON DELETE RESTRICT,
    tanggal_suntik DATE NOT NULL,
    kader_id INT REFERENCES pengguna(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 20. Tabel `catatan_vitamin`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS catatan_vitamin (
    id SERIAL PRIMARY KEY,
    anak_id INT REFERENCES anak(id) ON DELETE CASCADE,
    jenis_vitamin VARCHAR(50) NOT NULL CHECK (jenis_vitamin IN ('Kapsul Biru', 'Kapsul Merah', 'Obat Cacing')),
    tanggal_diberikan DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 21. Tabel `riwayat_penyakit`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS riwayat_penyakit (
    id SERIAL PRIMARY KEY,
    anak_id INT REFERENCES anak(id) ON DELETE CASCADE,
    tanggal_sakit DATE NOT NULL,
    jenis_penyakit VARCHAR(100) NOT NULL,
    durasi_hari INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 22. Tabel `perangkat_kader`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS perangkat_kader (
    id SERIAL PRIMARY KEY,
    pengguna_id INT REFERENCES pengguna(id) ON DELETE CASCADE,
    kode_perangkat VARCHAR(100) NOT NULL UNIQUE,
    token_offline VARCHAR(255),
    waktu_sync_terakhir TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 23. Tabel `antrean_sinkronisasi`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS antrean_sinkronisasi (
    id SERIAL PRIMARY KEY,
    nama_tabel VARCHAR(50) NOT NULL,
    id_referensi INT NOT NULL,
    aksi VARCHAR(10) NOT NULL CHECK (aksi IN ('INSERT', 'UPDATE')),
    data_json JSONB NOT NULL,
    status_sync VARCHAR(20) DEFAULT 'Pending' CHECK (status_sync IN ('Pending', 'Berhasil', 'Gagal')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- INDEKS OPTIMASI PENCARIAN & RELASI (POSTGRESQL)
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_anak_keluarga ON anak(keluarga_id);
CREATE INDEX IF NOT EXISTS idx_anak_nik ON anak(nik);
CREATE INDEX IF NOT EXISTS idx_pengukuran_anak ON pengukuran_antropometri(anak_id);
CREATE INDEX IF NOT EXISTS idx_pengukuran_tanggal ON pengukuran_antropometri(tanggal_ukur DESC);
CREATE INDEX IF NOT EXISTS idx_hasil_analisis_pengukuran ON hasil_analisis_gizi(pengukuran_id);
CREATE INDEX IF NOT EXISTS idx_peringatan_anak ON peringatan_dini(anak_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON antrean_sinkronisasi(status_sync);
CREATE INDEX IF NOT EXISTS idx_standar_who ON standar_who_zscore(indikator, jenis_kelamin, bulan_usia);

-- ====================================================================
-- SEED DATA AWAL (MASTER ROLES & DATA DEFAULT)
-- ====================================================================
INSERT INTO peran (id, nama_peran) VALUES
    (1, 'Admin Puskesmas'),
    (2, 'Tenaga Gizi'),
    (3, 'Kader Posyandu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO wilayah (id, nama_wilayah, tingkat, induk_id) VALUES
    (1, 'Kecamatan Dringu', 'Kecamatan', NULL),
    (2, 'Desa Dringu', 'Desa', 1),
    (3, 'Desa Kalisalam', 'Desa', 1),
    (4, 'Desa Kedungdalem', 'Desa', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO puskesmas (id, nama_puskesmas, wilayah_id, alamat) VALUES
    (1, 'Puskesmas Dringu', 1, 'Jl. Raya Dringu No. 12, Probolinggo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO posyandu (id, nama_posyandu, puskesmas_id, wilayah_id, alamat) VALUES
    (1, 'Posyandu Sukamaju 01', 1, 2, 'Dusun Krajan RT 02 / RW 01, Desa Dringu'),
    (2, 'Posyandu Melati Kalisalam', 1, 3, 'Dusun Tengah, Desa Kalisalam'),
    (3, 'Posyandu Mawar Kedungdalem', 1, 4, 'Dusun Barat, Desa Kedungdalem')
ON CONFLICT (id) DO NOTHING;

-- Akun bawaan: admin@tumbuhsehat.id / password: password123
INSERT INTO pengguna (id, email, password, peran_id, posyandu_id, status) VALUES
    (1, 'admin@tumbuhsehat.id', '$2a$10$w8c9k1nF7b8NnU0R8nF.G.uK5bMvVjFpIln1v8q8a1h1z1k1l1m1e', 1, 1, 'Aktif')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bahan_pangan_lokal (nama_bahan, kalori, protein, zat_besi, harga_estimasi) VALUES
    ('Ikan Kembung Segar', 112, 21.4, 1.9, 12000),
    ('Singkong Kuning Kukus', 160, 1.4, 0.7, 5000),
    ('Hati Ayam Kampung', 135, 24.5, 9.2, 8000),
    ('Daun Kelor Segar', 64, 9.4, 4.0, 3000),
    ('Tempe Kedelai Murni', 193, 19.0, 2.7, 4000),
    ('Telur Puyuh Rebus', 158, 13.0, 3.6, 6000)
ON CONFLICT DO NOTHING;
