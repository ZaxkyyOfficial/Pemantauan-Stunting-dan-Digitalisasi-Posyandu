const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');

router.get('/export-excel', laporanController.exportExcel);
router.get('/export-pdf', laporanController.exportPdf);

module.exports = router;
