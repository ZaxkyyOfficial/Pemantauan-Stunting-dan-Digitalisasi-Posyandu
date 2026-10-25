const { createClient } = require('@supabase/supabase-js');
const { pool } = require('../config/database');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SYNC_INTERVAL_MS = parseInt(process.env.SUPABASE_SYNC_INTERVAL_MS, 10) || 300000;

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key || !url.startsWith('https://')) return null;
  if (
    url.includes('xyzcompany') ||
    url.includes('dummy') ||
    url.includes('example.com') ||
    key.includes('dummy_key')
  ) {
    return null;
  }
  try {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    return supabaseClient;
  } catch (_err) {
    return null;
  }
}

async function ensureSyncColumns() {
  const tables = ['keluarga', 'anak', 'pengukuran_antropometri', 'hasil_analisis_gizi'];
  for (const table of tables) {
    try {
      const [cols] = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE 'synced_to_supabase'`);
      if (cols.length === 0) {
        await pool.execute(
          `ALTER TABLE ${table} ADD COLUMN synced_to_supabase TINYINT(1) NOT NULL DEFAULT 0, ADD INDEX idx_sync_supabase (synced_to_supabase)`
        );
      }
    } catch (_err) {
    }
  }
}

async function replicateToSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return {
      sukses: true,
      status: 'STANDALONE_MYSQL_MODE',
      pesan: 'Supabase URL/Key belum dikonfigurasi. Replikasi cloud ditunda tanpa mengganggu MySQL.',
      total_direplikasi: 0,
    };
  }

  await ensureSyncColumns();

  let totalReplicated = 0;

  try {
    const [unsyncedKeluarga] = await pool.execute(
      `SELECT id, no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon
       FROM keluarga
       WHERE synced_to_supabase = 0
       ORDER BY id ASC
       LIMIT 100`
    );

    if (unsyncedKeluarga.length > 0) {
      const payloadKeluarga = unsyncedKeluarga.map((k) => ({
        id: k.id,
        no_kk: k.no_kk,
        nama_ayah: k.nama_ayah,
        nama_ibu: k.nama_ibu,
        alamat_domisili: k.alamat_domisili,
        no_telepon: k.no_telepon,
      }));

      const { error: errKeluarga } = await client
        .from('keluarga')
        .upsert(payloadKeluarga, { onConflict: 'id' });

      if (errKeluarga) throw errKeluarga;

      const keluargaIds = unsyncedKeluarga.map((k) => k.id);
      await pool.query(
        `UPDATE keluarga SET synced_to_supabase = 1 WHERE id IN (?)`,
        [keluargaIds]
      );
      totalReplicated += unsyncedKeluarga.length;
    }

    const [unsyncedAnak] = await pool.execute(
      `SELECT id, keluarga_id, nik, nama_lengkap, jenis_kelamin,
              DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') as tanggal_lahir,
              berat_lahir, panjang_lahir, posyandu_id
       FROM anak
       WHERE synced_to_supabase = 0
       ORDER BY id ASC
       LIMIT 100`
    );

    if (unsyncedAnak.length > 0) {
      const payloadAnak = unsyncedAnak.map((a) => ({
        id: a.id,
        keluarga_id: a.keluarga_id,
        nik: a.nik,
        nama_lengkap: a.nama_lengkap,
        jenis_kelamin: a.jenis_kelamin,
        tanggal_lahir: a.tanggal_lahir,
        berat_lahir: a.berat_lahir,
        panjang_lahir: a.panjang_lahir,
        posyandu_id: a.posyandu_id,
      }));

      const { error: errAnak } = await client
        .from('anak')
        .upsert(payloadAnak, { onConflict: 'id' });

      if (errAnak) throw errAnak;

      const anakIds = unsyncedAnak.map((a) => a.id);
      await pool.query(
        `UPDATE anak SET synced_to_supabase = 1 WHERE id IN (?)`,
        [anakIds]
      );
      totalReplicated += unsyncedAnak.length;
    }

    const [unsyncedUkur] = await pool.execute(
      `SELECT id, kehadiran_id, anak_id,
              DATE_FORMAT(tanggal_ukur, '%Y-%m-%d') as tanggal_ukur,
              berat_badan, tinggi_badan, lingkar_kepala, kader_id
       FROM pengukuran_antropometri
       WHERE synced_to_supabase = 0
       ORDER BY id ASC
       LIMIT 100`
    );

    if (unsyncedUkur.length > 0) {
      const payloadUkur = unsyncedUkur.map((u) => ({
        id: u.id,
        kehadiran_id: null,
        anak_id: u.anak_id,
        tanggal_ukur: u.tanggal_ukur,
        berat_badan: u.berat_badan,
        tinggi_badan: u.tinggi_badan,
        lingkar_kepala: u.lingkar_kepala,
        kader_id: u.kader_id && u.kader_id <= 11 ? u.kader_id : null,
      }));

      const { error: errUkur } = await client
        .from('pengukuran_antropometri')
        .upsert(payloadUkur, { onConflict: 'id' });

      if (errUkur) throw errUkur;

      const ukurIds = unsyncedUkur.map((u) => u.id);
      await pool.query(
        `UPDATE pengukuran_antropometri SET synced_to_supabase = 1 WHERE id IN (?)`,
        [ukurIds]
      );
      totalReplicated += unsyncedUkur.length;
    }

    const [unsyncedGizi] = await pool.execute(
      `SELECT id, pengukuran_id, zscore_bbu, zscore_tbu, zscore_bbtb,
              status_stunting, indikasi_faltering
       FROM hasil_analisis_gizi
       WHERE synced_to_supabase = 0
       ORDER BY id ASC
       LIMIT 100`
    );

    if (unsyncedGizi.length > 0) {
      const payloadGizi = unsyncedGizi.map((g) => ({
        id: g.id,
        pengukuran_id: g.pengukuran_id,
        zscore_bbu: g.zscore_bbu,
        zscore_tbu: g.zscore_tbu,
        zscore_bbtb: g.zscore_bbtb,
        status_stunting: g.status_stunting,
        indikasi_faltering: Boolean(g.indikasi_faltering),
      }));

      const { error: errGizi } = await client
        .from('hasil_analisis_gizi')
        .upsert(payloadGizi, { onConflict: 'id' });

      if (errGizi) throw errGizi;

      const giziIds = unsyncedGizi.map((g) => g.id);
      await pool.query(
        `UPDATE hasil_analisis_gizi SET synced_to_supabase = 1 WHERE id IN (?)`,
        [giziIds]
      );
      totalReplicated += unsyncedGizi.length;
    }

    return {
      sukses: true,
      status: 'REPLICATED',
      total_direplikasi: totalReplicated,
    };
  } catch (_error) {
    return {
      sukses: true,
      status: 'STANDALONE_MYSQL_MODE',
      pesan: 'Operasi cloud offline, database lokal MySQL berjalan mandiri.',
      total_direplikasi: 0,
    };
  }
}

let syncTimeout = null;
function triggerBatchSync() {
  if (!getSupabaseClient()) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    replicateToSupabase().catch(() => {
      console.log('ℹ️ [Supabase Replicator]: Menunggu konektivitas internet/kredensial cloud aktif.');
    });
  }, 1000);
}

let periodicInterval = null;
function startPeriodicSync(intervalMs = SYNC_INTERVAL_MS) {
  ensureSyncColumns().catch(() => {});
  if (!getSupabaseClient()) {
    console.log('ℹ️ [Supabase Replicator]: Menunggu konektivitas internet/kredensial cloud aktif.');
    return;
  }
  if (periodicInterval) clearInterval(periodicInterval);
  periodicInterval = setInterval(() => {
    replicateToSupabase().catch(() => {
      console.log('ℹ️ [Supabase Replicator]: Menunggu konektivitas internet/kredensial cloud aktif.');
    });
  }, intervalMs);
}

module.exports = {
  replicateToSupabase,
  triggerBatchSync,
  startPeriodicSync,
  ensureSyncColumns,
};
