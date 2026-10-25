const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/database');

async function fetchLaporanData(posyanduId, periode, kategori) {
  let whereClause = 'WHERE 1=1';
  const params = [];

  if (posyanduId) {
    whereClause += ' AND a.posyandu_id = ?';
    params.push(parseInt(posyanduId, 10));
  }

  if (periode) {
    whereClause += ' AND DATE_FORMAT(p.tanggal_ukur, "%Y-%m") = ?';
    params.push(periode);
  }

  if (kategori === 'stunting') {
    whereClause += ' AND h.status_stunting IN ("Stunted", "Severely Stunted")';
  } else if (kategori === 'faltering') {
    whereClause += ' AND h.indikasi_faltering = 1';
  }

  const query = `
    SELECT 
      a.id,
      a.nik,
      a.nama_lengkap,
      a.jenis_kelamin,
      DATE_FORMAT(a.tanggal_lahir, '%d-%m-%Y') as tanggal_lahir,
      a.berat_lahir,
      a.panjang_lahir,
      k.nama_ibu,
      k.nama_ayah,
      k.alamat_domisili,
      k.no_kk,
      p.berat_badan,
      p.tinggi_badan,
      p.lingkar_kepala,
      DATE_FORMAT(p.tanggal_ukur, '%d-%m-%Y') as tanggal_ukur,
      h.zscore_bbu,
      h.zscore_tbu,
      h.zscore_bbtb,
      h.status_stunting,
      h.indikasi_faltering,
      pos.nama_posyandu,
      w.nama_wilayah
    FROM anak a
    LEFT JOIN keluarga k ON a.keluarga_id = k.id
    LEFT JOIN posyandu pos ON a.posyandu_id = pos.id
    LEFT JOIN wilayah w ON pos.wilayah_id = w.id
    INNER JOIN pengukuran_antropometri p ON p.id = (
      SELECT id FROM pengukuran_antropometri 
      WHERE anak_id = a.id 
      ${periode ? `AND DATE_FORMAT(tanggal_ukur, '%Y-%m') = '${periode}'` : ''}
      ORDER BY tanggal_ukur DESC, id DESC LIMIT 1
    )
    LEFT JOIN hasil_analisis_gizi h ON h.pengukuran_id = p.id
    ${whereClause}
    ORDER BY pos.nama_posyandu ASC, a.nama_lengkap ASC
  `;

  let rows = [];
  try {
    const [resultRows] = await pool.execute(query, params);
    rows = resultRows || [];
  } catch (_err) {
    rows = [];
  }

  let namaPosyanduTerpilih = 'Seluruh Posyandu';
  if (posyanduId) {
    try {
      const [posRow] = await pool.execute('SELECT nama_posyandu FROM posyandu WHERE id = ? LIMIT 1', [posyanduId]);
      if (posRow && posRow.length > 0) namaPosyanduTerpilih = posRow[0].nama_posyandu;
    } catch (_pErr) {
      namaPosyanduTerpilih = 'Posyandu Terpilih';
    }
  }

  const now = new Date();
  const rowsWithAge = rows.map((b) => {
    let usiaBulan = 0;
    if (b.tanggal_lahir) {
      const parts = String(b.tanggal_lahir).split('-');
      if (parts.length === 3) {
        const birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(birthDate.getTime())) {
          let months = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
          if (now.getDate() < birthDate.getDate()) months--;
          usiaBulan = Math.max(0, months);
        }
      }
    }
    return { ...b, usiaBulan };
  });

  return {
    rows: rowsWithAge,
    namaPosyandu: namaPosyanduTerpilih,
    periode: periode || '2026-09',
    kategori: kategori || 'semua',
  };
}

async function exportExcel(req, res) {
  try {
    const { posyandu_id, periode, kategori } = req.query;
    const { rows = [], namaPosyandu, periode: periodeStr } = await fetchLaporanData(posyandu_id, periode, kategori);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TumbuhSehat Puskesmas Dringu';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rekapitulasi e-PPGBM', {
      properties: { tabColor: { argb: '0C2E28' } },
    });

    sheet.mergeCells('A1:U1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REKAPITULASI DATA PEMANTAUAN PERTUMBUHAN BALITA (e-PPGBM)';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: '0C2E28' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 26;

    sheet.mergeCells('A2:U2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Puskesmas Dringu, Wilayah Kecamatan Dringu, Posyandu: ${namaPosyandu}, Periode: ${periodeStr}`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    const headerLabels = [
      'No',
      'NIK Anak',
      'Nama Lengkap Balita',
      'Jenis Kelamin',
      'Tanggal Lahir',
      'Usia (Bulan)',
      'BB Lahir (kg)',
      'PB Lahir (cm)',
      'Nama Ibu',
      'Nama Ayah',
      'No. KK',
      'Alamat Domisili',
      'Posyandu',
      'Desa / Kelurahan',
      'Tanggal Ukur Terakhir',
      'BB (kg)',
      'TB (cm)',
      'Z-Score BB/U',
      'Z-Score TB/U',
      'Z-Score BB/TB',
      'Status Intervensi Gizi',
    ];

    const headerRow = sheet.addRow(headerLabels);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0C2E28' },
      };
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFF' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'medium', color: { argb: '0C2E28' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } },
      };
    });

    if (rows.length > 0) {
      rows.forEach((b, idx) => {
        let intervensi = 'Pemantauan Rutin Posyandu';
        if (b.status_stunting === 'Severely Stunted' || (b.zscore_bbtb !== null && b.zscore_bbtb < -3)) {
          intervensi = 'Rujukan Spesialis Anak & PKMK';
        } else if (b.status_stunting === 'Stunted') {
          intervensi = 'PMT Pemulihan Protein Tinggi';
        } else if (b.indikasi_faltering) {
          intervensi = 'Konseling Gizi Faltering (T/2T)';
        } else if (b.zscore_bbtb !== null && b.zscore_bbtb < -2) {
          intervensi = 'PMT Balita Kurang Gizi';
        }

        const dataRow = sheet.addRow([
          idx + 1,
          b.nik || '-',
          b.nama_lengkap || '-',
          b.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
          b.tanggal_lahir || '-',
          b.usiaBulan !== undefined ? b.usiaBulan : '-',
          b.berat_lahir ? Number(b.berat_lahir).toFixed(2) : '-',
          b.panjang_lahir ? Number(b.panjang_lahir).toFixed(1) : '-',
          b.nama_ibu || '-',
          b.nama_ayah || '-',
          b.no_kk || '-',
          b.alamat_domisili || '-',
          b.nama_posyandu || '-',
          b.nama_wilayah || 'Desa Dringu',
          b.tanggal_ukur || '-',
          b.berat_badan ? Number(b.berat_badan).toFixed(2) : '-',
          b.tinggi_badan ? Number(b.tinggi_badan).toFixed(1) : '-',
          b.zscore_bbu !== null && b.zscore_bbu !== undefined ? Number(b.zscore_bbu).toFixed(2) : '-',
          b.zscore_tbu !== null && b.zscore_tbu !== undefined ? Number(b.zscore_tbu).toFixed(2) : '-',
          b.zscore_bbtb !== null && b.zscore_bbtb !== undefined ? Number(b.zscore_bbtb).toFixed(2) : '-',
          intervensi,
        ]);

        dataRow.height = 20;
        const bgColor = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';

        dataRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 9 };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } },
          };

          if ([1, 4, 5, 6, 14, 15].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if ([7, 8, 16, 17, 18, 19, 20].includes(colNumber)) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }

          if (colNumber === 21) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (b.status_stunting === 'Severely Stunted') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FAECE7' } };
              cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'C85A32' } };
            } else if (b.status_stunting === 'Stunted' || b.indikasi_faltering) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
              cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'D97706' } };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EBF2EC' } };
              cell.font = { name: 'Calibri', size: 9, color: { argb: '4E8752' } };
            }
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          }
        });
      });
    } else {
      const emptyRow = sheet.addRow([
        '-',
        'Belum ada data penimbangan untuk parameter filter ini.',
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
      ]);
      sheet.mergeCells(`B${emptyRow.number}:U${emptyRow.number}`);
      emptyRow.height = 22;
      emptyRow.getCell(2).font = { name: 'Calibri', size: 9, italic: true, color: { argb: '64748B' } };
      emptyRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    sheet.columns.forEach((column) => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellLen = cell.value ? String(cell.value).length : 0;
        if (cellLen > maxLen) maxLen = cellLen;
      });
      column.width = Math.max(maxLen + 3, 11);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Laporan_ePPGBM_Puskesmas_Dringu_2026.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[Export Excel Error]:', error);
    res.status(500).send(`Gagal mengekspor laporan Excel: ${error.message}`);
  }
}

async function exportPdf(req, res) {
  try {
    const { posyandu_id, periode, kategori } = req.query;
    const { rows = [], namaPosyandu, periode: periodeStr } = await fetchLaporanData(posyandu_id, periode, kategori);

    const totalBalita = rows.length;
    let stuntingCount = 0;
    let falteringCount = 0;
    rows.forEach((r) => {
      if (['Stunted', 'Severely Stunted'].includes(r.status_stunting)) stuntingCount++;
      if (r.indikasi_faltering === 1) falteringCount++;
    });
    const prevalensi = totalBalita > 0 ? ((stuntingCount / totalBalita) * 100).toFixed(2) : '0.00';

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      info: {
        Title: 'Rekapitulasi Surveilans Gizi e-PPGBM Puskesmas Dringu',
        Author: 'Puskesmas Dringu - TumbuhSehat',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Rekapitulasi_ePPGBM_Puskesmas_Dringu_2026.pdf"');
    doc.pipe(res);

    doc.rect(30, 25, 782, 60).fillColor('#F8FAFC').fill();
    doc.rect(30, 85, 782, 2).fillColor('#0C2E28').fill();

    doc.fillColor('#0C2E28')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('PEMERINTAH KABUPATEN PROBOLINGGO', 30, 32, { align: 'center', width: 782 });

    doc.fontSize(10)
      .text('DINAS KESEHATAN, PENGENDALIAN PENDUDUK, DAN KELUARGA BERENCANA', 30, 46, { align: 'center', width: 782 });

    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('PUSKESMAS DRINGU', 30, 59, { align: 'center', width: 782 });

    doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#475569')
      .text('Jl. Raya Dringu No. 12, Kecamatan Dringu, Kabupaten Probolinggo, Jawa Timur 67271', 30, 73, { align: 'center', width: 782 });

    doc.fillColor('#0C2E28')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('BERITA ACARA REKAPITULASI SURVEILANS GIZI & STUNTING BALITA (e-PPGBM)', 30, 96, { align: 'center', width: 782 });

    doc.fillColor('#475569')
      .font('Helvetica')
      .fontSize(8.5)
      .text(`Wilayah: Kecamatan Dringu | Posyandu: ${namaPosyandu} | Periode: ${periodeStr} | Kategori: ${kategori ? kategori.toUpperCase() : 'SEMUA'}`, 30, 112, { align: 'center', width: 782 });

    const boxY = 126;
    const boxW = 188;
    const boxH = 34;

    const metrics = [
      { label: 'TOTAL SASARAN TERPANTAU', val: `${totalBalita} Balita`, color: '#0C2E28' },
      { label: 'KASUS STUNTING / S.STUNTED', val: `${stuntingCount} Kasus`, color: '#C85A32' },
      { label: 'PREVALENSI STUNTING', val: `${prevalensi}%`, color: '#4E8752' },
      { label: 'KASUS GROWTH FALTERING (T/2T)', val: `${falteringCount} Kasus`, color: '#D97706' },
    ];

    metrics.forEach((m, i) => {
      const bX = 30 + (i * 198);
      doc.rect(bX, boxY, boxW, boxH).fillColor('#FFFFFF').strokeColor('#CBD5E1').lineWidth(0.75).fillAndStroke();
      doc.rect(bX, boxY, 4, boxH).fillColor(m.color).fill();

      doc.fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .text(m.label, bX + 10, boxY + 6, { width: boxW - 14 });

      doc.fillColor(m.color)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(m.val, bX + 10, boxY + 17, { width: boxW - 14 });
    });

    const tableTop = 168;
    const colX = [30, 52, 140, 240, 265, 305, 385, 460, 505, 550, 605, 690, 812];
    const colW = [];
    for (let i = 0; i < colX.length - 1; i++) {
      colW.push(colX[i + 1] - colX[i]);
    }

    doc.rect(30, tableTop, 782, 18).fillColor('#0C2E28').fill();

    const headers = [
      'No', 'NIK Balita', 'Nama Balita', 'JK', 'Usia',
      'Nama Ibu', 'Posyandu', 'Tgl Ukur', 'BB (kg)', 'TB (cm)',
      'Z-Score (TB/U)', 'Status Intervensi'
    ];

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    headers.forEach((h, i) => {
      doc.text(h, colX[i] + 2, tableTop + 5, {
        width: colW[i] - 4,
        align: i === 0 || i === 3 || i === 4 || i >= 7 ? 'center' : 'left',
      });
    });

    let yPos = tableTop + 18;
    const maxRowsPerPage = 17;
    let printedRows = 0;

    if (rows.length > 0) {
      rows.forEach((b, idx) => {
        if (printedRows >= maxRowsPerPage) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
          yPos = 35;
          doc.rect(30, yPos, 782, 18).fillColor('#0C2E28').fill();
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
          headers.forEach((h, i) => {
            doc.text(h, colX[i] + 2, yPos + 5, {
              width: colW[i] - 4,
              align: i === 0 || i === 3 || i === 4 || i >= 7 ? 'center' : 'left',
            });
          });
          yPos += 18;
          printedRows = 0;
        }

        const rowH = 15;
        const isZebra = idx % 2 === 1;

        if (isZebra) {
          doc.rect(30, yPos, 782, rowH).fillColor('#F8FAFC').fill();
        }

        doc.rect(30, yPos + rowH, 782, 0.5).fillColor('#E2E8F0').fill();
        doc.font('Helvetica').fontSize(7).fillColor('#0F172A');

        let nikMasked = '-';
        if (b.nik) {
          const raw = String(b.nik).trim();
          nikMasked = raw.length >= 16 ? `${raw.slice(0, 4)}****${raw.slice(-4)}` : raw;
        }

        doc.text(String(idx + 1), colX[0] + 2, yPos + 4, { width: colW[0] - 4, align: 'center' });
        doc.text(nikMasked, colX[1] + 2, yPos + 4, { width: colW[1] - 4, align: 'left' });
        doc.font('Helvetica-Bold').text(b.nama_lengkap || '-', colX[2] + 2, yPos + 4, { width: colW[2] - 4, align: 'left' });
        doc.font('Helvetica');
        doc.text(b.jenis_kelamin || '-', colX[3] + 2, yPos + 4, { width: colW[3] - 4, align: 'center' });
        doc.text(`${b.usiaBulan} bln`, colX[4] + 2, yPos + 4, { width: colW[4] - 4, align: 'center' });
        doc.text(b.nama_ibu ? `Ny. ${b.nama_ibu}` : '-', colX[5] + 2, yPos + 4, { width: colW[5] - 4, align: 'left' });
        doc.text(b.nama_posyandu || '-', colX[6] + 2, yPos + 4, { width: colW[6] - 4, align: 'left' });
        doc.text(b.tanggal_ukur || '-', colX[7] + 2, yPos + 4, { width: colW[7] - 4, align: 'center' });
        doc.text(b.berat_badan ? Number(b.berat_badan).toFixed(2) : '-', colX[8] + 2, yPos + 4, { width: colW[8] - 4, align: 'center' });
        doc.text(b.tinggi_badan ? Number(b.tinggi_badan).toFixed(1) : '-', colX[9] + 2, yPos + 4, { width: colW[9] - 4, align: 'center' });
        doc.text(b.zscore_tbu !== null ? `${Number(b.zscore_tbu).toFixed(2)} SD` : '-', colX[10] + 2, yPos + 4, { width: colW[10] - 4, align: 'center' });

        let intervensi = 'Pemantauan Rutin';
        let statusColor = '#4E8752';
        if (b.status_stunting === 'Severely Stunted') {
          intervensi = 'Rujukan PKMK';
          statusColor = '#C85A32';
        } else if (b.status_stunting === 'Stunted') {
          intervensi = 'PMT Pemulihan';
          statusColor = '#D97706';
        } else if (b.indikasi_faltering) {
          intervensi = 'Konseling T/2T';
          statusColor = '#C85A32';
        }

        doc.fillColor(statusColor).font('Helvetica-Bold')
          .text(intervensi, colX[11] + 2, yPos + 4, { width: colW[11] - 4, align: 'center' });

        yPos += rowH;
        printedRows++;
      });
    } else {
      doc.rect(30, yPos, 782, 22).fillColor('#F8FAFC').fill();
      doc.rect(30, yPos + 22, 782, 0.5).fillColor('#E2E8F0').fill();
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Belum ada data penimbangan balita pada filter yang dipilih.', 30, yPos + 7, { align: 'center', width: 782 });
      yPos += 26;
    }

    const sigY = Math.min(yPos + 18, 500);
    doc.fillColor('#0F172A').font('Helvetica').fontSize(8);

    doc.text('Dringu, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), 550, sigY);
    doc.text('Penanggung Jawab Program Gizi Puskesmas Dringu,', 550, sigY + 12);
    doc.font('Helvetica-Bold').text('dr. Siti Aminah', 550, sigY + 50);
    doc.font('Helvetica').text('NIP. 19820415 200801 2 008', 550, sigY + 60);

    doc.text('Mengetahui,', 80, sigY + 12);
    doc.text('Kepala Puskesmas Dringu,', 80, sigY + 22);
    doc.font('Helvetica-Bold').text('dr. H. Bambang Hermanto, M.Kes', 80, sigY + 50);
    doc.font('Helvetica').text('NIP. 19750912 200312 1 004', 80, sigY + 60);

    doc.end();
  } catch (error) {
    console.error('[Export PDF Error]:', error);
    res.status(500).send(`Gagal mengekspor laporan PDF: ${error.message}`);
  }
}

module.exports = {
  exportExcel,
  exportPdf,
};
