const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const router = express.Router();

const compressLevel1 = compression({ level: 1, threshold: 0 });
const compressLevel9 = compression({ level: 9, threshold: 0 });

function dynamicCompression(req, res, next) {
  if (req.query.compress === '0' || req.headers['x-no-compression']) {
    return next();
  }

  const level = parseInt(req.query.level, 10);
  if (level === 1) {
    return compressLevel1(req, res, next);
  }
  
  return compressLevel9(req, res, next);
}

function generateMockData(count = 10000) {
  const records = [];
  const posyanduList = ['Mawar I', 'Melati II', 'Kamboja III', 'Anggrek IV', 'Kenanga V'];
  const genders = ['L', 'P'];
  const stuntingLabels = ['Normal', 'Normal', 'Normal', 'Stunted', 'Severely Stunted'];
  const giziLabels = ['Gizi Baik', 'Gizi Baik', 'Gizi Kurang', 'Gizi Buruk'];

  for (let i = 1; i <= count; i++) {
    const ageMonths = (i % 60) + 1;
    const isMale = genders[i % 2] === 'L';
    const weight = isMale ? (3.3 + ageMonths * 0.41) : (3.2 + ageMonths * 0.39);
    const height = isMale ? (50.0 + ageMonths * 1.55) : (49.1 + ageMonths * 1.48);

    records.push({
      id: i,
      nik: `3509${String(100000000000 + i).slice(1)}`,
      nama_lengkap: `Anak Asuh Sejahtera #${i}`,
      jenis_kelamin: genders[i % 2],
      tanggal_lahir: new Date(Date.now() - ageMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      usia_bulan: ageMonths,
      berat_badan: parseFloat(weight.toFixed(2)),
      tinggi_badan: parseFloat(height.toFixed(1)),
      nama_ibu: `Ibu Rahayu ${((i - 1) % 400) + 1}`,
      nama_ayah: `Bapak Santoso ${((i - 1) % 400) + 1}`,
      posyandu: posyanduList[i % posyanduList.length],
      status_stunting: stuntingLabels[i % stuntingLabels.length],
      status_gizi: giziLabels[i % giziLabels.length],
      indikasi_faltering: (i % 6 === 0),
      terakhir_ditimbang: new Date().toISOString().split('T')[0],
      alamat: `Dusun Krajan RT ${String((i % 5) + 1).padStart(2, '0')} RW 02 Desa Sukamaju`,
      catatan_medis: 'Surveilans gizi e-PPGBM berkala Puskesmas terintegrasi sistem TumbuhSehat.'
    });
  }
  return records;
}

const cached10kRecords = generateMockData(10000);

router.get(
  '/large-data',
  morgan('combined'),
  dynamicCompression,
  (req, res) => {
    const level = req.query.compress === '0' ? 'None (Raw)' : (req.query.level || '9');
    res.setHeader('X-Benchmark-Dataset', '10000-records');
    res.setHeader('X-Compression-Level', level);

    res.json({
      sukses: true,
      pesan: `Benchmark 10.000 record data balita (Mode: ${level})`,
      total_records: cached10kRecords.length,
      mode_kompresi: level,
      timestamp: new Date().toISOString(),
      data: cached10kRecords,
    });
  }
);

module.exports = router;
