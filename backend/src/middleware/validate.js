function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      errors: { wrap: { label: '' } },
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        pesan: detail.message,
      }));

      return res.status(422).json({
        sukses: false,
        pesan: 'Validasi data gagal.',
        errors: details,
      });
    }

    req.body = value;
    next();
  };
}

module.exports = validate;
