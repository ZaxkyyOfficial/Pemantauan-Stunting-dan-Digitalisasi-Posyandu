const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_posyandu_stunting',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+07:00',
  dateStrings: true,
});

/**
 * Verifikasi koneksi database saat startup
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Koneksi database MySQL berhasil terhubung.');
    connection.release();
  } catch (error) {
    console.error('❌ Gagal terhubung ke database MySQL:', error.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
