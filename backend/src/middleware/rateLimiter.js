const { rateLimit } = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 7 * 60 * 1000, 
  max: 3, 
  standardHeaders: true, 
  legacyHeaders: false, 
  statusCode: 429,
  handler: (req, res) => {
    res.status(429).json({
      sukses: false,
      pesan: 'Terlalu banyak percobaan login. Akses dibatasi maksimal 3 kali dalam 7 menit demi keamanan.',
      statusCode: 429,
      retryAfterMinutes: 7,
      waktu: new Date().toISOString(),
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (req, res) => {
    res.status(429).json({
      sukses: false,
      pesan: 'Batas laju permintaan API publik terlampaui. Maksimal 100 permintaan per 15 menit.',
      statusCode: 429,
      retryAfterMinutes: 15,
      waktu: new Date().toISOString(),
    });
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
};
