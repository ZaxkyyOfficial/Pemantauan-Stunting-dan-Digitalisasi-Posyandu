const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { apiLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/authMiddleware');

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
}

router.post('/konsultasi-stunting', apiLimiter, optionalAuth, aiController.konsultasiStunting);

module.exports = router;

