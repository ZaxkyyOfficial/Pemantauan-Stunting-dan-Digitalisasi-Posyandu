const Joi = require('joi');
const { pool } = require('../config/database');
const {
  hitungUsiaBulan,
  prosesAnalisisGizi,
  klasifikasiStunting,
} = require('../services/whoEngine');

const pengukuranSchema = Joi.object({
  anak_id: Joi.number().integer().required().messages({
    'any.required': 'ID Anak wajib diisi.',
  }),
  kehadiran_id: Joi.number().integer().allow(null).optional(),
  tanggal_ukur: Joi.date().iso().required().messages({
    'date.format': 'Format tanggal ukur harus YYYY-MM-DD.',
    'any.required': 'Tanggal ukur wajib diisi.',
  }),
  berat_badan: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Berat badan harus bernilai positif.',
    'any.required': 'Berat badan wajib diisi.',
  }),
  tinggi_badan: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Tinggi badan harus bernilai positif.',
    'any.required': 'Tinggi badan wajib diisi.',
  }),
  lingkar_kepala: Joi.number().positive().precision(2).allow(null).optional(),
});

async function createPengukuran(req, res) {
  const { error, value } = pengukuranSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    errors: { wrap: { label: '' } },
  });
  if (error) {
    return res.status(422).json({
      sukses: false,
      pesan: 'Validasi gagal.',
      errors: error.details.map((d) => ({ field: d.path.join('.'), pesan: d.message })),
    });
  }

  const { anak_id, kehadiran_id, tanggal_ukur, berat_badan, tinggi_badan, lingkar_kepala } = value;
  const kader_id = req.user ? req.user.id : null;

  const [anakRows] = await pool.execute(
    'SELECT id, tanggal_lahir, jenis_kelamin, nama_lengkap FROM anak WHERE id = ? LIMIT 1',
    [anak_id]
  );

  if (anakRows.length === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data anak dengan ID tersebut tidak ditemukan.',
    });
  }

  const anak = anakRows[0];
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [pengukuranResult] = await connection.execute(
      `INSERT INTO pengukuran_antropometri 
       (kehadiran_id, anak_id, tanggal_ukur, berat_badan, tinggi_badan, lingkar_kepala, kader_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         kehadiran_id = VALUES(kehadiran_id),
         berat_badan = VALUES(berat_badan),
         tinggi_badan = VALUES(tinggi_badan),
         lingkar_kepala = VALUES(lingkar_kepala),
         kader_id = VALUES(kader_id)`,
      [kehadiran_id || null, anak_id, tanggal_ukur, berat_badan, tinggi_badan, lingkar_kepala || null, kader_id]
    );

    let pengukuranId = pengukuranResult.insertId;
    if (!pengukuranId) {
      const [existingRows] = await connection.execute(
        'SELECT id FROM pengukuran_antropometri WHERE anak_id = ? AND tanggal_ukur = ? LIMIT 1',
        [anak_id, tanggal_ukur]
      );
      if (existingRows.length > 0) {
        pengukuranId = existingRows[0].id;
      }
    }

    const analisis = await prosesAnalisisGizi({
      anakId: anak_id,
      tanggalLahir: anak.tanggal_lahir,
      jenisKelamin: anak.jenis_kelamin,
      tanggalUkur: tanggal_ukur,
      beratBadan: berat_badan,
      tinggiBadan: tinggi_badan,
    });

    await connection.execute(
      `INSERT INTO hasil_analisis_gizi 
       (pengukuran_id, zscore_bbu, zscore_tbu, zscore_bbtb, status_stunting, indikasi_faltering)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         zscore_bbu = VALUES(zscore_bbu),
         zscore_tbu = VALUES(zscore_tbu),
         zscore_bbtb = VALUES(zscore_bbtb),
         status_stunting = VALUES(status_stunting),
         indikasi_faltering = VALUES(indikasi_faltering)`,
      [
        pengukuranId,
        analisis.zscoreBBU,
        analisis.zscoreTBU,
        analisis.zscoreBBTB,
        analisis.statusStunting,
        analisis.indikasiFaltering ? 1 : 0,
      ]
    );

    const peringatanList = [];

    if (analisis.zscoreTBU !== null && analisis.zscoreTBU < -2) {
      const tingkatBahaya = analisis.zscoreTBU < -3 ? 'Merah' : 'Kuning';
      const pesanPeringatan = `${anak.nama_lengkap}: Status ${analisis.statusStunting} terdeteksi. ` +
        `Z-score TB/U = ${analisis.zscoreTBU}. Usia ${analisis.usiaBulan} bulan. ` +
        `Perlu tindak lanjut segera.`;

      await connection.execute(
        `INSERT INTO peringatan_dini (anak_id, tingkat_bahaya, pesan_peringatan, status_tindak_lanjut)
         VALUES (?, ?, ?, 'Belum')`,
        [anak_id, tingkatBahaya, pesanPeringatan]
      );

      peringatanList.push({
        tingkat_bahaya: tingkatBahaya,
        pesan: pesanPeringatan,
      });
    }

    if (analisis.zscoreBBU !== null && analisis.zscoreBBU < -2) {
      const tingkatBahaya = analisis.zscoreBBU < -3 ? 'Merah' : 'Kuning';
      const pesanPeringatan = `${anak.nama_lengkap}: ${analisis.zscoreBBU < -3 ? 'Gizi Buruk' : 'Gizi Kurang'} terdeteksi. ` +
        `Z-score BB/U = ${analisis.zscoreBBU}. Berat: ${berat_badan} kg pada usia ${analisis.usiaBulan} bulan.`;

      await connection.execute(
        `INSERT INTO peringatan_dini (anak_id, tingkat_bahaya, pesan_peringatan, status_tindak_lanjut)
         VALUES (?, ?, ?, 'Belum')`,
        [anak_id, tingkatBahaya, pesanPeringatan]
      );

      peringatanList.push({
        tingkat_bahaya: tingkatBahaya,
        pesan: pesanPeringatan,
      });
    }

    if (analisis.indikasiFaltering) {
      const pesanFaltering = `${anak.nama_lengkap}: ${analisis.detailFaltering}`;

      await connection.execute(
        `INSERT INTO peringatan_dini (anak_id, tingkat_bahaya, pesan_peringatan, status_tindak_lanjut)
         VALUES (?, 'Kuning', ?, 'Belum')`,
        [anak_id, pesanFaltering]
      );

      peringatanList.push({
        tingkat_bahaya: 'Kuning',
        pesan: pesanFaltering,
      });
    }

    await connection.commit();

    return res.status(201).json({
      sukses: true,
      pesan: 'Pengukuran berhasil disimpan dan dianalisis.',
      data: {
        pengukuran: {
          id: pengukuranId,
          anak_id,
          tanggal_ukur,
          berat_badan,
          tinggi_badan,
          lingkar_kepala: lingkar_kepala || null,
        },
        analisis: {
          id: analisisResult.insertId,
          usia_bulan: analisis.usiaBulan,
          zscore_bbu: analisis.zscoreBBU,
          zscore_tbu: analisis.zscoreTBU,
          zscore_bbtb: analisis.zscoreBBTB,
          status_stunting: analisis.statusStunting,
          status_gizi: analisis.statusGizi,
          indikasi_faltering: analisis.indikasiFaltering,
          detail_faltering: analisis.detailFaltering,
          delta_berat_badan: analisis.deltaBeratBadan,
        },
        peringatan: peringatanList,
      },
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getRiwayatPengukuran(req, res) {
  const { anakId } = req.params;

  const [anakCheck] = await pool.execute(
    'SELECT id, nama_lengkap, tanggal_lahir, jenis_kelamin FROM anak WHERE id = ? LIMIT 1',
    [anakId]
  );

  if (anakCheck.length === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data anak tidak ditemukan.',
    });
  }

  const anak = anakCheck[0];
  const today = new Date().toISOString().split('T')[0];

  const [rows] = await pool.execute(
    `SELECT pa.id, pa.tanggal_ukur, pa.berat_badan, pa.tinggi_badan, pa.lingkar_kepala,
            hag.zscore_bbu, hag.zscore_tbu, hag.zscore_bbtb,
            hag.status_stunting, hag.indikasi_faltering
     FROM pengukuran_antropometri pa
     LEFT JOIN hasil_analisis_gizi hag ON pa.id = hag.pengukuran_id
     WHERE pa.anak_id = ?
     ORDER BY pa.tanggal_ukur ASC`,
    [anakId]
  );

  return res.status(200).json({
    sukses: true,
    data: {
      anak: {
        ...anak,
        usia_bulan: hitungUsiaBulan(anak.tanggal_lahir, today),
      },
      jumlah_pengukuran: rows.length,
      riwayat: rows,
    },
  });
}

async function getPengukuranById(req, res) {
  const { id } = req.params;

  const [rows] = await pool.execute(
    `SELECT pa.*, a.nama_lengkap, a.tanggal_lahir, a.jenis_kelamin,
            hag.zscore_bbu, hag.zscore_tbu, hag.zscore_bbtb,
            hag.status_stunting, hag.indikasi_faltering
     FROM pengukuran_antropometri pa
     JOIN anak a ON pa.anak_id = a.id
     LEFT JOIN hasil_analisis_gizi hag ON pa.id = hag.pengukuran_id
     WHERE pa.id = ?
     LIMIT 1`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data pengukuran tidak ditemukan.',
    });
  }

  const pengukuran = rows[0];
  pengukuran.usia_bulan = hitungUsiaBulan(pengukuran.tanggal_lahir, pengukuran.tanggal_ukur);

  const [peringatanRows] = await pool.execute(
    `SELECT * FROM peringatan_dini WHERE anak_id = ? ORDER BY id DESC LIMIT 5`,
    [pengukuran.anak_id]
  );

  return res.status(200).json({
    sukses: true,
    data: {
      pengukuran,
      peringatan: peringatanRows,
    },
  });
}

async function getAllPengukuran(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const [countResult] = await pool.execute(
    'SELECT COUNT(*) AS total FROM pengukuran_antropometri'
  );
  const total = countResult[0].total;

  const [rows] = await pool.execute(
    `SELECT pa.id, pa.anak_id, pa.tanggal_ukur, pa.berat_badan, pa.tinggi_badan, pa.lingkar_kepala,
            a.nama_lengkap, a.jenis_kelamin, a.tanggal_lahir,
            hag.zscore_bbu, hag.zscore_tbu, hag.zscore_bbtb,
            hag.status_stunting, hag.indikasi_faltering
     FROM pengukuran_antropometri pa
     JOIN anak a ON pa.anak_id = a.id
     LEFT JOIN hasil_analisis_gizi hag ON pa.id = hag.pengukuran_id
     ORDER BY pa.tanggal_ukur DESC, pa.id DESC
     LIMIT ${limit} OFFSET ${offset}`
  );

  const rowsWithAge = rows.map((row) => ({
    ...row,
    usia_saat_ukur: hitungUsiaBulan(row.tanggal_lahir, row.tanggal_ukur),
  }));

  return res.status(200).json({
    sukses: true,
    data: rowsWithAge,
    pagination: {
      halaman: page,
      per_halaman: limit,
      total_data: total,
      total_halaman: Math.ceil(total / limit),
    },
  });
}

async function getPeringatanDini(req, res) {
  const status = req.query.status || 'Belum';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const [countResult] = await pool.execute(
    'SELECT COUNT(*) AS total FROM peringatan_dini WHERE status_tindak_lanjut = ?',
    [status]
  );
  const total = countResult[0].total;

  const [rows] = await pool.execute(
    `SELECT pd.*, a.nama_lengkap, a.tanggal_lahir, a.jenis_kelamin,
            k.nama_ibu, k.no_telepon
     FROM peringatan_dini pd
     JOIN anak a ON pd.anak_id = a.id
     LEFT JOIN keluarga k ON a.keluarga_id = k.id
     WHERE pd.status_tindak_lanjut = ?
     ORDER BY FIELD(pd.tingkat_bahaya, 'Merah', 'Kuning'), pd.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [status]
  );

  return res.status(200).json({
    sukses: true,
    data: rows,
    pagination: {
      halaman: page,
      per_halaman: limit,
      total_data: total,
      total_halaman: Math.ceil(total / limit),
    },
  });
}

async function updateTindakLanjut(req, res) {
  const { id } = req.params;

  const [result] = await pool.execute(
    `UPDATE peringatan_dini SET status_tindak_lanjut = 'Selesai' WHERE id = ?`,
    [id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Peringatan tidak ditemukan.',
    });
  }

  return res.status(200).json({
    sukses: true,
    pesan: 'Peringatan berhasil ditandai sebagai sudah ditindaklanjuti.',
  });
}

module.exports = {
  createPengukuran,
  getRiwayatPengukuran,
  getPengukuranById,
  getAllPengukuran,
  getPeringatanDini,
  updateTindakLanjut,
};
