const compression = require('compression');

function customCompressionFilter(req, res) {
  if (req.originalUrl && req.originalUrl.includes('/api/v1/benchmark')) {
    return false;
  }

  if (req.headers['x-no-compression'] || (req.query && req.query.compress === '0')) {
    return false;
  }

  if (!compression.filter(req, res)) {
    return false;
  }

  const contentType = res.getHeader('Content-Type') || '';
  const typeStr = String(contentType).toLowerCase();
  return typeStr.includes('application/json') || typeStr.includes('text/html');
}

// HTTP Response Compression (Gzip Level 9, threshold 1KB for JSON & HTML)
const compressionMiddleware = compression({
  level: 9,
  threshold: 1024,
  filter: customCompressionFilter,
});

module.exports = compressionMiddleware;
