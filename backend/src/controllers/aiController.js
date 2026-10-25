const { konsultasiStuntingAI } = require('../services/groqAiService');

async function konsultasiStunting(req, res) {
  const {
    nama_balita,
    usia_bulan,
    jenis_kelamin,
    bb,
    tb,
    lk,
    zscore_bbu,
    zscore_tbu,
    zscore_bbtb,
    riwayat_penyakit,
  } = req.body;

  if (usia_bulan === undefined || !jenis_kelamin || bb === undefined || tb === undefined) {
    return res.status(400).json({
      sukses: false,
      pesan: 'Data klinis tidak lengkap. Wajib menyertakan usia_bulan, jenis_kelamin, bb, dan tb.',
    });
  }

  const hasilKonsultasi = await konsultasiStuntingAI({
    nama_balita,
    usia_bulan: Number(usia_bulan),
    jenis_kelamin: jenis_kelamin.toString().toUpperCase(),
    bb: Number(bb),
    tb: Number(tb),
    lk: lk !== undefined ? Number(lk) : null,
    zscore_bbu: zscore_bbu !== undefined ? Number(zscore_bbu) : null,
    zscore_tbu: zscore_tbu !== undefined ? Number(zscore_tbu) : null,
    zscore_bbtb: zscore_bbtb !== undefined ? Number(zscore_bbtb) : null,
    riwayat_penyakit: riwayat_penyakit || null,
  });

  return res.status(200).json({
    sukses: true,
    pesan: 'Konsultasi klinis berhasil diproses.',
    data: hasilKonsultasi,
  });
}

module.exports = {
  konsultasiStunting,
};
