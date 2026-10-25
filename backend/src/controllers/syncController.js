const { pool } = require('../config/database');
const { prosesAnalisisGizi } = require('../services/whoEngine');
const { encryptData, decryptData } = require('../middleware/crypto');
const { triggerBatchSync } = require('../services/supabaseSyncService');

async function pushSync(req, res) {
  const { kode_perangkat, timestamp, batch } = req.body;

  if (!batch || !Array.isArray(batch)) {
    return res.status(400).json({
      sukses: false,
      pesan: 'Payload batch mutasi tidak valid atau kosong.',
    });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const mapping = {
      anak: {},
      pengukuran: {},
    };

    let processedCount = 0;

    for (const item of batch) {
      const localId = item.local_id || item.id_referensi;
      const namaTabel = item.nama_tabel;
      const aksi = (item.aksi || 'INSERT').toUpperCase();
      const rawData = typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {});

      // Decrypt NIK if transmitted in AES-128-CBC encrypted format
      if (rawData.nik) {
        rawData.nik = decryptData(rawData.nik);
      }

      // Idempotency check against prior sync records
      const [existingSync] = await connection.execute(
        `SELECT id, id_referensi, data_json FROM antrean_sinkronisasi 
         WHERE nama_tabel = ? AND id_referensi = ? AND status_sync = 'Berhasil' 
         ORDER BY id DESC LIMIT 1`,
        [namaTabel, localId]
      );

      if (namaTabel === 'anak') {
        let serverAnakId = null;

        if (existingSync.length > 0) {
          if (rawData.nik) {
            const [existingChild] = await connection.execute(
              `SELECT id FROM anak WHERE nik = ? LIMIT 1`,
              [rawData.nik]
            );
            if (existingChild.length > 0) serverAnakId = existingChild[0].id;
          }
        }

        if (!serverAnakId) {
          let keluargaId = rawData.keluarga_id || null;
          if (!keluargaId && (rawData.no_kk || rawData.nama_ibu)) {
            const [kelRows] = await connection.execute(
              `SELECT id FROM keluarga WHERE no_kk = ? OR (nama_ibu = ? AND nama_ayah = ?) LIMIT 1`,
              [rawData.no_kk || '', rawData.nama_ibu || '', rawData.nama_ayah || '']
            );
            if (kelRows.length > 0) {
              keluargaId = kelRows[0].id;
            } else if (rawData.nama_ibu) {
              const [kelRes] = await connection.execute(
                `INSERT INTO keluarga (no_kk, nama_ayah, nama_ibu, alamat_domisili, no_telepon)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  rawData.no_kk || '-',
                  rawData.nama_ayah || '-',
                  rawData.nama_ibu,
                  rawData.alamat_domisili || null,
                  rawData.no_telepon || null,
                ]
              );
              keluargaId = kelRes.insertId;
            }
          }

          if (rawData.nik) {
            const [byNik] = await connection.execute(
              `SELECT id FROM anak WHERE nik = ? LIMIT 1`,
              [rawData.nik]
            );
            if (byNik.length > 0) {
              serverAnakId = byNik[0].id;
            }
          }

          if (!serverAnakId) {
            const namaLengkap = rawData.nama_lengkap || rawData.namaLengkap || 'Tanpa Nama';
            const jenisKelamin = rawData.jenis_kelamin || rawData.jenisKelamin || 'L';
            const tanggalLahir = rawData.tanggal_lahir || rawData.tanggalLahir || '2025-01-01';
            const beratLahir = (rawData.berat_lahir !== undefined ? rawData.berat_lahir : rawData.beratLahir) || null;
            const panjangLahir = (rawData.panjang_lahir !== undefined ? rawData.panjang_lahir : rawData.panjangLahir) || null;

            const [anakRes] = await connection.execute(
              `INSERT INTO anak (keluarga_id, nik, nama_lengkap, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                keluargaId || null,
                rawData.nik || null,
                namaLengkap,
                jenisKelamin,
                tanggalLahir,
                beratLahir,
                panjangLahir,
              ]
            );
            serverAnakId = anakRes.insertId;
          }

          await connection.execute(
            `INSERT INTO antrean_sinkronisasi (nama_tabel, id_referensi, aksi, data_json, status_sync)
             VALUES (?, ?, ?, ?, 'Berhasil')`,
            ['anak', localId, aksi, JSON.stringify(rawData)]
          );
        }

        mapping.anak[localId] = serverAnakId;
        processedCount++;

      } else if (namaTabel === 'pengukuran_antropometri') {
        let serverPengukuranId = null;

        let resolvedAnakId = rawData.anak_id;
        if (mapping.anak[resolvedAnakId]) {
          resolvedAnakId = mapping.anak[resolvedAnakId];
        }

        const tanggalUkur = rawData.tanggal_ukur || rawData.tanggalUkur || new Date().toISOString().split('T')[0];
        const beratBadan = parseFloat(rawData.berat_badan !== undefined ? rawData.berat_badan : rawData.beratBadan) || 0;
        const tinggiBadan = parseFloat(rawData.tinggi_badan !== undefined ? rawData.tinggi_badan : rawData.tinggiBadan) || 0;
        const lingkarKepala = (rawData.lingkar_kepala !== undefined ? rawData.lingkar_kepala : rawData.lingkarKepala) || null;
        const kaderId = (rawData.kader_id !== undefined ? rawData.kader_id : rawData.kaderId) || req.user?.id || null;

        const [pengukuranRes] = await connection.execute(
          `INSERT INTO pengukuran_antropometri 
           (anak_id, tanggal_ukur, berat_badan, tinggi_badan, lingkar_kepala, kader_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             berat_badan = VALUES(berat_badan),
             tinggi_badan = VALUES(tinggi_badan),
             lingkar_kepala = VALUES(lingkar_kepala),
             kader_id = VALUES(kader_id)`,
          [
            resolvedAnakId,
            tanggalUkur,
            beratBadan,
            tinggiBadan,
            lingkarKepala,
            kaderId,
          ]
        );
        serverPengukuranId = pengukuranRes.insertId;
        if (!serverPengukuranId) {
          const [findExisting] = await connection.execute(
            `SELECT id FROM pengukuran_antropometri WHERE anak_id = ? AND tanggal_ukur = ? LIMIT 1`,
            [resolvedAnakId, tanggalUkur]
          );
          if (findExisting.length > 0) {
            serverPengukuranId = findExisting[0].id;
          }
        }

        const [anakRows] = await connection.execute(
          `SELECT id, nama_lengkap, jenis_kelamin, 
                  DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') as tanggal_lahir 
           FROM anak WHERE id = ?`,
          [resolvedAnakId]
        );

        const anak = anakRows[0];
        if (anak && serverPengukuranId) {
          try {
            const analisis = await prosesAnalisisGizi({
              anakId: resolvedAnakId,
              tanggalLahir: anak.tanggal_lahir,
              jenisKelamin: anak.jenis_kelamin,
              tanggalUkur: rawData.tanggal_ukur || tanggalUkur,
              beratBadan: beratBadan,
              tinggiBadan: tinggiBadan,
            });

            await connection.execute(
              `INSERT INTO hasil_analisis_gizi 
               (pengukuran_id, zscore_bbu, zscore_tbu, zscore_bbtb, status_stunting, indikasi_faltering)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 zscore_bbu = VALUES(zscore_bbu),
                 zscore_tbu = VALUES(zscore_tbu),
                 zscore_bbtb = VALUES(zscore_bbtb),
                 status_stunting = VALUES(status_stunting),
                 indikasi_faltering = VALUES(indikasi_faltering)`,
              [
                serverPengukuranId,
                analisis.zscoreBBU,
                analisis.zscoreTBU,
                analisis.zscoreBBTB,
                analisis.statusStunting,
                analisis.indikasiFaltering ? 1 : 0,
              ]
            );

            if (analisis.zscoreTBU !== null && analisis.zscoreTBU < -2) {
              const bahaya = analisis.zscoreTBU < -3 ? 'Merah' : 'Kuning';
              const pesan = `${anak.nama_lengkap}: ${analisis.statusStunting} (TB/U: ${analisis.zscoreTBU}). Perlu tindak lanjut.`;
              await connection.execute(
                `INSERT INTO peringatan_dini (anak_id, tingkat_bahaya, pesan_peringatan, status_tindak_lanjut)
                 VALUES (?, ?, ?, 'Belum')`,
                [resolvedAnakId, bahaya, pesan]
              );
            }
          } catch (err) {
            console.warn('[Sync WHO Engine Warning]:', err.message);
          }
        }

        await connection.execute(
          `INSERT INTO antrean_sinkronisasi (nama_tabel, id_referensi, aksi, data_json, status_sync)
           VALUES (?, ?, ?, ?, 'Berhasil')`,
          ['pengukuran_antropometri', localId, aksi, JSON.stringify(rawData)]
        );

        mapping.pengukuran[localId] = serverPengukuranId;
        processedCount++;
      }
    }

    if (kode_perangkat) {
      const [perangkatRows] = await connection.execute(
        `SELECT id FROM perangkat_kader WHERE kode_perangkat = ? LIMIT 1`,
        [kode_perangkat]
      );

      if (perangkatRows.length > 0) {
        await connection.execute(
          `UPDATE perangkat_kader SET waktu_sync_terakhir = NOW() WHERE kode_perangkat = ?`,
          [kode_perangkat]
        );
      } else {
        await connection.execute(
          `INSERT INTO perangkat_kader (pengguna_id, kode_perangkat, waktu_sync_terakhir)
           VALUES (?, ?, NOW())`,
          [req.user?.id || null, kode_perangkat]
        );
      }
    }

    await connection.commit();
    triggerBatchSync();

    return res.status(200).json({
      sukses: true,
      pesan: `Sinkronisasi push berhasil. ${processedCount} data mutasi diproses.`,
      waktu_server: new Date().toISOString(),
      total_diproses: processedCount,
      mapping: mapping,
    });

  } catch (error) {
    await connection.rollback();
    console.error('[Sync Push Error]:', error);
    return res.status(500).json({
      sukses: false,
      pesan: `Gagal memproses sinkronisasi: ${error.message}`,
    });
  } finally {
    connection.release();
  }
}

async function pullSync(req, res) {
  try {
    const { since, posyandu_id } = req.query;

    const [anakRows] = await pool.execute(
      `SELECT a.id, a.keluarga_id, a.nik, a.nama_lengkap, a.jenis_kelamin, 
              DATE_FORMAT(a.tanggal_lahir, '%Y-%m-%d') as tanggal_lahir,
              a.berat_lahir, a.panjang_lahir,
              k.no_kk, k.nama_ayah, k.nama_ibu, k.alamat_domisili, k.no_telepon
       FROM anak a
       LEFT JOIN keluarga k ON a.keluarga_id = k.id
       ORDER BY a.id ASC`
    );

    let pengukuranQuery = `
      SELECT p.id, p.anak_id, 
             DATE_FORMAT(p.tanggal_ukur, '%Y-%m-%d') as tanggal_ukur,
             p.berat_badan, p.tinggi_badan, p.lingkar_kepala, p.kader_id,
             h.zscore_bbu, h.zscore_tbu, h.zscore_bbtb, 
             h.status_stunting, h.indikasi_faltering
      FROM pengukuran_antropometri p
      LEFT JOIN hasil_analisis_gizi h ON p.id = h.pengukuran_id
    `;
    const pengukuranParams = [];

    if (since) {
      pengukuranQuery += ` WHERE p.tanggal_ukur >= DATE(?)`;
      pengukuranParams.push(since);
    }

    pengukuranQuery += ` ORDER BY p.tanggal_ukur DESC, p.id DESC LIMIT 200`;
    const [pengukuranRows] = await pool.execute(pengukuranQuery, pengukuranParams);

    let jadwalQuery = `
      SELECT j.id, j.posyandu_id, 
             DATE_FORMAT(j.tanggal_kegiatan, '%Y-%m-%d') as tanggal_kegiatan, 
             j.keterangan,
             pos.nama_posyandu
      FROM jadwal_kegiatan j
      LEFT JOIN posyandu pos ON j.posyandu_id = pos.id
    `;
    const jadwalParams = [];

    if (posyandu_id) {
      jadwalQuery += ` WHERE j.posyandu_id = ?`;
      jadwalParams.push(posyandu_id);
    }

    jadwalQuery += ` ORDER BY j.tanggal_kegiatan DESC LIMIT 30`;
    const [jadwalRows] = await pool.execute(jadwalQuery, jadwalParams);

    // Encrypt sensitive child NIK for AES-128-CBC delta transmission
    const sanitizedAnak = anakRows.map((anak) => ({
      ...anak,
      nik: anak.nik ? encryptData(anak.nik) : null,
    }));

    return res.status(200).json({
      sukses: true,
      pesan: 'Master delta data berhasil ditarik.',
      waktu_server: new Date().toISOString(),
      data: {
        anak: sanitizedAnak,
        pengukuran: pengukuranRows,
        jadwal: jadwalRows,
      },
    });
  } catch (error) {
    console.error('[Sync Pull Error]:', error);
    return res.status(500).json({
      sukses: false,
      pesan: `Gagal menarik data sinkronisasi: ${error.message}`,
    });
  }
}

module.exports = {
  pushSync,
  pullSync,
};
