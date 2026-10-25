const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authLimiter } = require('../middleware/rateLimiter');

const JWT_SECRET = process.env.JWT_SECRET || 'tumbuhsehat_supersecret_key_change_me';

async function showLogin(req, res) {
  const token = req.cookies?.token;
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      return res.redirect('/dashboard');
    } catch (e) {
    }
  }

  res.render('login', {
    title: 'Login - TumbuhSehat Puskesmas',
    error: null,
    success: req.query.registered === '1' ? 'Registrasi berhasil! Silakan masuk dengan akun baru Anda.' : null,
  });
}

async function processLogin(req, res) {
  const { email, password } = req.body;

  const emailClean = (email || '').trim().toLowerCase();
  const passwordClean = (password || '').trim();

  if (!emailClean || !passwordClean) {
    return res.render('login', {
      title: 'Login - TumbuhSehat Puskesmas',
      error: 'Email dan password wajib diisi.',
      success: null,
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.email, p.password, p.peran_id, p.posyandu_id, p.status, pr.nama_peran,
              pos.nama_posyandu,
              COALESCE(pusk.nama_puskesmas, 'Puskesmas Dringu') as nama_puskesmas,
              COALESCE(w.nama_wilayah, 'Kecamatan Dringu') as nama_kecamatan
       FROM pengguna p 
       JOIN peran pr ON p.peran_id = pr.id 
       LEFT JOIN posyandu pos ON p.posyandu_id = pos.id
       LEFT JOIN puskesmas pusk ON (pos.puskesmas_id = pusk.id OR p.peran_id = 1)
       LEFT JOIN wilayah w ON pusk.wilayah_id = w.id
       WHERE LOWER(TRIM(p.email)) = ? AND p.status = 'Aktif' 
       LIMIT 1`,
      [emailClean]
    );

    if (rows.length === 0) {
      return res.render('login', {
        title: 'Login - TumbuhSehat Puskesmas',
        error: 'Email atau password salah.',
        success: null,
      });
    }

    const user = rows[0];
    const isMatch = (await bcrypt.compare(passwordClean, user.password)) || (await bcrypt.compare(password, user.password));

    if (!isMatch) {
      return res.render('login', {
        title: 'Login - TumbuhSehat Puskesmas',
        error: 'Email atau password salah.',
        success: null,
      });
    }

    const displayName = user.peran_id === 1
      ? 'dr. Siti Aminah'
      : (user.nama_posyandu ? `Kader ${user.nama_posyandu}` : user.email.split('@')[0]);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        peran: user.nama_peran,
        nama: displayName,
        posyandu_id: user.posyandu_id,
        nama_posyandu: user.nama_posyandu || null,
        nama_puskesmas: user.nama_puskesmas || 'Puskesmas Dringu',
        nama_kecamatan: user.nama_kecamatan || 'Kecamatan Dringu',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('[Web Login Error]:', error);
    return res.render('login', {
      title: 'Login - TumbuhSehat Puskesmas',
      error: 'Terjadi kesalahan sistem. Coba lagi.',
      success: null,
    });
  }
}

async function showRegister(req, res) {
  const token = req.cookies?.token;
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      return res.redirect('/dashboard');
    } catch (e) {
    }
  }

  const [peranList] = await pool.execute(`SELECT id, nama_peran FROM peran ORDER BY id`);
  const [posyanduList] = await pool.execute(`SELECT id, nama_posyandu FROM posyandu ORDER BY nama_posyandu`);

  res.render('register', {
    title: 'Registrasi Petugas - TumbuhSehat',
    error: null,
    formData: {},
    peranList,
    posyanduList,
  });
}

async function processRegister(req, res) {
  const { nama_lengkap, nik_nip, email, password, confirm_password, peran_id, posyandu_id } = req.body;

  const [peranList] = await pool.execute(`SELECT id, nama_peran FROM peran ORDER BY id`);
  const [posyanduList] = await pool.execute(`SELECT id, nama_posyandu FROM posyandu ORDER BY nama_posyandu`);
  const formData = { nama_lengkap, nik_nip, email, peran_id, posyandu_id };

  const renderError = (msg) => {
    return res.render('register', {
      title: 'Registrasi Petugas - TumbuhSehat',
      error: msg,
      formData,
      peranList,
      posyanduList,
    });
  };

  if (!nama_lengkap || !email || !password || !confirm_password || !peran_id) {
    return renderError('Semua field wajib harus diisi.');
  }

  if (password.length < 6) {
    return renderError('Kata sandi minimal 6 karakter.');
  }

  if (password !== confirm_password) {
    return renderError('Konfirmasi kata sandi tidak cocok.');
  }

  try {
    const [existing] = await pool.execute(`SELECT id FROM pengguna WHERE email = ? LIMIT 1`, [email]);
    if (existing.length > 0) {
      return renderError('Email sudah terdaftar. Gunakan email lain atau langsung login.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status) VALUES (?, ?, ?, ?, 'Aktif')`,
      [email, hashedPassword, parseInt(peran_id, 10), posyandu_id ? parseInt(posyandu_id, 10) : null]
    );

    return res.redirect('/login?registered=1');
  } catch (error) {
    console.error('[Web Register Error]:', error);
    return renderError('Terjadi kesalahan sistem. Coba lagi.');
  }
}

function logout(req, res) {
  res.clearCookie('token');
  res.redirect('/login');
}

function webAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.webUser = decoded;
    next();
  } catch (e) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

async function fetchSurveillanceStats(posyanduId = null) {
  const wherePosyandu = posyanduId ? 'WHERE a.posyandu_id = ?' : '';
  const paramsPosyandu = posyanduId ? [posyanduId] : [];
  const [balitaRes] = await pool.execute(
    `SELECT COUNT(*) as count FROM anak a ${wherePosyandu}`,
    paramsPosyandu
  );
  const totalBalita = balitaRes[0].count || 0;
  const [latestRows] = await pool.execute(
    `SELECT 
       a.id as anak_id, a.posyandu_id, a.nama_lengkap, a.nik, a.jenis_kelamin, 
       DATE_FORMAT(a.tanggal_lahir, '%Y-%m-%d') as tanggal_lahir,
       k.nama_ibu, k.alamat_domisili,
       p.id as pengukuran_id, p.berat_badan, p.tinggi_badan, 
       DATE_FORMAT(p.tanggal_ukur, '%d %b %Y') as tanggal_ukur,
       h.zscore_tbu, h.zscore_bbu, h.status_stunting, h.indikasi_faltering,
       pd.tingkat_bahaya, pd.pesan_peringatan, pd.status_tindak_lanjut,
       pos.nama_posyandu
     FROM anak a
     LEFT JOIN keluarga k ON a.keluarga_id = k.id
     LEFT JOIN posyandu pos ON a.posyandu_id = pos.id
     INNER JOIN pengukuran_antropometri p ON p.id = (
       SELECT id FROM pengukuran_antropometri 
       WHERE anak_id = a.id 
       ORDER BY tanggal_ukur DESC, id DESC LIMIT 1
     )
     LEFT JOIN hasil_analisis_gizi h ON h.pengukuran_id = p.id
     LEFT JOIN peringatan_dini pd ON pd.anak_id = a.id
     ${wherePosyandu}
     ORDER BY (CASE WHEN h.status_stunting = 'Severely Stunted' THEN 1 WHEN h.status_stunting = 'Stunted' THEN 2 WHEN h.indikasi_faltering = 1 THEN 3 ELSE 4 END), p.tanggal_ukur DESC`,
    paramsPosyandu
  );

  let stuntingCount = 0;
  let falteringCount = 0;
  let severelyCount = 0;
  let stuntedCount = 0;
  let normalCount = 0;

  const now = new Date();
  const balitaWithAge = latestRows.map((b) => {
    const birth = new Date(b.tanggal_lahir);
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months--;
    const usiaBulan = Math.max(0, months);

    if (b.status_stunting === 'Severely Stunted') {
      severelyCount++;
      stuntingCount++;
    } else if (b.status_stunting === 'Stunted') {
      stuntedCount++;
      stuntingCount++;
    } else {
      normalCount++;
    }

    if (b.indikasi_faltering === 1) {
      falteringCount++;
    }

    return { ...b, usiaBulan };
  });

  const prevalensiStunting = totalBalita > 0
    ? ((stuntingCount / totalBalita) * 100).toFixed(2)
    : '0.00';
  let perangkatQuery = `
    SELECT COUNT(*) as count FROM perangkat_kader pk
    JOIN pengguna u ON pk.pengguna_id = u.id
    WHERE pk.waktu_sync_terakhir >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `;
  const perangkatParams = [];
  if (posyanduId) {
    perangkatQuery += ` AND u.posyandu_id = ?`;
    perangkatParams.push(posyanduId);
  }
  const [perangkatRes] = await pool.execute(perangkatQuery, perangkatParams);
  const totalPerangkat = perangkatRes[0]?.count || 0;
  const chartDistribusi = {
    labels: ['Normal', 'Stunted', 'Severely Stunted'],
    data: [normalCount, stuntedCount, severelyCount],
  };
  const periods = [
    { key: '2026-04', label: 'Apr 2026' },
    { key: '2026-05', label: 'Mei 2026' },
    { key: '2026-06', label: 'Jun 2026' },
    { key: '2026-07', label: 'Jul 2026' },
    { key: '2026-08', label: 'Agu 2026' },
    { key: '2026-09', label: 'Sep 2026' },
  ];

  const trendWhere = posyanduId ? 'AND a.posyandu_id = ?' : '';
  const trendParams = posyanduId ? [posyanduId] : [];

  const [trendRows] = await pool.execute(
    `SELECT 
       a.posyandu_id,
       pos.nama_posyandu,
       DATE_FORMAT(p.tanggal_ukur, '%Y-%m') as periode,
       COUNT(*) as total_measured,
       SUM(CASE WHEN h.status_stunting IN ('Stunted', 'Severely Stunted') THEN 1 ELSE 0 END) as stunting_count
     FROM pengukuran_antropometri p
     JOIN anak a ON p.anak_id = a.id
     JOIN posyandu pos ON a.posyandu_id = pos.id
     JOIN hasil_analisis_gizi h ON h.pengukuran_id = p.id
     WHERE p.tanggal_ukur BETWEEN '2026-04-01' AND '2026-09-30'
     ${trendWhere}
     GROUP BY a.posyandu_id, pos.nama_posyandu, DATE_FORMAT(p.tanggal_ukur, '%Y-%m')
     ORDER BY a.posyandu_id, periode ASC`,
    trendParams
  );

  const colors = ['#0C2E28', '#4E8752', '#C85A32', '#2563EB'];
  const posyanduGroup = {};

  trendRows.forEach((r) => {
    if (!posyanduGroup[r.posyandu_id]) {
      posyanduGroup[r.posyandu_id] = {
        nama: r.nama_posyandu,
        monthly: {},
      };
    }
    const prev = r.total_measured > 0 ? ((r.stunting_count / r.total_measured) * 100) : 0;
    posyanduGroup[r.posyandu_id].monthly[r.periode] = parseFloat(prev.toFixed(2));
  });

  const chartDatasets = Object.keys(posyanduGroup).map((pId, idx) => {
    const pData = posyanduGroup[pId];
    const dataPoints = periods.map((m) => pData.monthly[m.key] || 0.0);
    return {
      label: pData.nama,
      data: dataPoints,
      borderColor: colors[idx % colors.length],
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 3,
      fill: false,
    };
  });
  if (chartDatasets.length === 0) {
    chartDatasets.push({
      label: 'Prevalensi Stunting',
      data: [12.5, 12.0, 11.8, 11.2, 10.9, 10.5],
      borderColor: '#0C2E28',
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 3,
      fill: false,
    });
  }

  const chartTrend = {
    labels: periods.map((p) => p.label),
    datasets: chartDatasets,
  };

  return {
    totalBalita,
    totalStunting: stuntingCount,
    totalFaltering: falteringCount,
    prevalensiStunting,
    totalPerangkat,
    balitaBerisiko: balitaWithAge.slice(0, 15),
    chartDistribusi,
    chartTrend,
  };
}

async function showDashboard(req, res) {
  try {
    const isKader = req.webUser.peran === 'Kader';
    let effectivePosyanduId = null;

    if (isKader) {
      effectivePosyanduId = req.webUser.posyandu_id;
    } else if (req.query.posyandu_id && req.query.posyandu_id !== '') {
      effectivePosyanduId = parseInt(req.query.posyandu_id, 10);
    }
    const [posyanduList] = await pool.execute(
      `SELECT id, nama_posyandu FROM posyandu ORDER BY id ASC`
    );
    const data = await fetchSurveillanceStats(effectivePosyanduId);
    const namaPuskesmas = req.webUser.nama_puskesmas || 'Puskesmas Dringu';
    const namaKecamatan = req.webUser.nama_kecamatan || 'Kecamatan Dringu';
    let namaPosyanduAktif = 'Semua Posyandu';

    if (effectivePosyanduId) {
      const found = posyanduList.find((p) => p.id === effectivePosyanduId);
      if (found) namaPosyanduAktif = found.nama_posyandu;
    }
    const [antreanLogs] = await pool.execute(
      `SELECT id, nama_tabel, id_referensi, aksi, status_sync FROM antrean_sinkronisasi ORDER BY id DESC LIMIT 8`
    );

    const [perangkatList] = await pool.execute(
      `SELECT pk.kode_perangkat, 
              DATE_FORMAT(pk.waktu_sync_terakhir, '%d %b %Y, %H:%i') as waktu_sync,
              pos.nama_posyandu,
              CASE 
                WHEN pk.waktu_sync_terakhir >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 'Online'
                ELSE 'Offline'
              END as status_koneksi
       FROM perangkat_kader pk
       LEFT JOIN pengguna u ON pk.pengguna_id = u.id
       LEFT JOIN posyandu pos ON u.posyandu_id = pos.id
       ORDER BY pk.waktu_sync_terakhir DESC
       LIMIT 5`
    );
    const [panganList] = await pool.execute(
      `SELECT nama_bahan, kalori, protein, zat_besi, harga_estimasi FROM bahan_pangan_lokal ORDER BY id LIMIT 6`
    );

    res.render('dashboard', {
      title: 'TumbuhSehat - Dashboard Surveilans Wilayah',
      user: req.webUser,
      isKader,
      posyanduList,
      selectedPosyanduId: effectivePosyanduId,
      breadcrumb: {
        puskesmas: namaPuskesmas,
        kecamatan: namaKecamatan,
        posyandu: namaPosyanduAktif,
      },
      stats: {
        totalBalita: data.totalBalita,
        prevalensiStunting: data.prevalensiStunting,
        totalStunting: data.totalStunting,
        totalFaltering: data.totalFaltering,
        totalPosyandu: posyanduList.length,
        totalPerangkat: data.totalPerangkat,
      },
      balitaBerisiko: data.balitaBerisiko,
      antreanLogs,
      perangkatList,
      chartDistribusi: data.chartDistribusi,
      chartTrend: data.chartTrend,
      panganList,
    });
  } catch (error) {
    console.error('[Web Dashboard Error]:', error);
    res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
  }
}

async function getDashboardStatsApi(req, res) {
  try {
    const isKader = req.webUser?.peran === 'Kader';
    let effectivePosyanduId = null;

    if (isKader) {
      effectivePosyanduId = req.webUser.posyandu_id;
    } else if (req.query.posyandu_id && req.query.posyandu_id !== '') {
      effectivePosyanduId = parseInt(req.query.posyandu_id, 10);
    }

    const data = await fetchSurveillanceStats(effectivePosyanduId);

    let namaPosyandu = 'Semua Posyandu';
    if (effectivePosyanduId) {
      const [posRows] = await pool.execute(
        `SELECT nama_posyandu FROM posyandu WHERE id = ? LIMIT 1`,
        [effectivePosyanduId]
      );
      if (posRows.length > 0) namaPosyandu = posRows[0].nama_posyandu;
    }

    res.json({
      sukses: true,
      timestamp: new Date().toISOString(),
      posyandu_id: effectivePosyanduId,
      nama_posyandu: namaPosyandu,
      stats: {
        totalBalita: data.totalBalita,
        prevalensiStunting: data.prevalensiStunting,
        totalStunting: data.totalStunting,
        totalFaltering: data.totalFaltering,
        totalPerangkat: data.totalPerangkat,
      },
      distribusi: data.chartDistribusi,
      trend: data.chartTrend,
      balitaBerisiko: data.balitaBerisiko,
    });
  } catch (error) {
    console.error('[Dashboard Stats API Error]:', error);
    res.status(500).json({ sukses: false, pesan: error.message });
  }
}

async function showAnakWeb(req, res) {
  try {
    const isKader = req.webUser.peran === 'Kader';
    let whereClause = '';
    const params = [];

    if (isKader && req.webUser.posyandu_id) {
      whereClause = 'WHERE a.posyandu_id = ?';
      params.push(req.webUser.posyandu_id);
    }

    const q = `
      SELECT 
        a.id, a.nik, a.nama_lengkap, a.jenis_kelamin, 
        DATE_FORMAT(a.tanggal_lahir, '%Y-%m-%d') as tanggal_lahir,
        a.berat_lahir, a.panjang_lahir, a.posyandu_id,
        pos.nama_posyandu,
        k.no_kk, k.nama_ibu, k.nama_ayah, k.alamat_domisili, k.no_telepon,
        p.id as pengukuran_id, p.berat_badan, p.tinggi_badan, p.lingkar_kepala,
        DATE_FORMAT(p.tanggal_ukur, '%d %b %Y') as tanggal_ukur,
        h.zscore_bbu, h.zscore_tbu, h.zscore_bbtb, h.status_stunting, h.indikasi_faltering
      FROM anak a
      LEFT JOIN keluarga k ON a.keluarga_id = k.id
      LEFT JOIN posyandu pos ON a.posyandu_id = pos.id
      LEFT JOIN (
        SELECT p1.*
        FROM pengukuran_antropometri p1
        INNER JOIN (
          SELECT anak_id, MAX(tanggal_ukur) as max_tgl, MAX(id) as max_id
          FROM pengukuran_antropometri
          GROUP BY anak_id
        ) p2 ON p1.anak_id = p2.anak_id AND p1.id = p2.max_id
      ) p ON a.id = p.anak_id
      LEFT JOIN hasil_analisis_gizi h ON p.id = h.pengukuran_id
      ${whereClause}
      ORDER BY a.id ASC
    `;
    const [rows] = await pool.execute(q, params);

    const anakWithAge = rows.map((b) => {
      const birth = new Date(b.tanggal_lahir);
      const now = new Date();
      let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      if (now.getDate() < birth.getDate()) months--;
      return { ...b, usiaBulan: Math.max(0, months) };
    });

    res.render('anak', {
      title: 'Data Sasaran Balita - TumbuhSehat',
      user: req.webUser,
      anakList: anakWithAge,
      successMessage: req.query.success === '1' ? 'Data sasaran balita baru berhasil ditambahkan ke database.' : null,
    });
  } catch (error) {
    console.error('[Anak Web Error]:', error);
    res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
  }
}

async function processTambahAnak(req, res) {
  const {
    nama_lengkap, nik, jenis_kelamin, tanggal_lahir,
    berat_lahir, panjang_lahir, nama_ibu, nama_ayah,
    no_kk, alamat_domisili, no_telepon, posyandu_id,
  } = req.body;

  try {
    const isKader = req.webUser.peran === 'Kader';
    const effectivePosId = isKader
      ? req.webUser.posyandu_id
      : (posyandu_id ? parseInt(posyandu_id, 10) : 1);

    const [keluargaRes] = await pool.execute(
      `INSERT INTO keluarga (no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon) VALUES (?, ?, ?, ?, ?)`,
      [no_kk || '-', nama_ayah || null, nama_ibu || 'Ibu Balita', alamat_domisili || null, no_telepon || null]
    );
    const keluargaId = keluargaRes.insertId;

    await pool.execute(
      `INSERT INTO anak (keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir, posyandu_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        keluargaId,
        nik || null,
        nama_lengkap,
        jenis_kelamin,
        tanggal_lahir,
        berat_lahir ? parseFloat(berat_lahir) : null,
        panjang_lahir ? parseFloat(panjang_lahir) : null,
        effectivePosId,
      ]
    );

    res.redirect('/anak-web?success=1');
  } catch (error) {
    console.error('[Tambah Anak Error]:', error);
    res.redirect('/anak-web?error=Gagal+menambah+data');
  }
}

async function showMpasiWeb(req, res) {
  try {
    const q = `
      SELECT 
        r.id, r.nama_resep, r.kelompok_usia_bulan, r.cara_pembuatan, r.total_kalori,
        ROUND(COALESCE(SUM((kr.takaran_gram / 100.0) * b.protein), 0), 1) as total_protein,
        ROUND(COALESCE(SUM((kr.takaran_gram / 100.0) * b.zat_besi), 0), 1) as total_zat_besi,
        ROUND(COALESCE(SUM((kr.takaran_gram / 100.0) * b.harga_estimasi), 0), 0) as estimasi_biaya,
        GROUP_CONCAT(CONCAT(b.nama_bahan, ' (', kr.takaran_gram, 'g)') SEPARATOR ', ') as bahan_list
      FROM resep_mpasi r
      LEFT JOIN komposisi_resep kr ON r.id = kr.resep_id
      LEFT JOIN bahan_pangan_lokal b ON kr.bahan_id = b.id
      GROUP BY r.id, r.nama_resep, r.kelompok_usia_bulan, r.cara_pembuatan, r.total_kalori
      ORDER BY r.id ASC
    `;
    const [resepList] = await pool.execute(q);

    res.render('mpasi', {
      title: 'Rekomendasi Menu Lokal MPASI - TumbuhSehat',
      user: req.webUser,
      resepList,
    });
  } catch (error) {
    console.error('[MPASI Web Error]:', error);
    res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
  }
}

async function showSyncWeb(req, res) {
  try {
    const [syncLogs] = await pool.execute(
      `SELECT id, nama_tabel, id_referensi, aksi, data_json, status_sync FROM antrean_sinkronisasi ORDER BY id DESC`
    );

    const [perangkatList] = await pool.execute(
      `SELECT pk.kode_perangkat, 
              DATE_FORMAT(pk.waktu_sync_terakhir, '%d %b %Y, %H:%i') as waktu_sync,
              pos.nama_posyandu
       FROM perangkat_kader pk
       LEFT JOIN pengguna u ON pk.pengguna_id = u.id
       LEFT JOIN posyandu pos ON u.posyandu_id = pos.id
       ORDER BY pk.waktu_sync_terakhir DESC`
    );

    res.render('sync_log', {
      title: 'Validasi Sinkronisasi Offline-First - TumbuhSehat',
      user: req.webUser,
      syncLogs,
      perangkatList,
    });
  } catch (error) {
    console.error('[Sync Web Error]:', error);
    res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
  }
}

async function showLaporanWeb(req, res) {
  try {
    const isKader = req.webUser.peran === 'Kader';
    let selectedPosyanduId = null;

    if (isKader) {
      selectedPosyanduId = req.webUser.posyandu_id;
    } else if (req.query.posyandu_id && req.query.posyandu_id !== '') {
      selectedPosyanduId = parseInt(req.query.posyandu_id, 10);
    }

    const selectedPeriode = req.query.periode || '2026-09';
    const selectedKategori = req.query.kategori || 'semua';

    const [posyanduList] = await pool.execute(
      `SELECT id, nama_posyandu FROM posyandu ORDER BY id ASC`
    );
    let whereClause = `WHERE 1=1`;
    const params = [];

    if (selectedPosyanduId) {
      whereClause += ` AND a.posyandu_id = ?`;
      params.push(selectedPosyanduId);
    }

    if (selectedPeriode) {
      whereClause += ` AND DATE_FORMAT(p.tanggal_ukur, '%Y-%m') = ?`;
      params.push(selectedPeriode);
    }

    if (selectedKategori === 'stunting') {
      whereClause += ` AND h.status_stunting IN ('Stunted', 'Severely Stunted')`;
    } else if (selectedKategori === 'faltering') {
      whereClause += ` AND h.indikasi_faltering = 1`;
    }

    const q = `
      SELECT 
        a.id, a.nik, a.nama_lengkap, a.jenis_kelamin, 
        DATE_FORMAT(a.tanggal_lahir, '%Y-%m-%d') as tanggal_lahir,
        a.berat_lahir, a.panjang_lahir,
        k.nama_ibu, k.alamat_domisili,
        pos.nama_posyandu,
        p.berat_badan, p.tinggi_badan,
        DATE_FORMAT(p.tanggal_ukur, '%d-%m-%Y') as tanggal_ukur,
        h.zscore_bbu, h.zscore_tbu, h.zscore_bbtb, h.status_stunting, h.indikasi_faltering
      FROM anak a
      LEFT JOIN keluarga k ON a.keluarga_id = k.id
      LEFT JOIN posyandu pos ON a.posyandu_id = pos.id
      INNER JOIN pengukuran_antropometri p ON p.id = (
        SELECT id FROM pengukuran_antropometri 
        WHERE anak_id = a.id 
        ${selectedPeriode ? `AND DATE_FORMAT(tanggal_ukur, '%Y-%m') = '${selectedPeriode}'` : ''}
        ORDER BY tanggal_ukur DESC, id DESC LIMIT 1
      )
      LEFT JOIN hasil_analisis_gizi h ON h.pengukuran_id = p.id
      ${whereClause}
      ORDER BY a.id ASC
      LIMIT 10
    `;
    const [previewRows] = await pool.execute(q, params);

    const now = new Date();
    const previewWithMeta = previewRows.map((b) => {
      let usiaBulan = 0;
      if (b.tanggal_lahir) {
        const birth = new Date(b.tanggal_lahir);
        let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
        if (now.getDate() < birth.getDate()) months--;
        usiaBulan = Math.max(0, months);
      }

      let nikMasked = '-';
      if (b.nik) {
        const rawNik = String(b.nik).trim();
        if (rawNik.length >= 16) {
          nikMasked = `${rawNik.slice(0, 4)}********${rawNik.slice(-4)}`;
        } else if (rawNik.length >= 8) {
          nikMasked = `${rawNik.slice(0, 2)}****${rawNik.slice(-2)}`;
        } else {
          nikMasked = rawNik;
        }
      }

      let intervensiGizi = 'Pemantauan Rutin Posyandu';
      let intervensiBadge = 'badge-normal';
      if (b.status_stunting === 'Severely Stunted' || (b.zscore_bbtb !== null && b.zscore_bbtb < -3)) {
        intervensiGizi = 'Rujukan Spesialis Anak & PKMK';
        intervensiBadge = 'badge-severely';
      } else if (b.status_stunting === 'Stunted') {
        intervensiGizi = 'PMT Pemulihan Protein Tinggi';
        intervensiBadge = 'badge-stunted';
      } else if (b.indikasi_faltering) {
        intervensiGizi = 'Konseling Gizi Faltering (T/2T)';
        intervensiBadge = 'badge-faltering';
      } else if (b.zscore_bbtb !== null && b.zscore_bbtb < -2) {
        intervensiGizi = 'PMT Balita Kurang Gizi';
        intervensiBadge = 'badge-stunted';
      }

      return {
        ...b,
        usiaBulan,
        nikMasked,
        intervensiGizi,
        intervensiBadge,
      };
    });

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as c FROM anak a
       INNER JOIN pengukuran_antropometri p ON p.id = (
         SELECT id FROM pengukuran_antropometri 
         WHERE anak_id = a.id 
         ${selectedPeriode ? `AND DATE_FORMAT(tanggal_ukur, '%Y-%m') = '${selectedPeriode}'` : ''}
         ORDER BY tanggal_ukur DESC, id DESC LIMIT 1
       )
       LEFT JOIN hasil_analisis_gizi h ON h.pengukuran_id = p.id
       ${whereClause}`,
      params
    );
    const totalMatch = countRows[0]?.c || 0;

    res.render('laporan', {
      title: 'Ekspor Laporan e-PPGBM & Rekapitulasi Resmi - TumbuhSehat',
      user: req.webUser,
      isKader,
      posyanduList,
      selectedPosyanduId,
      selectedPeriode,
      selectedKategori,
      previewList: previewWithMeta,
      totalMatch,
    });
  } catch (error) {
    console.error('[Laporan Web Error]:', error);
    res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
  }
}

module.exports = {
  showLogin,
  processLogin,
  showRegister,
  processRegister,
  logout,
  webAuth,
  showDashboard,
  showAnakWeb,
  processTambahAnak,
  showMpasiWeb,
  showSyncWeb,
  showLaporanWeb,
  getDashboardStatsApi,
  authLimiter,
};
