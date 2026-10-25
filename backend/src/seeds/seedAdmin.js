const bcrypt = require('bcryptjs');
const { pool, testConnection } = require('../config/database');

async function seed() {
  await testConnection();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log('🌱 Memulai seeding database...\n');

    // ─── 1. Peran ────────────────────────────────────────────
    console.log('📋 Seeding tabel peran...');
    await connection.execute(`INSERT IGNORE INTO peran (id, nama_peran) VALUES (1, 'Admin Puskesmas')`);
    await connection.execute(`INSERT IGNORE INTO peran (id, nama_peran) VALUES (2, 'Kader')`);
    console.log('   ✅ Peran: Admin Puskesmas, Kader\n');

    // ─── 2. Akun Admin Default ───────────────────────────────
    console.log('👤 Seeding akun admin default...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await connection.execute(
      `INSERT IGNORE INTO pengguna (id, email, password, peran_id, posyandu_id, status)
       VALUES (1, 'admin@tumbuhsehat.id', ?, 1, NULL, 'Aktif')`,
      [hashedPassword]
    );
    console.log('   ✅ Admin: admin@tumbuhsehat.id / admin123\n');

    // ─── 3. Data Standar WHO Z-Score ─────────────────────────
    console.log('📊 Seeding standar WHO Z-score (BB/U & TB/U Laki-laki 0-24 bulan)...');

    // Data LMS BB/U untuk Laki-laki (L, M, S) - Sumber: WHO 2006
    const whoDataBBU_L = [
      // [bulan, L, M, S]
      [0, 0.3487, 3.3464, 0.14602],
      [1, 0.2297, 4.4709, 0.13395],
      [2, 0.1970, 5.5675, 0.12385],
      [3, 0.1738, 6.3762, 0.11727],
      [4, 0.1553, 7.0023, 0.11316],
      [5, 0.1395, 7.5105, 0.10980],
      [6, 0.1257, 7.9340, 0.10652],
      [7, 0.1134, 8.2970, 0.10390],
      [8, 0.1021, 8.6151, 0.10165],
      [9, 0.0917, 8.9014, 0.09970],
      [10, 0.0820, 9.1649, 0.09800],
      [11, 0.0730, 9.4122, 0.09650],
      [12, 0.0644, 9.6479, 0.09514],
      [13, 0.0563, 9.8749, 0.09438],
      [14, 0.0487, 10.0953, 0.09361],
      [15, 0.0413, 10.3108, 0.09286],
      [16, 0.0343, 10.5228, 0.09210],
      [17, 0.0275, 10.7319, 0.09144],
      [18, 0.0211, 10.9385, 0.09080],
      [19, 0.0148, 11.1430, 0.09023],
      [20, 0.0087, 11.3462, 0.08970],
      [21, 0.0029, 11.5486, 0.08921],
      [22, -0.0028, 11.7504, 0.08880],
      [23, -0.0083, 11.9514, 0.08842],
      [24, -0.0137, 12.1515, 0.08807],
    ];

    // Data LMS TB/U untuk Laki-laki (L, M, S) - Sumber: WHO 2006
    const whoDataTBU_L = [
      [0, 1, 49.8842, 0.03795],
      [1, 1, 54.7244, 0.03557],
      [2, 1, 58.4249, 0.03424],
      [3, 1, 61.4292, 0.03328],
      [4, 1, 63.8860, 0.03257],
      [5, 1, 65.9026, 0.03204],
      [6, 1, 67.6236, 0.03165],
      [7, 1, 69.1645, 0.03139],
      [8, 1, 70.5994, 0.03124],
      [9, 1, 71.9687, 0.03117],
      [10, 1, 73.2812, 0.03118],
      [11, 1, 74.5388, 0.03126],
      [12, 1, 75.7488, 0.03141],
      [13, 1, 76.9186, 0.03160],
      [14, 1, 78.0497, 0.03184],
      [15, 1, 79.1458, 0.03211],
      [16, 1, 80.2113, 0.03241],
      [17, 1, 81.2487, 0.03274],
      [18, 1, 82.2587, 0.03309],
      [19, 1, 83.2418, 0.03345],
      [20, 1, 84.1996, 0.03382],
      [21, 1, 85.1348, 0.03419],
      [22, 1, 86.0477, 0.03456],
      [23, 1, 86.9410, 0.03494],
      [24, 1, 87.8161, 0.03531],
    ];

    // Data LMS BB/U untuk Perempuan (L, M, S) - Sumber: WHO 2006
    const whoDataBBU_P = [
      [0, 0.3809, 3.2322, 0.14171],
      [1, 0.1714, 4.1873, 0.13724],
      [2, 0.0962, 5.1282, 0.12920],
      [3, 0.0402, 5.8458, 0.12290],
      [4, -0.0050, 6.4237, 0.11846],
      [5, -0.0430, 6.8985, 0.11484],
      [6, -0.0756, 7.2970, 0.11174],
      [7, -0.1039, 7.6422, 0.10906],
      [8, -0.1288, 7.9487, 0.10672],
      [9, -0.1507, 8.2254, 0.10466],
      [10, -0.1700, 8.4800, 0.10284],
      [11, -0.1872, 8.7192, 0.10120],
      [12, -0.2024, 8.9481, 0.09970],
      [13, -0.2158, 9.1699, 0.09860],
      [14, -0.2278, 9.3870, 0.09753],
      [15, -0.2384, 9.6008, 0.09652],
      [16, -0.2478, 9.8124, 0.09555],
      [17, -0.2562, 10.0226, 0.09462],
      [18, -0.2637, 10.2315, 0.09374],
      [19, -0.2703, 10.4393, 0.09291],
      [20, -0.2762, 10.6464, 0.09212],
      [21, -0.2815, 10.8534, 0.09139],
      [22, -0.2862, 11.0608, 0.09069],
      [23, -0.2903, 11.2688, 0.09005],
      [24, -0.2941, 11.4775, 0.08944],
    ];

    // Data LMS TB/U untuk Perempuan (L, M, S) - Sumber: WHO 2006
    const whoDataTBU_P = [
      [0, 1, 49.1477, 0.03790],
      [1, 1, 53.6872, 0.03614],
      [2, 1, 57.0673, 0.03568],
      [3, 1, 59.8029, 0.03520],
      [4, 1, 62.0899, 0.03486],
      [5, 1, 64.0301, 0.03463],
      [6, 1, 65.7311, 0.03448],
      [7, 1, 67.2873, 0.03441],
      [8, 1, 68.7498, 0.03440],
      [9, 1, 70.1435, 0.03444],
      [10, 1, 71.4818, 0.03452],
      [11, 1, 72.7710, 0.03464],
      [12, 1, 74.0153, 0.03479],
      [13, 1, 75.2170, 0.03496],
      [14, 1, 76.3817, 0.03514],
      [15, 1, 77.5099, 0.03534],
      [16, 1, 78.6055, 0.03555],
      [17, 1, 79.6713, 0.03576],
      [18, 1, 80.7079, 0.03598],
      [19, 1, 81.7182, 0.03621],
      [20, 1, 82.7036, 0.03644],
      [21, 1, 83.6654, 0.03668],
      [22, 1, 84.6040, 0.03693],
      [23, 1, 85.5202, 0.03717],
      [24, 1, 86.4153, 0.03743],
    ];

    // Insert semua data WHO
    const insertWho = `INSERT IGNORE INTO standar_who_zscore (indikator, jenis_kelamin, bulan_usia, l_value, m_value, s_value) VALUES (?, ?, ?, ?, ?, ?)`;

    for (const row of whoDataBBU_L) {
      await connection.execute(insertWho, ['BBU', 'L', row[0], row[1], row[2], row[3]]);
    }
    for (const row of whoDataTBU_L) {
      await connection.execute(insertWho, ['TBU', 'L', row[0], row[1], row[2], row[3]]);
    }
    for (const row of whoDataBBU_P) {
      await connection.execute(insertWho, ['BBU', 'P', row[0], row[1], row[2], row[3]]);
    }
    for (const row of whoDataTBU_P) {
      await connection.execute(insertWho, ['TBU', 'P', row[0], row[1], row[2], row[3]]);
    }
    console.log('   ✅ 100 record standar WHO Z-score (BBU+TBU, L+P, 0-24 bulan)\n');

    // ─── 4. Data Imunisasi Master ────────────────────────────
    console.log('💉 Seeding data imunisasi master...');
    const imunisasiData = [
      [1, 'Hepatitis B-0', 0],
      [2, 'BCG', 1],
      [3, 'Polio 1 (OPV)', 1],
      [4, 'DPT-HB-Hib 1', 2],
      [5, 'Polio 2 (OPV)', 2],
      [6, 'DPT-HB-Hib 2', 3],
      [7, 'Polio 3 (OPV)', 3],
      [8, 'DPT-HB-Hib 3', 4],
      [9, 'Polio 4 (OPV)', 4],
      [10, 'IPV (Polio Suntik)', 4],
      [11, 'Campak-Rubella (MR) 1', 9],
      [12, 'DPT-HB-Hib Booster', 18],
      [13, 'Campak-Rubella (MR) 2', 18],
    ];

    for (const row of imunisasiData) {
      await connection.execute(
        `INSERT IGNORE INTO imunisasi_master (id, nama_vaksin, usia_wajib_bulan) VALUES (?, ?, ?)`,
        row
      );
    }
    console.log('   ✅ 13 jenis imunisasi wajib\n');

    // ─── 5. Bahan Pangan Lokal (sampel) ──────────────────────
    console.log('🥕 Seeding bahan pangan lokal...');
    const bahanPangan = [
      [1, 'Telur Ayam', 155, 12.6, 1.2, 2000],
      [2, 'Ikan Lele', 90, 18.7, 0.5, 25000],
      [3, 'Tempe', 192, 20.8, 4.0, 5000],
      [4, 'Tahu', 76, 8.1, 1.7, 3000],
      [5, 'Bayam', 23, 2.9, 2.7, 5000],
      [6, 'Wortel', 41, 0.9, 0.3, 8000],
      [7, 'Labu Kuning', 26, 1.0, 0.8, 6000],
      [8, 'Ubi Jalar Merah', 86, 1.6, 0.6, 7000],
      [9, 'Kacang Hijau', 347, 22.2, 6.7, 18000],
      [10, 'Pisang Ambon', 89, 1.1, 0.3, 10000],
      [11, 'Beras Merah', 111, 2.6, 0.5, 15000],
      [12, 'Hati Ayam', 119, 16.9, 8.9, 30000],
      [13, 'Ikan Teri Kering', 277, 33.4, 3.5, 50000],
      [14, 'Santan Kelapa', 230, 2.3, 1.6, 12000],
      [15, 'Daun Kelor (Moringa)', 64, 6.7, 4.0, 3000],
    ];

    for (const row of bahanPangan) {
      await connection.execute(
        `INSERT IGNORE INTO bahan_pangan_lokal (id, nama_bahan, kalori, protein, zat_besi, harga_estimasi) VALUES (?, ?, ?, ?, ?, ?)`,
        row
      );
    }
    console.log('   ✅ 15 jenis bahan pangan lokal\n');

    // ─── 6. Resep MPASI (sampel) ─────────────────────────────
    console.log('🍲 Seeding resep MPASI...');
    const resepMpasi = [
      [1, 'Bubur Beras Merah Hati Ayam', '6-8', 'Rebus beras merah hingga lunak. Kukus hati ayam lalu haluskan. Campur beras dan hati ayam. Tambahkan sedikit minyak kelapa. Saring untuk bayi 6 bulan atau berikan langsung untuk bayi 8 bulan.', 185],
      [2, 'Pure Labu Kuning Teri', '6-8', 'Kukus labu kuning hingga empuk. Goreng teri tanpa minyak (sangrai). Haluskan labu dan teri bersama. Tambahkan ASI/susu formula sedikit untuk mengencerkan.', 160],
      [3, 'Nasi Tim Telur Bayam', '9-12', 'Masak nasi tim agak lunak. Orak-arik telur ayam. Rebus bayam dan potong kecil. Campur semua bahan. Tambahkan sedikit minyak wijen.', 220],
      [4, 'Sup Ikan Lele Wortel Tempe', '9-12', 'Rebus ikan lele tanpa tulang. Potong wortel kecil-kecil dan rebus. Kukus tempe lalu potong dadu kecil. Masak semua dalam kaldu ringan.', 195],
      [5, 'Bubur Kacang Hijau Pisang', '6-8', 'Rendam kacang hijau semalaman. Rebus kacang hijau hingga sangat lunak. Haluskan pisang ambon matang. Campur bubur kacang hijau dengan pisang.', 175],
      [6, 'Nasi Tim Moringa Telur', '9-12', 'Masak nasi tim dengan air secukupnya. Kukus daun kelor 3 menit. Orak-arik telur ayam. Campur nasi, daun kelor, dan telur. Beri minyak kelapa.', 210],
    ];

    for (const row of resepMpasi) {
      await connection.execute(
        `INSERT IGNORE INTO resep_mpasi (id, nama_resep, kelompok_usia_bulan, cara_pembuatan, total_kalori) VALUES (?, ?, ?, ?, ?)`,
        row
      );
    }
    console.log('   ✅ 6 resep MPASI\n');

    // ─── 7. Komposisi Resep ──────────────────────────────────
    console.log('📝 Seeding komposisi resep...');
    const komposisi = [
      [1, 1, 11, 30],  // Bubur Beras Merah + Beras Merah
      [2, 1, 12, 20],  // Bubur Beras Merah + Hati Ayam
      [3, 2, 7, 50],   // Pure Labu + Labu Kuning
      [4, 2, 13, 10],  // Pure Labu + Teri Kering
      [5, 3, 1, 30],   // Nasi Tim Telur Bayam + Telur
      [6, 3, 5, 20],   // Nasi Tim Telur Bayam + Bayam
      [7, 4, 2, 40],   // Sup Lele + Ikan Lele
      [8, 4, 6, 20],   // Sup Lele + Wortel
      [9, 4, 3, 20],   // Sup Lele + Tempe
      [10, 5, 9, 30],  // Bubur Kacang Hijau + Kacang Hijau
      [11, 5, 10, 40], // Bubur Kacang Hijau + Pisang
      [12, 6, 15, 15], // Nasi Moringa + Daun Kelor
      [13, 6, 1, 30],  // Nasi Moringa + Telur
    ];

    for (const row of komposisi) {
      await connection.execute(
        `INSERT IGNORE INTO komposisi_resep (id, resep_id, bahan_id, takaran_gram) VALUES (?, ?, ?, ?)`,
        row
      );
    }
    console.log('   ✅ 13 komposisi resep\n');

    await connection.commit();
    console.log('═══════════════════════════════════════════════');
    console.log('  ✅ Seeding database berhasil selesai!');
    console.log('  📧 Login: admin@tumbuhsehat.id / admin123');
    console.log('═══════════════════════════════════════════════');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Seeding gagal:', err);
    throw err;
  } finally {
    connection.release();
    process.exit(0);
  }
}

seed();
