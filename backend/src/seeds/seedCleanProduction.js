const bcrypt = require('bcryptjs');
const { pool, testConnection } = require('../config/database');

async function ensureTableConstraints(connection) {
  const [cols] = await connection.execute("SHOW COLUMNS FROM anak LIKE 'posyandu_id'");
  if (cols.length === 0) {
    await connection.execute("ALTER TABLE anak ADD COLUMN posyandu_id INT DEFAULT NULL");
    await connection.execute("ALTER TABLE anak ADD INDEX idx_anak_posyandu (posyandu_id)");
  }

  const [ukIndex] = await connection.execute(
    "SHOW INDEX FROM pengukuran_antropometri WHERE Key_name = 'uk_anak_tanggal'"
  );
  if (ukIndex.length === 0) {
    await connection.execute(
      "ALTER TABLE pengukuran_antropometri ADD UNIQUE KEY uk_anak_tanggal (anak_id, tanggal_ukur)"
    );
  }

  const [ukAnalisis] = await connection.execute(
    "SHOW INDEX FROM hasil_analisis_gizi WHERE Key_name = 'uk_pengukuran_id'"
  );
  if (ukAnalisis.length === 0) {
    await connection.execute(
      "ALTER TABLE hasil_analisis_gizi ADD UNIQUE KEY uk_pengukuran_id (pengukuran_id)"
    );
  }

  const syncTables = ['anak', 'pengukuran_antropometri', 'hasil_analisis_gizi'];
  for (const t of syncTables) {
    const [c] = await connection.execute(`SHOW COLUMNS FROM ${t} LIKE 'synced_to_supabase'`);
    if (c.length === 0) {
      await connection.execute(
        `ALTER TABLE ${t} ADD COLUMN synced_to_supabase TINYINT(1) NOT NULL DEFAULT 0, ADD INDEX idx_sync_supabase (synced_to_supabase)`
      );
    }
  }
}

async function seedCleanProduction() {
  await testConnection();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await ensureTableConstraints(connection);

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE rekomendasi_diberikan');
    await connection.execute('TRUNCATE TABLE catatan_imunisasi');
    await connection.execute('TRUNCATE TABLE catatan_vitamin');
    await connection.execute('TRUNCATE TABLE riwayat_penyakit');
    await connection.execute('TRUNCATE TABLE peringatan_dini');
    await connection.execute('TRUNCATE TABLE hasil_analisis_gizi');
    await connection.execute('TRUNCATE TABLE pengukuran_antropometri');
    await connection.execute('TRUNCATE TABLE kehadiran');
    await connection.execute('TRUNCATE TABLE antrean_sinkronisasi');
    await connection.execute('TRUNCATE TABLE anak');
    await connection.execute('TRUNCATE TABLE keluarga');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    await connection.execute(`INSERT IGNORE INTO peran (id, nama_peran) VALUES (1, 'Admin Puskesmas')`);
    await connection.execute(`INSERT IGNORE INTO peran (id, nama_peran) VALUES (2, 'Kader')`);

    await connection.execute(
      `INSERT INTO wilayah (id, nama_wilayah, tingkat, induk_id) 
       VALUES (10, 'Kecamatan Dringu', 'Kecamatan', NULL)
       ON DUPLICATE KEY UPDATE nama_wilayah = VALUES(nama_wilayah), tingkat = VALUES(tingkat)`
    );

    const desaList = [
      { id: 1, nama: 'Desa Dringu' },
      { id: 2, nama: 'Desa Kalisalam' },
      { id: 3, nama: 'Desa Kedungdalem' },
      { id: 4, nama: 'Desa Pabean' },
    ];

    for (const d of desaList) {
      await connection.execute(
        `INSERT INTO wilayah (id, nama_wilayah, tingkat, induk_id) 
         VALUES (?, ?, 'Desa', 10)
         ON DUPLICATE KEY UPDATE nama_wilayah = VALUES(nama_wilayah), induk_id = 10`,
        [d.id, d.nama]
      );
    }

    await connection.execute(
      `INSERT INTO puskesmas (id, nama_puskesmas, wilayah_id, alamat)
       VALUES (1, 'Puskesmas Dringu', 10, 'Jl. Raya Dringu No. 12, Dringu, Probolinggo')
       ON DUPLICATE KEY UPDATE nama_puskesmas = VALUES(nama_puskesmas), alamat = VALUES(alamat)`
    );

    const posyanduList = [
      { id: 1, nama: 'Posyandu Mawar 1', desaId: 1, alamat: 'Dusun Krajan RT 01/RW 01, Desa Dringu', slug: 'mawar1' },
      { id: 2, nama: 'Posyandu Mawar 2', desaId: 1, alamat: 'Dusun Krajan RT 02/RW 01, Desa Dringu', slug: 'mawar2' },
      { id: 3, nama: 'Posyandu Melati 1', desaId: 2, alamat: 'Dusun Tengah RT 01/RW 02, Desa Kalisalam', slug: 'melati1' },
      { id: 4, nama: 'Posyandu Melati 2', desaId: 2, alamat: 'Dusun Tengah RT 02/RW 02, Desa Kalisalam', slug: 'melati2' },
      { id: 5, nama: 'Posyandu Anggrek 1', desaId: 3, alamat: 'Dusun Pesisir RT 01/RW 03, Desa Kedungdalem', slug: 'anggrek1' },
      { id: 6, nama: 'Posyandu Anggrek 2', desaId: 3, alamat: 'Dusun Pesisir RT 02/RW 03, Desa Kedungdalem', slug: 'anggrek2' },
      { id: 7, nama: 'Posyandu Kamboja 1', desaId: 4, alamat: 'Dusun Krajan RT 01/RW 01, Desa Pabean', slug: 'kamboja1' },
      { id: 8, nama: 'Posyandu Kamboja 2', desaId: 4, alamat: 'Dusun Krajan RT 02/RW 01, Desa Pabean', slug: 'kamboja2' },
      { id: 9, nama: 'Posyandu Kenanga 1', desaId: 1, alamat: 'Dusun Barat RT 03/RW 02, Desa Dringu', slug: 'kenanga1' },
      { id: 10, nama: 'Posyandu Kenanga 2', desaId: 2, alamat: 'Dusun Timur RT 04/RW 03, Desa Kalisalam', slug: 'kenanga2' },
    ];

    for (const p of posyanduList) {
      await connection.execute(
        `INSERT INTO posyandu (id, nama_posyandu, puskesmas_id, wilayah_id, alamat)
         VALUES (?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE nama_posyandu = VALUES(nama_posyandu), wilayah_id = VALUES(wilayah_id), alamat = VALUES(alamat)`,
        [p.id, p.nama, p.desaId, p.alamat]
      );
    }

    const saltAdmin = await bcrypt.genSalt(10);
    const passAdmin = await bcrypt.hash('AdminDringu2026!', saltAdmin);

    await connection.execute(
      `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status)
       VALUES ('admin.dringu@tumbuhsehat.id', ?, 1, NULL, 'Aktif')
       ON DUPLICATE KEY UPDATE password = VALUES(password), peran_id = 1, posyandu_id = NULL, status = 'Aktif'`,
      [passAdmin]
    );

    const saltKader = await bcrypt.genSalt(10);
    const officialEmails = ['admin.dringu@tumbuhsehat.id'];

    for (const p of posyanduList) {
      const namaCapitalized = p.slug.charAt(0).toUpperCase() + p.slug.slice(1);
      const plainPassword = `Kader${namaCapitalized}2026!`;
      const hashedPassword = await bcrypt.hash(plainPassword, saltKader);
      const email = `kader.${p.slug}@tumbuhsehat.id`;
      officialEmails.push(email);

      await connection.execute(
        `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status)
         VALUES (?, ?, 2, ?, 'Aktif')
         ON DUPLICATE KEY UPDATE password = VALUES(password), peran_id = 2, posyandu_id = ?, status = 'Aktif'`,
        [email, hashedPassword, p.id, p.id]
      );

      const [u] = await connection.execute('SELECT id FROM pengguna WHERE email = ? LIMIT 1', [email]);
      const userId = u[0]?.id;

      if (userId) {
        await connection.execute(
          `INSERT INTO perangkat_kader (pengguna_id, kode_perangkat, token_offline, waktu_sync_terakhir)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE waktu_sync_terakhir = NOW()`,
          [userId, `TAB-DRINGU-${p.id.toString().padStart(2, '0')}`, `token_tab_${p.id}`]
        );
      }
    }

    await connection.query(
      `DELETE FROM pengguna WHERE email NOT IN (?)`,
      [officialEmails]
    );

    const todayStr = new Date().toISOString().split('T')[0];
    for (const p of posyanduList) {
      await connection.execute(
        `INSERT INTO jadwal_kegiatan (posyandu_id, tanggal_kegiatan, keterangan)
         VALUES (?, ?, ?)`,
        [p.id, todayStr, `Sesi Penimbangan Rutin ${p.nama}`]
      );
    }

    let balitaCount = 0;
    for (const p of posyanduList) {
      for (let i = 1; i <= 2; i++) {
        balitaCount++;
        const noKk = `3513010100${balitaCount.toString().padStart(4, '0')}`;
        const nikAnak = `351301010${(balitaCount * 11).toString().padStart(5, '0')}`;
        const gender = (balitaCount % 2 === 1) ? 'L' : 'P';

        const [kelRes] = await connection.execute(
          `INSERT INTO keluarga (no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon)
           VALUES (?, ?, ?, ?, ?)`,
          [
            noKk,
            `Bpk. Siswanto ${balitaCount}`,
            `Ibu Siti Rahma ${balitaCount}`,
            p.alamat,
            `081234567${balitaCount.toString().padStart(3, '0')}`
          ]
        );
        const keluargaId = kelRes.insertId;

        const ageMonths = 6 + ((balitaCount * 3) % 18);
        const birthDate = new Date();
        birthDate.setMonth(birthDate.getMonth() - ageMonths);
        const birthDateStr = birthDate.toISOString().split('T')[0];

        const beratLahir = gender === 'L' ? 3.2 : 3.1;
        const panjangLahir = gender === 'L' ? 49.5 : 48.8;
        const namaBalita = `${gender === 'L' ? 'Ananda' : 'Adinda'} ${p.slug.toUpperCase()} #${i}`;

        await connection.execute(
          `INSERT INTO anak (keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir, posyandu_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            keluargaId,
            nikAnak,
            namaBalita,
            gender,
            birthDateStr,
            beratLahir,
            panjangLahir,
            p.id
          ]
        );
      }
    }

    await connection.commit();
    console.log('Seeding Clean Production selesai.');
    console.log('Admin Puskesmas: admin.dringu@tumbuhsehat.id / AdminDringu2026!');
    console.log('10 Akun Kader: kader.[posyandu]@tumbuhsehat.id / Kader[Nama]2026!');
    console.log(`20 Balita terdaftar di 10 Posyandu.`);
    process.exit(0);
  } catch (error) {
    await connection.rollback();
    console.error('Gagal menjalankan seeding:', error);
    process.exit(1);
  }
}

seedCleanProduction();
