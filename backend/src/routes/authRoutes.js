const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, authController.login);
router.post(
  '/register',
  authenticate,
  authorize('Admin Puskesmas'),
  authController.register
);
router.get('/me', authenticate, authController.getProfile);

module.exports = router;
