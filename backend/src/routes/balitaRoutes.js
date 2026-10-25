const express = require('express');
const router = express.Router();
const balitaController = require('../controllers/balitaController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(['/keluarga', '/anak'], authenticate);

router.get('/keluarga', balitaController.getAllKeluarga);
router.get('/keluarga/:id', balitaController.getKeluargaById);
router.post('/keluarga', balitaController.createKeluarga);
router.put('/keluarga/:id', balitaController.updateKeluarga);
router.delete('/keluarga/:id', authorize('Admin Puskesmas'), balitaController.deleteKeluarga);

router.get('/anak', cacheMiddleware(300), balitaController.getAllAnak);
router.get('/anak/:id', balitaController.getAnakById);
router.post('/anak', balitaController.createAnak);
router.put('/anak/:id', balitaController.updateAnak);
router.delete('/anak/:id', authorize('Admin Puskesmas'), balitaController.deleteAnak);

module.exports = router;
