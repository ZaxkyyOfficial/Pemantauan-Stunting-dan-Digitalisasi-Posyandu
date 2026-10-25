-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 16 Sep 2026 pada 04.31
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `db_posyandu_stunting`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `anak`
--

CREATE TABLE `anak` (
  `id` int(11) NOT NULL,
  `keluarga_id` int(11) DEFAULT NULL,
  `nik` varchar(16) DEFAULT NULL,
  `nama_lengkap` varchar(150) NOT NULL,
  `jenis_kelamin` enum('L','P') NOT NULL,
  `tanggal_lahir` date NOT NULL,
  `berat_lahir` float DEFAULT NULL,
  `panjang_lahir` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `antrean_sinkronisasi`
--

CREATE TABLE `antrean_sinkronisasi` (
  `id` int(11) NOT NULL,
  `nama_tabel` varchar(50) NOT NULL,
  `id_referensi` int(11) NOT NULL,
  `aksi` enum('INSERT','UPDATE') NOT NULL,
  `data_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data_json`)),
  `status_sync` enum('Pending','Berhasil','Gagal') DEFAULT 'Pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `bahan_pangan_lokal`
--

CREATE TABLE `bahan_pangan_lokal` (
  `id` int(11) NOT NULL,
  `nama_bahan` varchar(100) NOT NULL,
  `kalori` float DEFAULT NULL,
  `protein` float DEFAULT NULL,
  `zat_besi` float DEFAULT NULL,
  `harga_estimasi` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `catatan_imunisasi`
--

CREATE TABLE `catatan_imunisasi` (
  `id` int(11) NOT NULL,
  `anak_id` int(11) DEFAULT NULL,
  `imunisasi_id` int(11) DEFAULT NULL,
  `tanggal_suntik` date NOT NULL,
  `kader_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `catatan_vitamin`
--

CREATE TABLE `catatan_vitamin` (
  `id` int(11) NOT NULL,
  `anak_id` int(11) DEFAULT NULL,
  `jenis_vitamin` enum('Kapsul Biru','Kapsul Merah','Obat Cacing') NOT NULL,
  `tanggal_diberikan` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `hasil_analisis_gizi`
--

CREATE TABLE `hasil_analisis_gizi` (
  `id` int(11) NOT NULL,
  `pengukuran_id` int(11) DEFAULT NULL,
  `zscore_bbu` float DEFAULT NULL,
  `zscore_tbu` float DEFAULT NULL,
  `zscore_bbtb` float DEFAULT NULL,
  `status_stunting` varchar(50) DEFAULT NULL,
  `indikasi_faltering` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `imunisasi_master`
--

CREATE TABLE `imunisasi_master` (
  `id` int(11) NOT NULL,
  `nama_vaksin` varchar(100) NOT NULL,
  `usia_wajib_bulan` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `jadwal_kegiatan`
--

CREATE TABLE `jadwal_kegiatan` (
  `id` int(11) NOT NULL,
  `posyandu_id` int(11) DEFAULT NULL,
  `tanggal_kegiatan` date NOT NULL,
  `keterangan` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `kehadiran`
--

CREATE TABLE `kehadiran` (
  `id` int(11) NOT NULL,
  `jadwal_id` int(11) DEFAULT NULL,
  `anak_id` int(11) DEFAULT NULL,
  `waktu_datang` time DEFAULT NULL,
  `status_hadir` enum('Hadir','Tidak Hadir') DEFAULT 'Hadir'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `keluarga`
--

CREATE TABLE `keluarga` (
  `id` int(11) NOT NULL,
  `no_kk` varchar(16) NOT NULL,
  `nama_ayah` varchar(100) DEFAULT NULL,
  `nama_ibu` varchar(100) NOT NULL,
  `alamat_domisili` text DEFAULT NULL,
  `no_telepon` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `komposisi_resep`
--

CREATE TABLE `komposisi_resep` (
  `id` int(11) NOT NULL,
  `resep_id` int(11) DEFAULT NULL,
  `bahan_id` int(11) DEFAULT NULL,
  `takaran_gram` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengguna`
--

CREATE TABLE `pengguna` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `peran_id` int(11) DEFAULT NULL,
  `posyandu_id` int(11) DEFAULT NULL,
  `status` enum('Aktif','Nonaktif') DEFAULT 'Aktif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengukuran_antropometri`
--

CREATE TABLE `pengukuran_antropometri` (
  `id` int(11) NOT NULL,
  `kehadiran_id` int(11) DEFAULT NULL,
  `anak_id` int(11) DEFAULT NULL,
  `tanggal_ukur` date NOT NULL,
  `berat_badan` float NOT NULL,
  `tinggi_badan` float NOT NULL,
  `lingkar_kepala` float DEFAULT NULL,
  `kader_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `peran`
--

CREATE TABLE `peran` (
  `id` int(11) NOT NULL,
  `nama_peran` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `perangkat_kader`
--

CREATE TABLE `perangkat_kader` (
  `id` int(11) NOT NULL,
  `pengguna_id` int(11) DEFAULT NULL,
  `kode_perangkat` varchar(100) NOT NULL,
  `token_offline` varchar(255) DEFAULT NULL,
  `waktu_sync_terakhir` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `peringatan_dini`
--

CREATE TABLE `peringatan_dini` (
  `id` int(11) NOT NULL,
  `anak_id` int(11) DEFAULT NULL,
  `tingkat_bahaya` enum('Kuning','Merah') NOT NULL,
  `pesan_peringatan` text DEFAULT NULL,
  `status_tindak_lanjut` enum('Belum','Selesai') DEFAULT 'Belum'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `posyandu`
--

CREATE TABLE `posyandu` (
  `id` int(11) NOT NULL,
  `nama_posyandu` varchar(100) NOT NULL,
  `puskesmas_id` int(11) DEFAULT NULL,
  `wilayah_id` int(11) DEFAULT NULL,
  `alamat` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `puskesmas`
--

CREATE TABLE `puskesmas` (
  `id` int(11) NOT NULL,
  `nama_puskesmas` varchar(100) NOT NULL,
  `wilayah_id` int(11) DEFAULT NULL,
  `alamat` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `rekomendasi_diberikan`
--

CREATE TABLE `rekomendasi_diberikan` (
  `id` int(11) NOT NULL,
  `analisis_id` int(11) DEFAULT NULL,
  `resep_id` int(11) DEFAULT NULL,
  `catatan_kader` text DEFAULT NULL,
  `tanggal_rekomendasi` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `resep_mpasi`
--

CREATE TABLE `resep_mpasi` (
  `id` int(11) NOT NULL,
  `nama_resep` varchar(150) NOT NULL,
  `kelompok_usia_bulan` varchar(50) DEFAULT NULL,
  `cara_pembuatan` text DEFAULT NULL,
  `total_kalori` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `riwayat_penyakit`
--

CREATE TABLE `riwayat_penyakit` (
  `id` int(11) NOT NULL,
  `anak_id` int(11) DEFAULT NULL,
  `tanggal_sakit` date NOT NULL,
  `jenis_penyakit` varchar(100) NOT NULL,
  `durasi_hari` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `standar_who_zscore`
--

CREATE TABLE `standar_who_zscore` (
  `id` int(11) NOT NULL,
  `indikator` enum('BBU','TBU','BBTB') NOT NULL,
  `jenis_kelamin` enum('L','P') NOT NULL,
  `bulan_usia` int(11) NOT NULL,
  `l_value` float NOT NULL,
  `m_value` float NOT NULL,
  `s_value` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `wilayah`
--

CREATE TABLE `wilayah` (
  `id` int(11) NOT NULL,
  `nama_wilayah` varchar(100) NOT NULL,
  `tingkat` enum('Desa','Kecamatan','Kabupaten') NOT NULL,
  `induk_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `anak`
--
ALTER TABLE `anak`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nik` (`nik`),
  ADD KEY `keluarga_id` (`keluarga_id`);

--
-- Indeks untuk tabel `antrean_sinkronisasi`
--
ALTER TABLE `antrean_sinkronisasi`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `bahan_pangan_lokal`
--
ALTER TABLE `bahan_pangan_lokal`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `catatan_imunisasi`
--
ALTER TABLE `catatan_imunisasi`
  ADD PRIMARY KEY (`id`),
  ADD KEY `anak_id` (`anak_id`),
  ADD KEY `imunisasi_id` (`imunisasi_id`),
  ADD KEY `kader_id` (`kader_id`);

--
-- Indeks untuk tabel `catatan_vitamin`
--
ALTER TABLE `catatan_vitamin`
  ADD PRIMARY KEY (`id`),
  ADD KEY `anak_id` (`anak_id`);

--
-- Indeks untuk tabel `hasil_analisis_gizi`
--
ALTER TABLE `hasil_analisis_gizi`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pengukuran_id` (`pengukuran_id`);

--
-- Indeks untuk tabel `imunisasi_master`
--
ALTER TABLE `imunisasi_master`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `jadwal_kegiatan`
--
ALTER TABLE `jadwal_kegiatan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `posyandu_id` (`posyandu_id`);

--
-- Indeks untuk tabel `kehadiran`
--
ALTER TABLE `kehadiran`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jadwal_id` (`jadwal_id`),
  ADD KEY `anak_id` (`anak_id`);

--
-- Indeks untuk tabel `keluarga`
--
ALTER TABLE `keluarga`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `no_kk` (`no_kk`);

--
-- Indeks untuk tabel `komposisi_resep`
--
ALTER TABLE `komposisi_resep`
  ADD PRIMARY KEY (`id`),
  ADD KEY `resep_id` (`resep_id`),
  ADD KEY `bahan_id` (`bahan_id`);

--
-- Indeks untuk tabel `pengguna`
--
ALTER TABLE `pengguna`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `peran_id` (`peran_id`),
  ADD KEY `posyandu_id` (`posyandu_id`);

--
-- Indeks untuk tabel `pengukuran_antropometri`
--
ALTER TABLE `pengukuran_antropometri`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_anak_tanggal` (`anak_id`, `tanggal_ukur`),
  ADD KEY `kehadiran_id` (`kehadiran_id`),
  ADD KEY `anak_id` (`anak_id`),
  ADD KEY `kader_id` (`kader_id`);

--
-- Indeks untuk tabel `peran`
--
ALTER TABLE `peran`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `perangkat_kader`
--
ALTER TABLE `perangkat_kader`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `kode_perangkat` (`kode_perangkat`),
  ADD KEY `pengguna_id` (`pengguna_id`);

--
-- Indeks untuk tabel `peringatan_dini`
--
ALTER TABLE `peringatan_dini`
  ADD PRIMARY KEY (`id`),
  ADD KEY `anak_id` (`anak_id`);

--
-- Indeks untuk tabel `posyandu`
--
ALTER TABLE `posyandu`
  ADD PRIMARY KEY (`id`),
  ADD KEY `puskesmas_id` (`puskesmas_id`),
  ADD KEY `wilayah_id` (`wilayah_id`);

--
-- Indeks untuk tabel `puskesmas`
--
ALTER TABLE `puskesmas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `wilayah_id` (`wilayah_id`);

--
-- Indeks untuk tabel `rekomendasi_diberikan`
--
ALTER TABLE `rekomendasi_diberikan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `analisis_id` (`analisis_id`),
  ADD KEY `resep_id` (`resep_id`);

--
-- Indeks untuk tabel `resep_mpasi`
--
ALTER TABLE `resep_mpasi`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `riwayat_penyakit`
--
ALTER TABLE `riwayat_penyakit`
  ADD PRIMARY KEY (`id`),
  ADD KEY `anak_id` (`anak_id`);

--
-- Indeks untuk tabel `standar_who_zscore`
--
ALTER TABLE `standar_who_zscore`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `wilayah`
--
ALTER TABLE `wilayah`
  ADD PRIMARY KEY (`id`),
  ADD KEY `induk_id` (`induk_id`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `anak`
--
ALTER TABLE `anak`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `antrean_sinkronisasi`
--
ALTER TABLE `antrean_sinkronisasi`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `bahan_pangan_lokal`
--
ALTER TABLE `bahan_pangan_lokal`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `catatan_imunisasi`
--
ALTER TABLE `catatan_imunisasi`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `catatan_vitamin`
--
ALTER TABLE `catatan_vitamin`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `hasil_analisis_gizi`
--
ALTER TABLE `hasil_analisis_gizi`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `imunisasi_master`
--
ALTER TABLE `imunisasi_master`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `jadwal_kegiatan`
--
ALTER TABLE `jadwal_kegiatan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `kehadiran`
--
ALTER TABLE `kehadiran`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `keluarga`
--
ALTER TABLE `keluarga`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `komposisi_resep`
--
ALTER TABLE `komposisi_resep`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `pengguna`
--
ALTER TABLE `pengguna`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `pengukuran_antropometri`
--
ALTER TABLE `pengukuran_antropometri`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `peran`
--
ALTER TABLE `peran`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `perangkat_kader`
--
ALTER TABLE `perangkat_kader`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `peringatan_dini`
--
ALTER TABLE `peringatan_dini`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `posyandu`
--
ALTER TABLE `posyandu`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `puskesmas`
--
ALTER TABLE `puskesmas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `rekomendasi_diberikan`
--
ALTER TABLE `rekomendasi_diberikan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `resep_mpasi`
--
ALTER TABLE `resep_mpasi`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `riwayat_penyakit`
--
ALTER TABLE `riwayat_penyakit`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `standar_who_zscore`
--
ALTER TABLE `standar_who_zscore`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `wilayah`
--
ALTER TABLE `wilayah`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `anak`
--
ALTER TABLE `anak`
  ADD CONSTRAINT `anak_ibfk_1` FOREIGN KEY (`keluarga_id`) REFERENCES `keluarga` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `catatan_imunisasi`
--
ALTER TABLE `catatan_imunisasi`
  ADD CONSTRAINT `catatan_imunisasi_ibfk_1` FOREIGN KEY (`anak_id`) REFERENCES `anak` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `catatan_imunisasi_ibfk_2` FOREIGN KEY (`imunisasi_id`) REFERENCES `imunisasi_master` (`id`),
  ADD CONSTRAINT `catatan_imunisasi_ibfk_3` FOREIGN KEY (`kader_id`) REFERENCES `pengguna` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `catatan_vitamin`
--
ALTER TABLE `catatan_vitamin`
  ADD CONSTRAINT `catatan_vitamin_ibfk_1` FOREIGN KEY (`anak_id`) REFERENCES `anak` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `hasil_analisis_gizi`
--
ALTER TABLE `hasil_analisis_gizi`
  ADD CONSTRAINT `hasil_analisis_gizi_ibfk_1` FOREIGN KEY (`pengukuran_id`) REFERENCES `pengukuran_antropometri` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `jadwal_kegiatan`
--
ALTER TABLE `jadwal_kegiatan`
  ADD CONSTRAINT `jadwal_kegiatan_ibfk_1` FOREIGN KEY (`posyandu_id`) REFERENCES `posyandu` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `kehadiran`
--
ALTER TABLE `kehadiran`
  ADD CONSTRAINT `kehadiran_ibfk_1` FOREIGN KEY (`jadwal_id`) REFERENCES `jadwal_kegiatan` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kehadiran_ibfk_2` FOREIGN KEY (`anak_id`) REFERENCES `anak` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `komposisi_resep`
--
ALTER TABLE `komposisi_resep`
  ADD CONSTRAINT `komposisi_resep_ibfk_1` FOREIGN KEY (`resep_id`) REFERENCES `resep_mpasi` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `komposisi_resep_ibfk_2` FOREIGN KEY (`bahan_id`) REFERENCES `bahan_pangan_lokal` (`id`);

--
-- Ketidakleluasaan untuk tabel `pengguna`
--
ALTER TABLE `pengguna`
  ADD CONSTRAINT `pengguna_ibfk_1` FOREIGN KEY (`peran_id`) REFERENCES `peran` (`id`),
  ADD CONSTRAINT `pengguna_ibfk_2` FOREIGN KEY (`posyandu_id`) REFERENCES `posyandu` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `pengukuran_antropometri`
--
ALTER TABLE `pengukuran_antropometri`
  ADD CONSTRAINT `pengukuran_antropometri_ibfk_1` FOREIGN KEY (`kehadiran_id`) REFERENCES `kehadiran` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pengukuran_antropometri_ibfk_2` FOREIGN KEY (`anak_id`) REFERENCES `anak` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pengukuran_antropometri_ibfk_3` FOREIGN KEY (`kader_id`) REFERENCES `pengguna` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `perangkat_kader`
--
ALTER TABLE `perangkat_kader`
  ADD CONSTRAINT `perangkat_kader_ibfk_1` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `peringatan_dini`
--
ALTER TABLE `peringatan_dini`
  ADD CONSTRAINT `peringatan_dini_ibfk_1` FOREIGN KEY (`anak_id`) REFERENCES `anak` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `posyandu`
--
ALTER TABLE `posyandu`
  ADD CONSTRAINT `posyandu_ibfk_1` FOREIGN KEY (`puskesmas_id`) REFERENCES `puskesmas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `posyandu_ibfk_2` FOREIGN KEY (`wilayah_id`) REFERENCES `wilayah` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `puskesmas`
--
ALTER TABLE `puskesmas`
  ADD CONSTRAINT `puskesmas_ibfk_1` FOREIGN KEY (`wilayah_id`) REFERENCES `wilayah` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `rekomendasi_diberikan`
--
ALTER TABLE `rekomendasi_diberikan`
  ADD CONSTRAINT `rekomendasi_diberikan_ibfk_1` FOREIGN KEY (`analisis_id`) REFERENCES `hasil_analisis_gizi` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `rekomendasi_diberikan_ibfk_2` FOREIGN KEY (`resep_id`) REFERENCES `resep_mpasi` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `riwayat_penyakit`
--
ALTER TABLE `riwayat_penyakit`
  ADD CONSTRAINT `riwayat_penyakit_ibfk_1` FOREIGN KEY (`anak_id`) REFERENCES `anak` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `wilayah`
--
ALTER TABLE `wilayah`
  ADD CONSTRAINT `wilayah_ibfk_1` FOREIGN KEY (`induk_id`) REFERENCES `wilayah` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
