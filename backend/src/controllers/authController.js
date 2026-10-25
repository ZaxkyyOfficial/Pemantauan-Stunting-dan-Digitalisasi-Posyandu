const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { pool } = require('../config/database');
require('dotenv').config();

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Format email tidak valid.',
    'any.required': 'Email wajib diisi.',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password minimal 6 karakter.',
    'any.required': 'Password wajib diisi.',
  }),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Format email tidak valid.',
    'any.required': 'Email wajib diisi.',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password minimal 6 karakter.',
    'any.required': 'Password wajib diisi.',
  }),
  peran_id: Joi.number().integer().required().messages({
    'any.required': 'Peran wajib dipilih.',
  }),
  posyandu_id: Joi.number().integer().allow(null).optional(),
});

async function login(req, res) {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
    errors: { wrap: { label: '' } },
  });
  if (error) {
    return res.status(422).json({
      sukses: false,
      pesan: 'Validasi gagal.',
      errors: error.details.map((d) => ({ field: d.path.join('.'), pesan: d.message })),
    });
  }

  const { email, password } = value;

  const [users] = await pool.execute(
    `SELECT p.id, p.email, p.password, p.status, p.posyandu_id,
            pr.id AS peran_id, pr.nama_peran,
            pos.nama_posyandu, w.nama_wilayah AS nama_desa
     FROM pengguna p
     JOIN peran pr ON p.peran_id = pr.id
     LEFT JOIN posyandu pos ON p.posyandu_id = pos.id
     LEFT JOIN wilayah w ON pos.wilayah_id = w.id
     WHERE p.email = ?
     LIMIT 1`,
    [email]
  );

  if (users.length === 0) {
    return res.status(401).json({
      sukses: false,
      pesan: 'Email atau password salah.',
    });
  }

  const user = users[0];

  if (user.status !== 'Aktif') {
    return res.status(403).json({
      sukses: false,
      pesan: 'Akun Anda telah dinonaktifkan. Hubungi administrator.',
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      sukses: false,
      pesan: 'Email atau password salah.',
    });
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    peran_id: user.peran_id,
    nama_peran: user.nama_peran,
    posyandu_id: user.posyandu_id,
    nama_posyandu: user.nama_posyandu,
    nama_desa: user.nama_desa,
  };

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

  return res.status(200).json({
    sukses: true,
    pesan: 'Login berhasil.',
    data: {
      token,
      pengguna: {
        id: user.id,
        email: user.email,
        nama_peran: user.nama_peran,
        posyandu_id: user.posyandu_id,
        nama_posyandu: user.nama_posyandu,
        nama_desa: user.nama_desa,
      },
    },
  });
}

async function register(req, res) {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
    errors: { wrap: { label: '' } },
  });
  if (error) {
    return res.status(422).json({
      sukses: false,
      pesan: 'Validasi gagal.',
      errors: error.details.map((d) => ({ field: d.path.join('.'), pesan: d.message })),
    });
  }

  const { email, password, peran_id, posyandu_id } = value;

  const [existing] = await pool.execute(
    'SELECT id FROM pengguna WHERE email = ? LIMIT 1',
    [email]
  );
  if (existing.length > 0) {
    return res.status(409).json({
      sukses: false,
      pesan: 'Email sudah terdaftar.',
    });
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const [result] = await pool.execute(
    `INSERT INTO pengguna (email, password, peran_id, posyandu_id, status) 
     VALUES (?, ?, ?, ?, 'Aktif')`,
    [email, hashedPassword, peran_id, posyandu_id || null]
  );

  return res.status(201).json({
    sukses: true,
    pesan: 'Pengguna berhasil didaftarkan.',
    data: {
      id: result.insertId,
      email,
      peran_id,
      posyandu_id: posyandu_id || null,
    },
  });
}

async function getProfile(req, res) {
  return res.status(200).json({
    sukses: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      nama_peran: req.user.nama_peran,
      posyandu_id: req.user.posyandu_id,
      nama_posyandu: req.user.nama_posyandu,
    },
  });
}

module.exports = { login, register, getProfile };
