const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
require('dotenv').config();

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Akses ditolak. Token autentikasi tidak ditemukan.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          sukses: false,
          pesan: 'Token telah kedaluwarsa. Silakan login kembali.',
        });
      }
      return res.status(401).json({
        sukses: false,
        pesan: 'Token tidak valid.',
      });
    }

    const [users] = await pool.execute(
      `SELECT p.id, p.email, p.status, p.posyandu_id,
              pr.id AS peran_id, pr.nama_peran,
              pos.nama_posyandu, pos.puskesmas_id
       FROM pengguna p
       JOIN peran pr ON p.peran_id = pr.id
       LEFT JOIN posyandu pos ON p.posyandu_id = pos.id
       WHERE p.id = ? AND p.status = 'Aktif'
       LIMIT 1`,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Pengguna tidak ditemukan atau akun telah dinonaktifkan.',
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      sukses: false,
      pesan: 'Terjadi kesalahan pada proses autentikasi.',
    });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Pengguna belum terautentikasi.',
      });
    }

    const userRole = req.user.nama_peran;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        sukses: false,
        pesan: `Akses ditolak. Peran '${userRole}' tidak memiliki izin untuk mengakses resource ini. Dibutuhkan: ${allowedRoles.join(' atau ')}.`,
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
