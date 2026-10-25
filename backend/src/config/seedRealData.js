const { pool } = require('./database');

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Seeding data surveilans Posyandu...');

    // 1. Pastikan data wilayah
    await conn.execute(`DELETE FROM wilayah WHERE id IN (1, 2, 3)`);
    await conn.execute(`
      INSERT INTO wilayah (id, nama_wilayah, tingkat, induk_id) VALUES
      (1, 'Desa Dringu', 'Desa', NULL),
      (2, 'Desa Kalisalam', 'Desa', NULL),
      (3, 'Desa Kedungdalem', 'Desa', NULL)
    `);

    // 2. Pastikan data keluarga
    await conn.execute(`DELETE FROM keluarga WHERE id BETWEEN 1 AND 12`);
    const keluargaData = [
      [1, '3509010101220001', 'Budi Santoso', 'Siti Fatimah', 'Dusun Krajan RT 02/01, Desa Dringu', '081234567801'],
      [2, '3509010101220002', 'Ahmad Hidayat', 'Nurul Aini', 'Dusun Timur RT 04/02, Desa Dringu', '081234567802'],
      [3, '3509010101220003', 'Joko Prayitno', 'Dewi Lestari', 'Dusun Krajan RT 01/01, Desa Kalisalam', '081234567803'],
      [4, '3509010101220004', 'Hendra Gunawan', 'Sri Rahayu', 'Dusun Tengah RT 03/02, Desa Kalisalam', '081234567804'],
      [5, '3509010101220005', 'Rudi Hartono', 'Endang Sulastri', 'Dusun Barat RT 02/01, Desa Kedungdalem', '081234567805'],
      [6, '3509010101220006', 'Dedi Kurniawan', 'Rina Wulandari', 'Dusun Selatan RT 05/03, Desa Kedungdalem', '081234567806'],
      [7, '3509010101220007', 'Supriyadi', 'Lilis Maryati', 'Dusun Krajan RT 03/01, Desa Dringu', '081234567807'],
      [8, '3509010101220008', 'Wahyu Pratama', 'Yuni Astuti', 'Dusun Timur RT 02/02, Desa Dringu', '081234567808'],
      [9, '3509010101220009', 'Eko Susanto', 'Tri Wahyuni', 'Dusun Tengah RT 01/02, Desa Kalisalam', '081234567809'],
      [10, '3509010101220010', 'Bambang Irawan', 'Kartini', 'Dusun Barat RT 04/01, Desa Kedungdalem', '081234567810']
    ];
    for (const k of keluargaData) {
      await conn.execute(
        `INSERT INTO keluarga (id, no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon) VALUES (?, ?, ?, ?, ?, ?)`,
        k
      );
    }

    // 3. Pastikan data sasaran anak
    await conn.execute(`DELETE FROM anak WHERE id BETWEEN 1 AND 12`);
    const anakData = [
      [1, 1, '3509011504240001', 'Muhammad Bilal Al-Fatih', 'L', '2025-04-15', 3.2, 49.5],
      [2, 2, '3509015206240002', 'Aisyah Nurul Jannah', 'P', '2025-06-12', 3.0, 48.5],
      [3, 3, '3509012008240003', 'Kenzo Abrizam Pratama', 'L', '2025-08-20', 3.3, 50.0],
      [4, 4, '3509016510240004', 'Zhafira Zahra Shakila', 'P', '2025-10-25', 2.8, 47.0],
      [5, 5, '3509010501250005', 'Alvaro Dylan Rahardjo', 'L', '2025-01-05', 3.4, 50.5],
      [6, 6, '3509014803250006', 'Naura Salsabila Putri', 'P', '2025-03-08', 2.9, 48.0],
      [7, 7, '3509011105250007', 'Raffasya Rayyan Danendra', 'L', '2025-05-11', 3.1, 49.0],
      [8, 8, '3509015907250008', 'Kanaya Adreena Humaira', 'P', '2025-07-19', 3.0, 48.5],
      [9, 9, '3509012809250009', 'Dzakyandra Putra Pratama', 'L', '2025-09-28', 3.2, 49.5],
      [10, 10, '3509016211250010', 'Mikayla Azkadina Khairunnisa', 'P', '2025-11-22', 2.7, 46.5]
    ];
    for (const a of anakData) {
      await conn.execute(
        `INSERT INTO anak (id, keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a
      );
    }

    // 4. Pastikan data pengukuran antropometri
    await conn.execute(`DELETE FROM pengukuran_antropometri WHERE id BETWEEN 1 AND 25`);
    const pengukuranData = [
      // Balita 1: Pertumbuhan Normal
      [1, 1, '2026-08-20', 9.1, 75.0, 45.0],
      [2, 1, '2026-09-20', 9.4, 76.2, 45.5],
      // Balita 2: Kasus Faltering (BB stagnan)
      [3, 2, '2026-08-20', 8.5, 72.0, 44.0],
      [4, 2, '2026-09-20', 8.5, 72.5, 44.2],
      // Balita 3: Kasus Stunted
      [5, 3, '2026-08-20', 8.0, 68.5, 43.5],
      [6, 3, '2026-09-20', 8.2, 69.0, 43.8],
      // Balita 4: Severely Stunted
      [7, 4, '2026-08-20', 6.8, 63.5, 41.5],
      [8, 4, '2026-09-20', 6.9, 64.0, 41.8],
      // Balita 5: Normal
      [9, 5, '2026-08-20', 11.2, 85.0, 47.0],
      [10, 5, '2026-09-20', 11.5, 86.2, 47.2],
      // Balita 6: Faltering (BB turun)
      [11, 6, '2026-08-20', 10.2, 81.0, 46.0],
      [12, 6, '2026-09-20', 9.9, 81.5, 46.2],
      // Balita 7: Normal
      [13, 7, '2026-09-20', 10.6, 82.5, 46.5],
      // Balita 8: Normal
      [14, 8, '2026-09-20', 9.8, 79.0, 45.8],
      // Balita 9: Stunted
      [15, 9, '2026-09-20', 8.7, 71.5, 44.5],
      // Balita 10: Severely Stunted
      [16, 10, '2026-09-20', 6.5, 63.0, 41.2]
    ];
    for (const p of pengukuranData) {
      await conn.execute(
        `INSERT INTO pengukuran_antropometri (id, anak_id, tanggal_ukur, berat_badan, tinggi_badan, lingkar_kepala) VALUES (?, ?, ?, ?, ?, ?)`,
        p
      );
    }

    // 5. Pastikan hasil analisis gizi
    await conn.execute(`DELETE FROM hasil_analisis_gizi WHERE id BETWEEN 1 AND 25`);
    const analisisData = [
      [1, 2, -0.45, -0.35, -0.20, 'Normal', 0],
      [2, 4, -1.25, -1.15, -0.80, 'Normal', 1],
      [3, 6, -1.85, -2.45, -1.10, 'Stunted', 0],
      [4, 8, -2.95, -3.40, -1.85, 'Severely Stunted', 1],
      [5, 10, 0.25, 0.15, 0.30, 'Normal', 0],
      [6, 12, -1.35, -0.90, -1.45, 'Normal', 1],
      [7, 13, -0.20, -0.10, -0.15, 'Normal', 0],
      [8, 14, 0.10, 0.05, 0.15, 'Normal', 0],
      [9, 15, -1.75, -2.30, -1.05, 'Stunted', 0],
      [10, 16, -2.85, -3.25, -1.70, 'Severely Stunted', 1]
    ];
    for (const h of analisisData) {
      await conn.execute(
        `INSERT INTO hasil_analisis_gizi (id, pengukuran_id, zscore_bbu, zscore_tbu, zscore_bbtb, status_stunting, indikasi_faltering) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        h
      );
    }

    // 6. Pastikan log antrean sinkronisasi
    await conn.execute(`DELETE FROM antrean_sinkronisasi WHERE id BETWEEN 1 AND 15`);
    const syncLogs = [
      [1, 'pengukuran_antropometri', 16, 'INSERT', '{"anak_id":10,"berat_badan":6.5,"tinggi_badan":63.0,"status":"Severely Stunted"}', 'Berhasil'],
      [2, 'pengukuran_antropometri', 15, 'INSERT', '{"anak_id":9,"berat_badan":8.7,"tinggi_badan":71.5,"status":"Stunted"}', 'Berhasil'],
      [3, 'pengukuran_antropometri', 14, 'INSERT', '{"anak_id":8,"berat_badan":9.8,"tinggi_badan":79.0,"status":"Normal"}', 'Berhasil'],
      [4, 'pengukuran_antropometri', 13, 'INSERT', '{"anak_id":7,"berat_badan":10.6,"tinggi_badan":82.5,"status":"Normal"}', 'Berhasil'],
      [5, 'pengukuran_antropometri', 12, 'INSERT', '{"anak_id":6,"berat_badan":9.9,"tinggi_badan":81.5,"status":"Faltering"}', 'Berhasil'],
      [6, 'pengukuran_antropometri', 10, 'INSERT', '{"anak_id":5,"berat_badan":11.5,"tinggi_badan":86.2,"status":"Normal"}', 'Berhasil'],
      [7, 'pengukuran_antropometri', 8, 'INSERT', '{"anak_id":4,"berat_badan":6.9,"tinggi_badan":64.0,"status":"Severely Stunted"}', 'Berhasil'],
      [8, 'pengukuran_antropometri', 6, 'INSERT', '{"anak_id":3,"berat_badan":8.2,"tinggi_badan":69.0,"status":"Stunted"}', 'Berhasil']
    ];
    for (const s of syncLogs) {
      await conn.execute(
        `INSERT INTO antrean_sinkronisasi (id, nama_tabel, id_referensi, aksi, data_json, status_sync) VALUES (?, ?, ?, ?, ?, ?)`,
        s
      );
    }

    // 7. Pastikan perangkat kader terdaftar dan sinkron
    await conn.execute(`DELETE FROM perangkat_kader WHERE id IN (1, 2, 3)`);
    await conn.execute(`
      INSERT INTO perangkat_kader (id, pengguna_id, kode_perangkat, token_offline, waktu_sync_terakhir) VALUES
      (1, 1, 'SM-A546B-POSYANDU-01', 'token_posyandu_dringu_active_2026', NOW()),
      (2, 1, 'SM-A346B-POSYANDU-02', 'token_posyandu_kalisalam_active_2026', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
      (3, 1, 'SM-M146B-POSYANDU-03', 'token_posyandu_kedungdalem_2026', DATE_SUB(NOW(), INTERVAL 5 HOUR))
    `);

    await conn.commit();
    console.log('Seeding data surveilans selesai dengan sukses.');
  } catch (err) {
    await conn.rollback();
    console.error('Gagal melakukan seeding:', err);
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seed };
