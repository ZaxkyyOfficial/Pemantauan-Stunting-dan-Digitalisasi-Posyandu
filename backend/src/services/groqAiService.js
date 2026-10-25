const Groq = require('groq-sdk');

function generateClinicalFallback({
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
}) {
  const isStunting = typeof zscore_tbu === 'number' && zscore_tbu < -2.0;
  const isSeverelyStunted = typeof zscore_tbu === 'number' && zscore_tbu < -3.0;
  const isWasted = typeof zscore_bbtb === 'number' && zscore_bbtb < -2.0;
  const isUnderweight = typeof zscore_bbu === 'number' && zscore_bbu < -2.0;
  const needsReferral = isStunting || isWasted || isSeverelyStunted;

  const statusTbu = isSeverelyStunted
    ? 'Severely Stunted (Sangat Pendek)'
    : isStunting
    ? 'Stunted (Pendek)'
    : 'Normal (Tinggi Sesuai Umur)';

  const statusBbu = isUnderweight ? 'Berat Badan Kurang (Underweight)' : 'Berat Badan Normal';
  const statusBbtb = isWasted ? 'Gizi Kurang (Wasted)' : 'Gizi Baik (Normal)';

  let tindakanKader = 'Lanjutkan pemantauan pertumbuhan rutin setiap bulan di posyandu.';
  let tindakanRujukan = 'Tidak memerlukan rujukan medis segera.';
  let tingkatRisiko = 'RENDAH';

  if (isSeverelyStunted || isWasted) {
    tingkatRisiko = 'TINGGI';
    tindakanKader = 'Segera dampingi orang tua dan buat surat rujukan ke Puskesmas Dringu.';
    tindakanRujukan = 'Rujuk segera ke Dokter Spesialis Anak / Poli Gizi Puskesmas untuk evaluasi red flags dan F-100.';
  } else if (isStunting || isUnderweight) {
    tingkatRisiko = 'SEDANG';
    tindakanKader = 'Edukasi ibu mengenai porsi protein hewani harian dan jadwalkan evaluasi 14 hari.';
    tindakanRujukan = 'Konsultasikan ke Tenaga Pelaksana Gizi (TPG) Puskesmas jika berat badan tidak naik pada penimbangan berikutnya.';
  }

  const mpasiRekomendasi = [
    'Hati ayam kampung (1-2 kali seminggu, kaya zat besi heme)',
    'Telur ayam 1 butir per hari (protein berkualitas tinggi dan kolin)',
    'Ikan kembung kukus (kaya asam lemak omega-3 dan protein hewani lokal)',
    'Minyak kelapa atau santan matang sebagai penambah densitas kalori',
  ];

  return {
    ringkasan_klinis: `Balita ${nama_balita || 'Anak'} (${usia_bulan || '-'} bulan, ${jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}) dengan status TB/U ${statusTbu}, BB/U ${statusBbu}, dan BB/TB ${statusBbtb}.`,
    status_tbu: statusTbu,
    status_bbu: statusBbu,
    status_bbtb: statusBbtb,
    tingkat_risiko: tingkatRisiko,
    perlu_rujukan: needsReferral,
    instruksi_rujukan: tindakanRujukan,
    tindakan_kader: tindakanKader,
    rekomendasi_mpasi: mpasiRekomendasi,
    catatan_dokter: riwayat_penyakit
      ? `Perhatian khusus terhadap riwayat penyakit: ${riwayat_penyakit}. Pastikan anak sembuh tuntas dari infeksi kronis/berulang sebelum evaluasi kenaikan berat badan.`
      : 'Tidak ada catatan penyakit penyerta yang dilaporkan.',
    model_ai: 'Clinical Engine Fallback (Standar Kemenkes RI & WHO)',
  };
}

async function konsultasiStuntingAI(data) {
  const apiKey = process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const isDummyKey = !apiKey || apiKey.includes('demo') || apiKey.includes('change_me') || apiKey.length < 20;

  if (isDummyKey) {
    return generateClinicalFallback(data);
  }

  const systemPrompt = `Anda berperan sebagai "Dokter Spesialis Anak Konsultan Gizi Puskesmas Dringu".
Berikan evaluasi klinis ringkas terhadap hasil Z-score antropometri balita, identifikasi risiko faltering (growth faltering pola T/2T), anjuran MPASI pangan lokal tinggi protein hewani (seperti telur ayam, hati ayam kampung, ikan kembung), dan arahan rujukan medis resmi Puskesmas Dringu.
Format jawaban WAJIB berupa JSON murni tanpa markdown triple-backticks dengan schema berikut:
{
  "ringkasan_klinis": "string evaluasi klinis ringkas status Z-score",
  "status_tbu": "string status TB/U",
  "status_bbu": "string status BB/U",
  "status_bbtb": "string status BB/TB",
  "tingkat_risiko": "TINGGI / SEDANG / RENDAH",
  "perlu_rujukan": true / false,
  "instruksi_rujukan": "string arahan rujukan medis resmi Puskesmas Dringu",
  "tindakan_kader": "string langkah konkret yang harus dilakukan kader posyandu",
  "rekomendasi_mpasi": ["string anjuran MPASI pangan lokal protein hewani 1", "string poin 2", "string poin 3"],
  "catatan_dokter": "string catatan observasi klinis atau evaluasi riwayat penyakit"
}`;

  const userPrompt = `Data Klinis Balita:
- Nama: ${data.nama_balita || 'Anak'}
- Usia: ${data.usia_bulan} bulan
- Jenis Kelamin: ${data.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
- Berat Badan: ${data.bb} kg
- Tinggi/Panjang Badan: ${data.tb} cm
- Lingkar Kepala: ${data.lk ? data.lk + ' cm' : 'Belum diukur'}
- Z-Score BB/U: ${data.zscore_bbu ?? '-'}
- Z-Score TB/U: ${data.zscore_tbu ?? '-'}
- Z-Score BB/TB: ${data.zscore_bbtb ?? '-'}
- Riwayat Penyakit: ${data.riwayat_penyakit || 'Tidak ada riwayat sakit'}`;

  try {
    const groq = new Groq({ apiKey });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: modelName,
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      });
    } catch (primaryErr) {
      console.warn(`[Groq Primary Model Error]: ${primaryErr.message}. Mencoba fallback ke llama-3.1-8b-instant`);
      completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      });
    }

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);
    parsed.model_ai = `Groq ${completion.model || modelName}`;
    return parsed;
  } catch (error) {
    console.warn(`[Groq AI Fallback]: ${error.message}`);
    return generateClinicalFallback(data);
  }
}

module.exports = {
  konsultasiStuntingAI,
  generateClinicalFallback,
};
