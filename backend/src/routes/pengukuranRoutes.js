const express = require('express');
const router = express.Router();
const pengukuranController = require('../controllers/pengukuranController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimiter');
const { encryptResponse } = require('../middleware/crypto');

// Public encrypted endpoint with AES-128-CBC and rate limiting
router.get(
  '/pengukuran/publik/anak/:anakId',
  apiLimiter,
  encryptResponse,
  pengukuranController.getRiwayatPengukuran
);

router.use(authenticate);

router.post('/pengukuran', pengukuranController.createPengukuran);
router.get('/pengukuran', pengukuranController.getAllPengukuran);
router.get('/pengukuran/:id', pengukuranController.getPengukuranById);
router.get('/pengukuran/anak/:anakId', pengukuranController.getRiwayatPengukuran);

router.get('/peringatan', pengukuranController.getPeringatanDini);
router.patch(
  '/peringatan/:id/tindaklanjut',
  authorize('Admin Puskesmas', 'Kader'),
  pengukuranController.updateTindakLanjut
);

module.exports = router;
