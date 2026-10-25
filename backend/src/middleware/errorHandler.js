function errorHandler(err, req, res, _next) {
  if (err.isJoi) {
    return res.status(422).json({
      sukses: false,
      pesan: 'Validasi data gagal.',
      errors: err.details.map((d) => ({
        field: d.path.join('.'),
        pesan: d.message,
      })),
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      sukses: false,
      pesan: 'Data duplikat. Record dengan nilai unik tersebut sudah ada.',
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(422).json({
      sukses: false,
      pesan: 'Referensi data tidak valid. Pastikan data induk sudah tersedia.',
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    sukses: false,
    pesan: err.message || 'Terjadi kesalahan internal server.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
