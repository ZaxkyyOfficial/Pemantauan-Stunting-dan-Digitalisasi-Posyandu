const Joi = require('joi');
const { pool } = require('../config/database');
const { hitungUsiaBulan } = require('../services/whoEngine');
const { decryptData } = require('../middleware/crypto');

const keluargaSchema = Joi.object({
  no_kk: Joi.string().length(16).pattern(/^\d+$/).required().messages({
    'string.length': 'Nomor KK harus 16 digit.',
    'string.pattern.base': 'Nomor KK hanya boleh berisi angka.',
    'any.required': 'Nomor KK wajib diisi.',
  }),
  nama_ayah: Joi.string().max(100).allow('', null).optional(),
  nama_ibu: Joi.string().max(100).required().messages({
    'any.required': 'Nama ibu wajib diisi.',
  }),
  alamat_domisili: Joi.string().allow('', null).optional(),
  no_telepon: Joi.string().max(20).allow('', null).optional(),
});

const anakSchema = Joi.object({
  keluarga_id: Joi.number().integer().required().messages({
    'any.required': 'ID Keluarga wajib diisi.',
  }),
  nik: Joi.string().length(16).pattern(/^\d+$/).allow('', null).optional().messages({
    'string.length': 'NIK harus 16 digit.',
    'string.pattern.base': 'NIK hanya boleh berisi angka.',
  }),
  nama_lengkap: Joi.string().max(150).required().messages({
    'any.required': 'Nama lengkap anak wajib diisi.',
  }),
  jenis_kelamin: Joi.string().valid('L', 'P').required().messages({
    'any.only': 'Jenis kelamin harus L (Laki-laki) atau P (Perempuan).',
    'any.required': 'Jenis kelamin wajib diisi.',
  }),
  tanggal_lahir: Joi.date().iso().required().messages({
    'date.format': 'Format tanggal lahir harus YYYY-MM-DD.',
    'any.required': 'Tanggal lahir wajib diisi.',
  }),
  berat_lahir: Joi.number().positive().allow(null).optional(),
  panjang_lahir: Joi.number().positive().allow(null).optional(),
  posyandu_id: Joi.number().integer().allow(null).optional(),
});

async function getAllKeluarga(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = 'WHERE k.nama_ibu LIKE ? OR k.no_kk LIKE ? OR k.nama_ayah LIKE ?';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) AS total FROM keluarga k ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  const [rows] = await pool.execute(
    `SELECT k.*, COUNT(a.id) AS jumlah_anak
     FROM keluarga k
     LEFT JOIN anak a ON k.id = a.keluarga_id
     ${whereClause}
     GROUP BY k.id
     ORDER BY k.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
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

async function getKeluargaById(req, res) {
  const { id } = req.params;

  const [keluarga] = await pool.execute(
    'SELECT * FROM keluarga WHERE id = ? LIMIT 1',
    [id]
  );

  if (keluarga.length === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data keluarga tidak ditemukan.',
    });
  }

  const [anakList] = await pool.execute(
    'SELECT * FROM anak WHERE keluarga_id = ? ORDER BY tanggal_lahir DESC',
    [id]
  );

  const today = new Date().toISOString().split('T')[0];
  const anakWithAge = anakList.map((anak) => ({
    ...anak,
    usia_bulan: hitungUsiaBulan(anak.tanggal_lahir, today),
  }));

  return res.status(200).json({
    sukses: true,
    data: {
      ...keluarga[0],
      anak: anakWithAge,
    },
  });
}

async function createKeluarga(req, res) {
  if (req.body && req.body.no_kk) {
    req.body.no_kk = decryptData(req.body.no_kk);
  }

  const { error, value } = keluargaSchema.validate(req.body, {
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

  const { no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon } = value;

  const [existing] = await pool.execute(
    'SELECT id FROM keluarga WHERE no_kk = ? LIMIT 1',
    [no_kk]
  );

  if (existing.length > 0) {
    const existingId = existing[0].id;
    await pool.execute(
      `UPDATE keluarga
       SET nama_ayah = COALESCE(?, nama_ayah),
           nama_ibu = ?,
           alamat_domisili = COALESCE(?, alamat_domisili),
           no_telepon = COALESCE(?, no_telepon)
       WHERE id = ?`,
      [nama_ayah || null, nama_ibu, alamat_domisili || null, no_telepon || null, existingId]
    );
    return res.status(200).json({
      sukses: true,
      pesan: 'Data keluarga sudah terdaftar (diperbarui).',
      data: { id: existingId, ...value },
    });
  }

  const [result] = await pool.execute(
    `INSERT INTO keluarga (no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon)
     VALUES (?, ?, ?, ?, ?)`,
    [no_kk, nama_ayah || null, nama_ibu, alamat_domisili || null, no_telepon || null]
  );

  return res.status(201).json({
    sukses: true,
    pesan: 'Data keluarga berhasil ditambahkan.',
    data: { id: result.insertId, ...value },
  });
}

async function updateKeluarga(req, res) {
  const { id } = req.params;

  const { error, value } = keluargaSchema.validate(req.body, {
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

  const { no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon } = value;

  const [result] = await pool.execute(
    `UPDATE keluarga SET no_kk = ?, nama_ayah = ?, nama_ibu = ?, alamat_domisili = ?, no_telepon = ?
     WHERE id = ?`,
    [no_kk, nama_ayah || null, nama_ibu, alamat_domisili || null, no_telepon || null, id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data keluarga tidak ditemukan.',
    });
  }

  return res.status(200).json({
    sukses: true,
    pesan: 'Data keluarga berhasil diperbarui.',
    data: { id: parseInt(id), ...value },
  });
}

async function deleteKeluarga(req, res) {
  const { id } = req.params;

  const [result] = await pool.execute(
    'DELETE FROM keluarga WHERE id = ?',
    [id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data keluarga tidak ditemukan.',
    });
  }

  return res.status(200).json({
    sukses: true,
    pesan: 'Data keluarga berhasil dihapus.',
  });
}

async function getAllAnak(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const posyanduId = req.query.posyandu_id || null;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (search) {
    whereClause += ' AND (a.nama_lengkap LIKE ? OR a.nik LIKE ? OR k.nama_ibu LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (posyanduId) {
    whereClause += ' AND a.keluarga_id IN (SELECT keluarga_id FROM anak WHERE keluarga_id IS NOT NULL)';
  }

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) AS total FROM anak a LEFT JOIN keluarga k ON a.keluarga_id = k.id ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  const [rows] = await pool.execute(
    `SELECT a.*, k.no_kk, k.nama_ibu, k.nama_ayah, k.alamat_domisili, k.no_telepon
     FROM anak a
     LEFT JOIN keluarga k ON a.keluarga_id = k.id
     ${whereClause}
     ORDER BY a.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const today = new Date().toISOString().split('T')[0];
  const rowsWithAge = rows.map((row) => ({
    ...row,
    usia_bulan: hitungUsiaBulan(row.tanggal_lahir, today),
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

async function getAnakById(req, res) {
  const { id } = req.params;

  const [anakRows] = await pool.execute(
    `SELECT a.*, k.no_kk, k.nama_ibu, k.nama_ayah, k.alamat_domisili, k.no_telepon
     FROM anak a
     LEFT JOIN keluarga k ON a.keluarga_id = k.id
     WHERE a.id = ?
     LIMIT 1`,
    [id]
  );

  if (anakRows.length === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data anak tidak ditemukan.',
    });
  }

  const anak = anakRows[0];
  const today = new Date().toISOString().split('T')[0];
  anak.usia_bulan = hitungUsiaBulan(anak.tanggal_lahir, today);

  const [pengukuranRows] = await pool.execute(
    `SELECT pa.*, hag.zscore_bbu, hag.zscore_tbu, hag.zscore_bbtb,
            hag.status_stunting, hag.indikasi_faltering
     FROM pengukuran_antropometri pa
     LEFT JOIN hasil_analisis_gizi hag ON pa.id = hag.pengukuran_id
     WHERE pa.anak_id = ?
     ORDER BY pa.tanggal_ukur DESC
     LIMIT 12`,
    [id]
  );

  const [imunisasiRows] = await pool.execute(
    `SELECT ci.tanggal_suntik, im.nama_vaksin, im.usia_wajib_bulan
     FROM catatan_imunisasi ci
     JOIN imunisasi_master im ON ci.imunisasi_id = im.id
     WHERE ci.anak_id = ?
     ORDER BY ci.tanggal_suntik DESC`,
    [id]
  );

  const [vitaminRows] = await pool.execute(
    `SELECT * FROM catatan_vitamin WHERE anak_id = ? ORDER BY tanggal_diberikan DESC`,
    [id]
  );

  return res.status(200).json({
    sukses: true,
    data: {
      ...anak,
      riwayat_pengukuran: pengukuranRows,
      catatan_imunisasi: imunisasiRows,
      catatan_vitamin: vitaminRows,
    },
  });
}

async function createAnak(req, res) {
  if (req.body && req.body.nik) {
    req.body.nik = decryptData(req.body.nik);
  }

  const { error, value } = anakSchema.validate(req.body, {
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

  const { keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir, posyandu_id } = value;

  const [keluargaCheck] = await pool.execute(
    'SELECT id FROM keluarga WHERE id = ? LIMIT 1',
    [keluarga_id]
  );
  if (keluargaCheck.length === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data keluarga dengan ID tersebut tidak ditemukan.',
    });
  }

  const today = new Date().toISOString().split('T')[0];

  if (nik) {
    const [existing] = await pool.execute(
      'SELECT id FROM anak WHERE nik = ? LIMIT 1',
      [nik]
    );

    if (existing.length > 0) {
      const existingId = existing[0].id;
      await pool.execute(
        `UPDATE anak
         SET keluarga_id = ?,
             nama_lengkap = ?,
             jenis_kelamin = ?,
             tanggal_lahir = ?,
             berat_lahir = COALESCE(?, berat_lahir),
             panjang_lahir = COALESCE(?, panjang_lahir),
             posyandu_id = COALESCE(?, posyandu_id),
             synced_to_supabase = 0
         WHERE id = ?`,
        [keluarga_id, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir || null, panjang_lahir || null, posyandu_id || null, existingId]
      );

      return res.status(200).json({
        sukses: true,
        pesan: 'Data anak dengan NIK tersebut sudah terdaftar (diperbarui).',
        data: {
          id: existingId,
          ...value,
          usia_bulan: hitungUsiaBulan(tanggal_lahir, today),
        },
      });
    }
  }

  const [result] = await pool.execute(
    `INSERT INTO anak (keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir, posyandu_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [keluarga_id, nik || null, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir || null, panjang_lahir || null, posyandu_id || null]
  );

  return res.status(201).json({
    sukses: true,
    pesan: 'Data anak berhasil ditambahkan.',
    data: {
      id: result.insertId,
      ...value,
      usia_bulan: hitungUsiaBulan(tanggal_lahir, today),
    },
  });
}

async function updateAnak(req, res) {
  const { id } = req.params;

  const { error, value } = anakSchema.validate(req.body, {
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

  const { keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir } = value;

  const [result] = await pool.execute(
    `UPDATE anak SET keluarga_id = ?, nik = ?, nama_lengkap = ?, jenis_kelamin = ?,
     tanggal_lahir = ?, berat_lahir = ?, panjang_lahir = ?
     WHERE id = ?`,
    [keluarga_id, nik || null, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir || null, panjang_lahir || null, id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data anak tidak ditemukan.',
    });
  }

  return res.status(200).json({
    sukses: true,
    pesan: 'Data anak berhasil diperbarui.',
    data: { id: parseInt(id), ...value },
  });
}

async function deleteAnak(req, res) {
  const { id } = req.params;

  const [result] = await pool.execute(
    'DELETE FROM anak WHERE id = ?',
    [id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      sukses: false,
      pesan: 'Data anak tidak ditemukan.',
    });
  }

  return res.status(200).json({
    sukses: true,
    pesan: 'Data anak berhasil dihapus.',
  });
}

module.exports = {
  getAllKeluarga,
  getKeluargaById,
  createKeluarga,
  updateKeluarga,
  deleteKeluarga,
  getAllAnak,
  getAnakById,
  createAnak,
  updateAnak,
  deleteAnak,
};
