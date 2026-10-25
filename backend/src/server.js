require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');

const { testConnection, pool } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const compressionMiddleware = require('./middleware/compressionMiddleware');
const { cacheMiddleware } = require('./middleware/cacheMiddleware');

const authRoutes = require('./routes/authRoutes');
const balitaRoutes = require('./routes/balitaRoutes');
const pengukuranRoutes = require('./routes/pengukuranRoutes');
const syncRoutes = require('./routes/syncRoutes');
const laporanRoutes = require('./routes/laporanRoutes');
const benchmarkRoutes = require('./routes/benchmarkRoutes');
const aiRoutes = require('./routes/aiRoutes');
const webController = require('./controllers/webController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compressionMiddleware);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Encoding'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/api/v1/health', apiLimiter, (req, res) => {
  res.status(200).json({
    sukses: true,
    pesan: 'TumbuhSehat API berjalan normal.',
    versi: '1.0.0',
    waktu: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/laporan', laporanRoutes);
app.use('/api/v1/benchmark', benchmarkRoutes);
app.use('/api/v1/ai', aiRoutes);

app.get('/api/v1/dashboard/stats', apiLimiter, cacheMiddleware(60), webController.getDashboardStatsApi);

app.get('/api/v1/mpasi', apiLimiter, cacheMiddleware(300), async (req, res) => {
  const [resepList] = await pool.execute(`
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
  `);
  res.json({ sukses: true, total: resepList.length, data: resepList });
});

app.use('/api/v1', balitaRoutes);
app.use('/api/v1', pengukuranRoutes);

app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/login', webController.showLogin);
app.post('/login', authLimiter, webController.processLogin);
app.get('/register', webController.showRegister);
app.post('/register', webController.processRegister);
app.get('/logout', webController.logout);
app.get('/dashboard', webController.webAuth, webController.showDashboard);
app.get('/anak-web', webController.webAuth, webController.showAnakWeb);
app.post('/anak-web/tambah', webController.webAuth, webController.processTambahAnak);
app.get('/mpasi-web', webController.webAuth, cacheMiddleware(300), webController.showMpasiWeb);
app.get('/sync-web', webController.webAuth, webController.showSyncWeb);
app.get('/laporan-web', webController.webAuth, webController.showLaporanWeb);

app.use((req, res) => {
  res.status(404).json({
    sukses: false,
    pesan: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

app.use(errorHandler);

const { startPeriodicSync } = require('./services/supabaseSyncService');

async function startServer() {
  await testConnection();
  startPeriodicSync();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server TumbuhSehat aktif pada port ${PORT} (0.0.0.0)`);
  });
}

startServer();

module.exports = app;
