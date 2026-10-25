const bcrypt = require('bcryptjs');
const { pool, testConnection } = require('../config/database');

async function ensureColumns(connection) {
  const [cols] = await connection.execute("SHOW COLUMNS FROM anak LIKE 'posyandu_id'");
  if (cols.length === 0) {
    console.log('   ➕ Menambahkan kolom posyandu_id ke tabel anak...');
    await connection.execute("ALTER TABLE anak ADD COLUMN posyandu_id INT DEFAULT NULL");
    await connection.execute("ALTER TABLE anak ADD INDEX idx_anak_posyandu (posyandu_id)");
  }
}

async function seed() {
  await testConnection();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log('🌱 Memulai Seeding Komprehensif Multi-Wilayah & Multi-Periode...\n');

    await ensureColumns(connection);

    // 1. Data Peran
    console.log('1. Memeriksa tabel peran...');
    await connection.execute(`INSERT IGNORE INTO peran (id, nama_peran) VALUES (1, 'Admin Puskesmas')`);
    await connection.execute(`INSERT IGNORE INTO peran (id, nama_peran) VALUES (2, 'Kader')`);

    // 2. Data Wilayah (Kecamatan Dringu & 4 Desa)
    console.log('2. Seeding wilayah Kecamatan Dringu dan 4 Desa...');
    await connection.execute(
      `INSERT INTO wilayah (id, nama_wilayah, tingkat, induk_id) 
       VALUES (10, 'Kecamatan Dringu', 'Kecamatan', NULL)
       ON DUPLICATE KEY UPDATE nama_wilayah = VALUES(nama_wilayah), tingkat = VALUES(tingkat)`
    );

    const desaData = [
      { id: 1, nama: 'Desa Dringu' },
      { id: 2, nama: 'Desa Kalisalam' },
      { id: 3, nama: 'Desa Kedungdalem' },
      { id: 4, nama: 'Desa Pabean' },
    ];

    for (const d of desaData) {
      await connection.execute(
        `INSERT INTO wilayah (id, nama_wilayah, tingkat, induk_id) 
         VALUES (?, ?, 'Desa', 10)
         ON DUPLICATE KEY UPDATE nama_wilayah = VALUES(nama_wilayah), induk_id = 10`,
        [d.id, d.nama]
      );
    }

    // 3. Data Puskesmas
    console.log('3. Seeding Puskesmas Dringu...');
    await connection.execute(
      `INSERT INTO puskesmas (id, nama_puskesmas, wilayah_id, alamat)
       VALUES (1, 'Puskesmas Dringu', 10, 'Jl. Raya Dringu No. 12, Dringu, Probolinggo')
       ON DUPLICATE KEY UPDATE nama_puskesmas = VALUES(nama_puskesmas), alamat = VALUES(alamat)`
    );

    // 4. Data 4 Posyandu
    console.log('4. Seeding 4 Posyandu di Kecamatan Dringu...');
    const posyanduList = [
      { id: 1, nama: 'Posyandu Mawar', desaId: 1, alamat: 'Dusun Krajan, RT 02/RW 01, Desa Dringu' },
      { id: 2, nama: 'Posyandu Melati', desaId: 2, alamat: 'Dusun Tengah, RT 04/RW 02, Desa Kalisalam' },
      { id: 3, nama: 'Posyandu Anggrek', desaId: 3, alamat: 'Dusun Pesisir, RT 01/RW 03, Desa Kedungdalem' },
      { id: 4, nama: 'Posyandu Kamboja', desaId: 4, alamat: 'Dusun Krajan, RT 03/RW 01, Desa Pabean' },
    ];

    for (const p of posyanduList) {
      await connection.execute(
        `INSERT INTO posyandu (id, nama_posyandu, puskesmas_id, wilayah_id, alamat)
         VALUES (?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE nama_posyandu = VALUES(nama_posyandu), wilayah_id = VALUES(wilayah_id), alamat = VALUES(alamat)`,
        [p.id, p.nama, p.desaId, p.alamat]
      );
    }

    // 5. Akun Pengguna Uji
    console.log('5. Seeding akun pengguna uji (Admin & Kader)...');
    const salt = await bcrypt.genSalt(10);
    const passAdmin = await bcrypt.hash('admin123', salt);
    const passKader = await bcrypt.hash('kader123', salt);

    // Admin Puskesmas
    await connection.execute(
      `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status)
       VALUES ('admin.dringu@tumbuhsehat.id', ?, 1, NULL, 'Aktif')
       ON DUPLICATE KEY UPDATE password = VALUES(password), peran_id = 1, posyandu_id = NULL, status = 'Aktif'`,
      [passAdmin]
    );

    // Akun default lama dipastikan tetap aktif
    await connection.execute(
      `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status)
       VALUES ('admin@tumbuhsehat.id', ?, 1, NULL, 'Aktif')
       ON DUPLICATE KEY UPDATE password = VALUES(password), peran_id = 1, status = 'Aktif'`,
      [passAdmin]
    );

    // Kader Posyandu Mawar (posyandu_id: 1)
    await connection.execute(
      `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status)
       VALUES ('kader.mawar@tumbuhsehat.id', ?, 2, 1, 'Aktif')
       ON DUPLICATE KEY UPDATE password = VALUES(password), peran_id = 2, posyandu_id = 1, status = 'Aktif'`,
      [passKader]
    );

    // Kader Posyandu Melati (posyandu_id: 2)
    await connection.execute(
      `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status)
       VALUES ('kader.melati@tumbuhsehat.id', ?, 2, 2, 'Aktif')
       ON DUPLICATE KEY UPDATE password = VALUES(password), peran_id = 2, posyandu_id = 2, status = 'Aktif'`,
      [passKader]
    );

    // Ambil ID pengguna kader untuk relasi data
    const [usrMawar] = await connection.execute(`SELECT id FROM pengguna WHERE email = 'kader.mawar@tumbuhsehat.id' LIMIT 1`);
    const [usrMelati] = await connection.execute(`SELECT id FROM pengguna WHERE email = 'kader.melati@tumbuhsehat.id' LIMIT 1`);
    const kaderMawarId = usrMawar[0]?.id || 1;
    const kaderMelatiId = usrMelati[0]?.id || 1;

    // Perangkat Kader aktif
    await connection.execute(
      `INSERT INTO perangkat_kader (pengguna_id, kode_perangkat, token_offline, waktu_sync_terakhir)
       VALUES (?, 'TAB-DRINGU-01', 'token_tab_01', NOW())
       ON DUPLICATE KEY UPDATE waktu_sync_terakhir = NOW()`,
      [kaderMawarId]
    );
    await connection.execute(
      `INSERT INTO perangkat_kader (pengguna_id, kode_perangkat, token_offline, waktu_sync_terakhir)
       VALUES (?, 'TAB-DRINGU-02', 'token_tab_02', NOW())
       ON DUPLICATE KEY UPDATE waktu_sync_terakhir = NOW()`,
      [kaderMelatiId]
    );

    // 6. Jadwal Kegiatan Posyandu (6 Bulan: April 2026 s.d. September 2026)
    console.log('6. Seeding jadwal posyandu 6 periode (April s.d. September 2026)...');
    const periods = [
      { label: 'Apr 2026', dateStr: '2026-04' },
      { label: 'Mei 2026', dateStr: '2026-05' },
      { label: 'Jun 2026', dateStr: '2026-06' },
      { label: 'Jul 2026', dateStr: '2026-07' },
      { label: 'Agu 2026', dateStr: '2026-08' },
      { label: 'Sep 2026', dateStr: '2026-09' },
    ];

    // Simpan jadwalMap: key = `${posyanduId}_${periodIdx}`
    const jadwalMap = {};
    for (let posId = 1; posId <= 4; posId++) {
      const dayOffset = 10 + (posId * 2); // tgl 12, 14, 16, 18
      for (let pIdx = 0; pIdx < periods.length; pIdx++) {
        const tgl = `${periods[pIdx].dateStr}-${String(dayOffset).padStart(2, '0')}`;
        const [res] = await connection.execute(
          `INSERT INTO jadwal_kegiatan (posyandu_id, tanggal_kegiatan, keterangan)
           VALUES (?, ?, ?)`,
          [posId, tgl, `Penimbangan Rutin ${periods[pIdx].label} - Posyandu ${posId}`]
        );
        jadwalMap[`${posId}_${pIdx}`] = res.insertId;
      }
    }

    // 7. Seed 48 Balita (12 balita per Posyandu) & Riwayat Pengukuran Antropometri
    console.log('7. Seeding 48 balita dan 288 data riwayat pengukuran antropometri...');

    const masterBalita = [
      // Posyandu 1: Posyandu Mawar (Desa Dringu)
      { posId: 1, nama: 'Muhammad Rizky Pratama', jk: 'L', lahir: '2024-10-15', bbl: 3.2, pbl: 49.5, ayah: 'Budi Santoso', ibu: 'Siti Rahmawati', statusType: 'normal' },
      { posId: 1, nama: 'Aisyah Putri Azzahra', jk: 'P', lahir: '2024-11-20', bbl: 3.0, pbl: 48.5, ayah: 'Agus Wijaya', ibu: 'Nurul Hidayah', statusType: 'normal' },
      { posId: 1, nama: 'Alvaro Kenzo Danendra', jk: 'L', lahir: '2025-01-10', bbl: 3.1, pbl: 49.0, ayah: 'Hendra Gunawan', ibu: 'Dewi Lestari', statusType: 'normal' },
      { posId: 1, nama: 'Zahra Bilqis Ramadhani', jk: 'P', lahir: '2024-12-05', bbl: 2.9, pbl: 48.0, ayah: 'Eko Wahyudi', ibu: 'Indah Permata', statusType: 'normal' },
      { posId: 1, nama: 'Bilal Hafiz Al-Fatih', jk: 'L', lahir: '2025-02-18', bbl: 3.3, pbl: 50.0, ayah: 'Fajar Nugroho', ibu: 'Rina Marlina', statusType: 'normal' },
      { posId: 1, nama: 'Fatir Ahmad Maulana', jk: 'L', lahir: '2024-09-12', bbl: 2.7, pbl: 47.0, ayah: 'Teguh Prasetyo', ibu: 'Wulandari', statusType: 'stunted' },
      { posId: 1, nama: 'Naura Salsabila', jk: 'P', lahir: '2024-08-25', bbl: 2.5, pbl: 46.5, ayah: 'Arif Hidayat', ibu: 'Sri Utami', statusType: 'stunted' },
      { posId: 1, nama: 'Raffa Raditya', jk: 'L', lahir: '2024-07-30', bbl: 2.4, pbl: 45.0, ayah: 'Yudi Irawan', ibu: 'Kurniawati', statusType: 'severely_stunted' },
      { posId: 1, nama: 'Khadijah Maryam', jk: 'P', lahir: '2025-03-05', bbl: 2.8, pbl: 48.0, ayah: 'Surya Pratama', ibu: 'Aminah', statusType: 'underweight' },
      { posId: 1, nama: 'Aditya Bagus Saputra', jk: 'L', lahir: '2024-11-10', bbl: 3.0, pbl: 49.0, ayah: 'Dedi Kurniawan', ibu: 'Tri Wahyuni', statusType: 'faltering' },
      { posId: 1, nama: 'Kayla Nur Azka', jk: 'P', lahir: '2025-01-22', bbl: 3.1, pbl: 49.0, ayah: 'Rian Syahputra', ibu: 'Mita Anggraini', statusType: 'normal' },
      { posId: 1, nama: 'Reno Rayyan Gibran', jk: 'L', lahir: '2024-12-28', bbl: 3.2, pbl: 49.5, ayah: 'Lukman Hakim', ibu: 'Fitri Handayani', statusType: 'normal' },

      // Posyandu 2: Posyandu Melati (Desa Kalisalam)
      { posId: 2, nama: 'Dimas Arya Pamungkas', jk: 'L', lahir: '2024-10-05', bbl: 3.1, pbl: 49.0, ayah: 'Joko Susilo', ibu: 'Anisa Maharani', statusType: 'normal' },
      { posId: 2, nama: 'Aqila Shafa Medina', jk: 'P', lahir: '2024-11-15', bbl: 3.0, pbl: 48.0, ayah: 'Hadi Prayitno', ibu: 'Neneng Hasanah', statusType: 'normal' },
      { posId: 2, nama: 'Arka Tristan Xavier', jk: 'L', lahir: '2025-02-01', bbl: 3.4, pbl: 50.0, ayah: 'Bambang Supriadi', ibu: 'Lilis Suryani', statusType: 'normal' },
      { posId: 2, nama: 'Syifa Humaira', jk: 'P', lahir: '2024-12-12', bbl: 2.9, pbl: 48.0, ayah: 'Wahyu Darmawan', ibu: 'Ratna Sari', statusType: 'normal' },
      { posId: 2, nama: 'Danendra Bintang', jk: 'L', lahir: '2025-03-10', bbl: 3.0, pbl: 48.5, ayah: 'Didik Hermanto', ibu: 'Endang Sulastri', statusType: 'normal' },
      { posId: 2, nama: 'Gilang Ramadhan', jk: 'L', lahir: '2024-09-18', bbl: 2.6, pbl: 46.5, ayah: 'Heru Prasetyo', ibu: 'Eni Rohmawati', statusType: 'stunted' },
      { posId: 2, nama: 'Nadhira Khansa', jk: 'P', lahir: '2024-08-10', bbl: 2.5, pbl: 46.0, ayah: 'Syaiful Bahri', ibu: 'Umi Kalsum', statusType: 'stunted' },
      { posId: 2, nama: 'Haidar Ali Wafa', jk: 'L', lahir: '2024-06-15', bbl: 2.3, pbl: 44.5, ayah: 'Mansur Efendi', ibu: 'Halimah', statusType: 'severely_stunted' },
      { posId: 2, nama: 'Tasya Salsabila', jk: 'P', lahir: '2025-02-25', bbl: 2.7, pbl: 47.5, ayah: 'Supriyadi', ibu: 'Ida Royani', statusType: 'underweight' },
      { posId: 2, nama: 'Rasyid Ibrahim', jk: 'L', lahir: '2024-10-28', bbl: 3.0, pbl: 48.5, ayah: 'Misnan', ibu: 'Nur Hayati', statusType: 'faltering' },
      { posId: 2, nama: 'Farhan Maulana', jk: 'L', lahir: '2025-01-14', bbl: 3.2, pbl: 49.5, ayah: 'Agus Subagio', ibu: 'Sulastri', statusType: 'normal' },
      { posId: 2, nama: 'Alina Zahira', jk: 'P', lahir: '2024-12-02', bbl: 3.1, pbl: 49.0, ayah: 'Suwarno', ibu: 'Yuliana', statusType: 'normal' },

      // Posyandu 3: Posyandu Anggrek (Desa Kedungdalem)
      { posId: 3, nama: 'Bima Sakti Yudhistira', jk: 'L', lahir: '2024-09-30', bbl: 3.2, pbl: 49.5, ayah: 'Kuswanto', ibu: 'Sri Handayani', statusType: 'normal' },
      { posId: 3, nama: 'Callysta Putri', jk: 'P', lahir: '2024-11-08', bbl: 3.0, pbl: 48.5, ayah: 'Hadi Siswanto', ibu: 'Sunarti', statusType: 'normal' },
      { posId: 3, nama: 'Kenan Rafaeyza', jk: 'L', lahir: '2025-01-18', bbl: 3.3, pbl: 50.0, ayah: 'Ahmad Fauzi', ibu: 'Rostina', statusType: 'normal' },
      { posId: 3, nama: 'Dinda Kirana', jk: 'P', lahir: '2024-12-20', bbl: 2.9, pbl: 48.0, ayah: 'Sudrajat', ibu: 'Maryati', statusType: 'normal' },
      { posId: 3, nama: 'Fandi Achmad', jk: 'L', lahir: '2025-02-11', bbl: 3.1, pbl: 49.0, ayah: 'Subhan', ibu: 'Hartatik', statusType: 'normal' },
      { posId: 3, nama: 'Galang Anugerah', jk: 'L', lahir: '2024-08-14', bbl: 2.6, pbl: 46.0, ayah: 'Imron Rosyadi', ibu: 'Maimunah', statusType: 'stunted' },
      { posId: 3, nama: 'Hanum Salsabila', jk: 'P', lahir: '2024-07-22', bbl: 2.5, pbl: 45.5, ayah: 'Mulyono', ibu: 'Tutik Alawiyah', statusType: 'stunted' },
      { posId: 3, nama: 'Ilham Jaya Kusuma', jk: 'L', lahir: '2024-06-05', bbl: 2.3, pbl: 44.0, ayah: 'Sugiono', ibu: 'Jamilah', statusType: 'severely_stunted' },
      { posId: 3, nama: 'Jasmine Nadia', jk: 'P', lahir: '2025-02-05', bbl: 2.7, pbl: 47.0, ayah: 'Nasiruddin', ibu: 'Khoiriyah', statusType: 'underweight' },
      { posId: 3, nama: 'Kenzie Alvaro', jk: 'L', lahir: '2024-11-25', bbl: 3.0, pbl: 48.5, ayah: 'Sukoco', ibu: 'Siti Aminah', statusType: 'faltering' },
      { posId: 3, nama: 'Luthfi Hakim', jk: 'L', lahir: '2025-01-05', bbl: 3.2, pbl: 49.0, ayah: 'Zainal Arifin', ibu: 'Khotimah', statusType: 'normal' },
      { posId: 3, nama: 'Meisya Aurelia', jk: 'P', lahir: '2024-12-15', bbl: 3.0, pbl: 48.5, ayah: 'Purnomo', ibu: 'Rohani', statusType: 'normal' },

      // Posyandu 4: Posyandu Kamboja (Desa Pabean)
      { posId: 4, nama: 'Nabil Al-Farizi', jk: 'L', lahir: '2024-10-12', bbl: 3.2, pbl: 49.5, ayah: 'Khoirul Anam', ibu: 'Mariyani', statusType: 'normal' },
      { posId: 4, nama: 'Olivia Dania', jk: 'P', lahir: '2024-11-28', bbl: 3.0, pbl: 48.5, ayah: 'Suhadi', ibu: 'Wahyuni', statusType: 'normal' },
      { posId: 4, nama: 'Pandu Pratama', jk: 'L', lahir: '2025-01-25', bbl: 3.3, pbl: 49.5, ayah: 'Bahrul Ulum', ibu: 'Fatimah', statusType: 'normal' },
      { posId: 4, nama: 'Qiana Shaqueena', jk: 'P', lahir: '2024-12-08', bbl: 2.9, pbl: 48.0, ayah: 'Rosyid Ridho', ibu: 'Siti Maryam', statusType: 'normal' },
      { posId: 4, nama: 'Raden Mas Arya', jk: 'L', lahir: '2025-02-20', bbl: 3.1, pbl: 49.0, ayah: 'Djoko Taruno', ibu: 'Sulastri', statusType: 'normal' },
      { posId: 4, nama: 'Satria Dewa', jk: 'L', lahir: '2024-09-05', bbl: 2.6, pbl: 46.5, ayah: 'Slamet Riyadi', ibu: 'Umi Kulsum', statusType: 'stunted' },
      { posId: 4, nama: 'Tiara Andini', jk: 'P', lahir: '2024-08-01', bbl: 2.5, pbl: 46.0, ayah: 'Mat Roji', ibu: 'Kholifah', statusType: 'stunted' },
      { posId: 4, nama: 'Umar Dani', jk: 'L', lahir: '2024-05-20', bbl: 2.2, pbl: 44.0, ayah: 'Hasim Asyari', ibu: 'Maimun', statusType: 'severely_stunted' },
      { posId: 4, nama: 'Vania Zhafira', jk: 'P', lahir: '2025-03-01', bbl: 2.7, pbl: 47.0, ayah: 'Abdul Gani', ibu: 'Ruqoyyah', statusType: 'underweight' },
      { posId: 4, nama: 'Wahyu Nugraha', jk: 'L', lahir: '2024-11-05', bbl: 3.0, pbl: 48.5, ayah: 'Suwandi', ibu: 'Sri Rejeki', statusType: 'faltering' },
      { posId: 4, nama: 'Yusuf Habibi', jk: 'L', lahir: '2025-01-11', bbl: 3.2, pbl: 49.5, ayah: 'Lukman Syafei', ibu: 'Farida', statusType: 'normal' },
      { posId: 4, nama: 'Zalfa Naqiyya', jk: 'P', lahir: '2024-12-25', bbl: 3.0, pbl: 48.0, ayah: 'Muhaimin', ibu: 'Musyarofah', statusType: 'normal' },
    ];

    let anakCounter = 1;

    for (const b of masterBalita) {
      const noKk = `351308${String(b.posId).padStart(2, '0')}${String(anakCounter).padStart(4, '0')}0001`;
      const nik = `351308${b.jk === 'L' ? '12' : '52'}${b.lahir.replace(/-/g, '').slice(2)}${String(anakCounter).padStart(4, '0')}`;
      const desaName = desaData.find(d => d.id === b.posId)?.nama || 'Desa Dringu';
      const alamat = `RT 0${(anakCounter % 5) + 1}/RW 0${(anakCounter % 3) + 1}, ${desaName}`;
      const noTelp = `0812${String(34567890 + anakCounter)}`;

      // 1. Simpan Keluarga
      const [kelRes] = await connection.execute(
        `INSERT INTO keluarga (no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama_ayah = VALUES(nama_ayah), nama_ibu = VALUES(nama_ibu), alamat_domisili = VALUES(alamat_domisili)`,
        [noKk, b.ayah, b.ibu, alamat, noTelp]
      );
      const keluargaId = kelRes.insertId || anakCounter;

      // 2. Simpan Anak
      const [anakRes] = await connection.execute(
        `INSERT INTO anak (keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir, posyandu_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama_lengkap = VALUES(nama_lengkap), posyandu_id = VALUES(posyandu_id)`,
        [keluargaId, nik, b.nama, b.jk, b.lahir, b.bbl, b.pbl, b.posId]
      );
      const anakId = anakRes.insertId;

      // Kader penanggung jawab pengukuran
      const kaderId = (b.posId === 2) ? kaderMelatiId : kaderMawarId;

      // 3. Generate Riwayat Pengukuran 6 Bulan (April 2026 s.d. September 2026)
      const birthDate = new Date(b.lahir);
      let prevBb = 0;

      for (let pIdx = 0; pIdx < periods.length; pIdx++) {
        const period = periods[pIdx];
        const dayOffset = 10 + (b.posId * 2);
        const tglUkur = `${period.dateStr}-${String(dayOffset).padStart(2, '0')}`;
        const jadwalId = jadwalMap[`${b.posId}_${pIdx}`];

        const ukurDate = new Date(tglUkur);
        let usiaBulan = (ukurDate.getFullYear() - birthDate.getFullYear()) * 12 + (ukurDate.getMonth() - birthDate.getMonth());
        if (ukurDate.getDate() < birthDate.getDate()) usiaBulan--;
        usiaBulan = Math.max(1, usiaBulan);

        let baseTb = 50 + (usiaBulan * 1.35);
        let baseBb = 3.4 + (usiaBulan * 0.42);

        let zTbu = 0.0;
        let zBbu = 0.0;
        let zBbtb = 0.0;
        let statusStunting = 'Normal';
        let indikasiFaltering = 0;
        let bb = 0.0;
        let tb = 0.0;

        if (b.statusType === 'normal') {
          zTbu = -0.3 + ((pIdx * 0.05) - (anakCounter % 3) * 0.2);
          zBbu = 0.1 + ((pIdx * 0.04) - (anakCounter % 2) * 0.15);
          statusStunting = 'Normal';
          tb = baseTb + (zTbu * 2.8);
          bb = baseBb + (zBbu * 0.9);
        } else if (b.statusType === 'stunted') {
          zTbu = -2.25 - (pIdx * 0.04);
          zBbu = -1.40 - (pIdx * 0.03);
          statusStunting = 'Stunted';
          tb = baseTb + (zTbu * 2.7);
          bb = baseBb + (zBbu * 0.85);
        } else if (b.statusType === 'severely_stunted') {
          zTbu = -3.20 - (pIdx * 0.05);
          zBbu = -2.80 - (pIdx * 0.04);
          statusStunting = 'Severely Stunted';
          tb = baseTb + (zTbu * 2.6);
          bb = baseBb + (zBbu * 0.8);
        } else if (b.statusType === 'underweight') {
          zTbu = -1.65 + (pIdx * 0.02);
          zBbu = -2.35 - (pIdx * 0.04);
          statusStunting = 'Normal';
          tb = baseTb + (zTbu * 2.8);
          bb = baseBb + (zBbu * 0.85);
        } else if (b.statusType === 'faltering') {
          zTbu = -1.85 - (pIdx * 0.03);
          if (pIdx >= 4) {
            indikasiFaltering = 1;
            zBbu = -1.95 - ((pIdx - 3) * 0.35);
          } else {
            zBbu = -1.20 + (pIdx * 0.05);
          }
          statusStunting = (zTbu < -2.0) ? 'Stunted' : 'Normal';
          tb = baseTb + (zTbu * 2.7);
          bb = (pIdx >= 4 && prevBb > 0) ? prevBb - 0.10 : baseBb + (zBbu * 0.85);
        }

        bb = Math.round(bb * 100) / 100;
        tb = Math.round(tb * 10) / 10;
        zTbu = Math.round(zTbu * 100) / 100;
        zBbu = Math.round(zBbu * 100) / 100;
        zBbtb = Math.round((zBbu - (zTbu * 0.5)) * 100) / 100;
        prevBb = bb;

        const [hadirRes] = await connection.execute(
          `INSERT INTO kehadiran (jadwal_id, anak_id, waktu_datang, status_hadir)
           VALUES (?, ?, '08:30:00', 'Hadir')`,
          [jadwalId, anakId]
        );
        const kehadiranId = hadirRes.insertId;

        const [ukurRes] = await connection.execute(
          `INSERT INTO pengukuran_antropometri 
           (kehadiran_id, anak_id, tanggal_ukur, berat_badan, tinggi_badan, lingkar_kepala, kader_id)
           VALUES (?, ?, ?, ?, ?, 45.0, ?)`,
          [kehadiranId, anakId, tglUkur, bb, tb, kaderId]
        );
        const pengukuranId = ukurRes.insertId;

        await connection.execute(
          `INSERT INTO hasil_analisis_gizi 
           (pengukuran_id, zscore_bbu, zscore_tbu, zscore_bbtb, status_stunting, indikasi_faltering)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pengukuranId, zBbu, zTbu, zBbtb, statusStunting, indikasiFaltering]
        );

        if (pIdx === periods.length - 1) {
          if (statusStunting === 'Severely Stunted') {
            await connection.execute(
              `INSERT INTO peringatan_dini (anak_id, tingkat_bahaya, pesan_peringatan, status_tindak_lanjut)
               VALUES (?, 'Merah', 'Status Sangat Pendek (Severely Stunted). Perlu rujukan segera ke Dokter Spesialis Anak / Faskes Rujukan.', 'Belum')`,
              [anakId]
            );
          } else if (statusStunting === 'Stunted' || indikasiFaltering === 1) {
            await connection.execute(
              `INSERT INTO peringatan_dini (anak_id, tingkat_bahaya, pesan_peringatan, status_tindak_lanjut)
               VALUES (?, 'Kuning', 'Indikasi Stunting / Growth Faltering terdeteksi. Segera berikan edukasi gizi dan intervensi PMT pangan lokal tinggi protein.', 'Belum')`,
              [anakId]
            );
          }
        }
      }

      anakCounter++;
    }

    await connection.commit();
    console.log('\n✅ Seeding multi-wilayah dan multi-periode berhasil diselesaikan!');
    console.log('📊 Ringkasan:');
    console.log('   - 4 Posyandu: Mawar, Melati, Anggrek, Kamboja');
    console.log('   - 3 Akun Uji:');
    console.log('     * Admin Puskesmas : admin.dringu@tumbuhsehat.id / admin123 (Akses Semua Posyandu)');
    console.log('     * Kader Mawar     : kader.mawar@tumbuhsehat.id / kader123 (posyandu_id: 1)');
    console.log('     * Kader Melati    : kader.melati@tumbuhsehat.id / kader123 (posyandu_id: 2)');
    console.log(`   - 48 Data Balita (${anakCounter - 1} balita) terdaftar`);
    console.log(`   - 288 Data Pengukuran Antropometri & Analisis Gizi (6 Bulan: Apr s.d. Sep 2026)`);

    process.exit(0);
  } catch (error) {
    await connection.rollback();
    console.error('❌ Terjadi kesalahan saat seeding:', error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

seed();
