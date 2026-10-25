/**
 * whoEngine.js - Engine Kalkulasi Z-Score WHO & Deteksi Status Gizi
 *
 * Implementasi formula Box-Cox LMS (Lambda-Mu-Sigma) sesuai standar WHO
 * untuk menghitung Z-score indikator pertumbuhan anak: BB/U, TB/U, BB/TB.
 *
 * Referensi: WHO Child Growth Standards (2006)
 * Formula:
 *   Jika L ≠ 0: Z = [ (y / M)^L  -  1 ] / (L × S)
 *   Jika L = 0: Z = ln(y / M) / S
 */
const { pool } = require('../config/database');

/**
 * Hitung usia anak dalam bulan penuh dari tanggal lahir ke tanggal ukur.
 * @param {string|Date} tanggalLahir - Tanggal lahir anak
 * @param {string|Date} tanggalUkur  - Tanggal pengukuran
 * @returns {number} Usia dalam bulan (bilangan bulat, floor)
 */
function hitungUsiaBulan(tanggalLahir, tanggalUkur) {
  const lahir = new Date(tanggalLahir);
  const ukur = new Date(tanggalUkur);
  let bulan = (ukur.getFullYear() - lahir.getFullYear()) * 12;
  bulan += ukur.getMonth() - lahir.getMonth();
  if (ukur.getDate() < lahir.getDate()) {
    bulan -= 1;
  }
  return Math.max(0, bulan);
}

/**
 * Ambil parameter LMS dari tabel standar_who_zscore.
 * @param {string} indikator    - 'BBU' | 'TBU' | 'BBTB'
 * @param {string} jenisKelamin - 'L' | 'P'
 * @param {number} usiaBulan    - Usia dalam bulan
 * @returns {Promise<{l_value: number, m_value: number, s_value: number}|null>}
 */
async function ambilParameterLMS(indikator, jenisKelamin, usiaBulan) {
  const [rows] = await pool.execute(
    `SELECT l_value, m_value, s_value 
     FROM standar_who_zscore 
     WHERE indikator = ? AND jenis_kelamin = ? AND bulan_usia = ?
     LIMIT 1`,
    [indikator, jenisKelamin, usiaBulan]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Hitung Z-score menggunakan formula Box-Cox LMS.
 * @param {number} y - Nilai pengukuran (berat dalam kg atau tinggi dalam cm)
 * @param {number} L - Parameter Lambda (Box-Cox power)
 * @param {number} M - Parameter Mu (median)
 * @param {number} S - Parameter Sigma (coefficient of variation)
 * @returns {number} Z-score (dibulatkan 2 desimal)
 */
function hitungZScore(y, L, M, S) {
  if (y <= 0 || M <= 0 || S <= 0) {
    return null;
  }

  let z;
  if (Math.abs(L) < 1e-10) {
    // L mendekati 0: gunakan formula logaritmik
    z = Math.log(y / M) / S;
  } else {
    // Formula standar Box-Cox LMS
    z = (Math.pow(y / M, L) - 1) / (L * S);
  }

  return Math.round(z * 100) / 100;
}

/**
 * Klasifikasi status stunting berdasarkan Z-score TB/U (Tinggi Badan / Umur).
 *
 * Kategori sesuai standar WHO:
 * - Severely Stunted : Z < -3
 * - Stunted          : -3 ≤ Z < -2
 * - Normal           : Z ≥ -2
 *
 * @param {number} zscoreTBU - Z-score indikator TB/U
 * @returns {string} Status stunting
 */
function klasifikasiStunting(zscoreTBU) {
  if (zscoreTBU === null || zscoreTBU === undefined) {
    return 'Data Tidak Tersedia';
  }
  if (zscoreTBU < -3) {
    return 'Severely Stunted';
  }
  if (zscoreTBU < -2) {
    return 'Stunted';
  }
  return 'Normal';
}

/**
 * Klasifikasi status gizi berdasarkan Z-score BB/U (Berat Badan / Umur).
 *
 * - Gizi Buruk       : Z < -3
 * - Gizi Kurang      : -3 ≤ Z < -2
 * - Gizi Baik        : -2 ≤ Z ≤ 2
 * - Gizi Lebih       : Z > 2
 *
 * @param {number} zscoreBBU
 * @returns {string}
 */
function klasifikasiGiziBBU(zscoreBBU) {
  if (zscoreBBU === null || zscoreBBU === undefined) {
    return 'Data Tidak Tersedia';
  }
  if (zscoreBBU < -3) return 'Gizi Buruk';
  if (zscoreBBU < -2) return 'Gizi Kurang';
  if (zscoreBBU <= 2) return 'Gizi Baik';
  return 'Gizi Lebih';
}

/**
 * Deteksi Growth Faltering (kegagalan pertumbuhan).
 * Evaluasi apakah berat badan anak TIDAK naik atau TURUN dibanding
 * penimbangan sebelumnya. Kondisi faltering terpenuhi jika:
 *   - Selisih berat (delta) ≤ 0 antara 2 penimbangan berturut-turut, ATAU
 *   - Terjadi penurunan berat 2 kali berturut-turut (T/2T pattern)
 *
 * @param {number} anakId - ID anak di database
 * @returns {Promise<{isFaltering: boolean, delta: number|null, message: string}>}
 */
async function deteksiGrowthFaltering(anakId) {
  const [measurements] = await pool.execute(
    `SELECT berat_badan, tanggal_ukur 
     FROM pengukuran_antropometri 
     WHERE anak_id = ? 
     ORDER BY tanggal_ukur DESC 
     LIMIT 3`,
    [anakId]
  );

  if (measurements.length < 2) {
    return {
      isFaltering: false,
      delta: null,
      message: 'Data pengukuran belum cukup untuk evaluasi growth faltering.',
    };
  }

  // Pengukuran terbaru dan sebelumnya (urutan DESC, index 0 = terbaru)
  const beratTerbaru = measurements[0].berat_badan;
  const beratSebelum = measurements[1].berat_badan;
  const delta = Math.round((beratTerbaru - beratSebelum) * 100) / 100;

  // Cek apakah berat tidak naik (T): faltering dasar
  if (delta <= 0) {
    // Cek pola T/2T: apakah penurunan juga terjadi pada periode sebelumnya
    let isDoubleDecline = false;
    if (measurements.length >= 3) {
      const deltaPrevious = measurements[1].berat_badan - measurements[2].berat_badan;
      if (deltaPrevious <= 0) {
        isDoubleDecline = true;
      }
    }

    return {
      isFaltering: true,
      delta,
      message: isDoubleDecline
        ? `PERINGATAN KRITIS: Berat badan turun 2 kali berturut-turut (T/2T). Selisih terakhir: ${delta} kg.`
        : `Berat badan tidak naik/turun. Selisih: ${delta} kg dari penimbangan sebelumnya.`,
    };
  }

  return {
    isFaltering: false,
    delta,
    message: `Pertumbuhan normal. Kenaikan berat: +${delta} kg.`,
  };
}

async function prosesAnalisisGizi({
  anakId,
  tanggalLahir,
  jenisKelamin,
  tanggalUkur,
  beratBadan,
  tinggiBadan,
}) {
  const usiaBulan = hitungUsiaBulan(tanggalLahir, tanggalUkur);

  // Ambil parameter LMS untuk ketiga indikator
  const [lmsBBU, lmsTBU, lmsBBTB] = await Promise.all([
    ambilParameterLMS('BBU', jenisKelamin, usiaBulan),
    ambilParameterLMS('TBU', jenisKelamin, usiaBulan),
    ambilParameterLMS('BBTB', jenisKelamin, usiaBulan),
  ]);

  // Hitung Z-score
  const zscoreBBU = lmsBBU
    ? hitungZScore(beratBadan, lmsBBU.l_value, lmsBBU.m_value, lmsBBU.s_value)
    : null;

  const zscoreTBU = lmsTBU
    ? hitungZScore(tinggiBadan, lmsTBU.l_value, lmsTBU.m_value, lmsTBU.s_value)
    : null;

  const zscoreBBTB = lmsBBTB
    ? hitungZScore(beratBadan, lmsBBTB.l_value, lmsBBTB.m_value, lmsBBTB.s_value)
    : null;

  // Klasifikasi
  const statusStunting = klasifikasiStunting(zscoreTBU);
  const statusGizi = klasifikasiGiziBBU(zscoreBBU);

  // Deteksi growth faltering
  const faltering = await deteksiGrowthFaltering(anakId);

  return {
    usiaBulan,
    zscoreBBU,
    zscoreTBU,
    zscoreBBTB,
    statusStunting,
    statusGizi,
    indikasiFaltering: faltering.isFaltering,
    detailFaltering: faltering.message,
    deltaBeratBadan: faltering.delta,
  };
}

module.exports = {
  hitungUsiaBulan,
  hitungZScore,
  ambilParameterLMS,
  klasifikasiStunting,
  klasifikasiGiziBBU,
  deteksiGrowthFaltering,
  prosesAnalisisGizi,
};
