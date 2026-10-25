const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const jwt = require('jsonwebtoken');

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'tumbuhsehat_jwt_secret_2026');
    } catch (e) {
      // Ignore expired token on offline sync reconnect
    }
  }
  next();
}

router.post('/push', optionalAuth, syncController.pushSync);
router.get('/pull', optionalAuth, syncController.pullSync);

module.exports = router;
