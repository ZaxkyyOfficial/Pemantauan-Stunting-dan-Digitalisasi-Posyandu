require('dotenv').config();
const CryptoJS = require('crypto-js');

// AES-128-CBC with PKCS7 padding for medical data & NIK transmission
const DEFAULT_KEY = 'TumbuhSehatKey16';
const DEFAULT_IV = 'TumbuhSehatIV16!';

const rawKey = process.env.CRYPTO_SECRET_KEY || process.env.AES_SECRET_KEY || DEFAULT_KEY;
const rawIv = process.env.CRYPTO_IV || process.env.AES_IV || DEFAULT_IV;

function formatTo16Bytes(str, fallback) {
  const val = str || fallback;
  return val.length < 16 ? val.padEnd(16, '0') : val.slice(0, 16);
}

const SECRET_KEY = CryptoJS.enc.Utf8.parse(formatTo16Bytes(rawKey, DEFAULT_KEY));
const IV = CryptoJS.enc.Utf8.parse(formatTo16Bytes(rawIv, DEFAULT_IV));

function encryptData(data) {
  if (data === null || data === undefined) return data;
  const plainText = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return CryptoJS.AES.encrypt(plainText, SECRET_KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

function decryptData(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY, {
      iv: IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted || decrypted.trim() === '') return encryptedData;
    return (decrypted.startsWith('{') || decrypted.startsWith('[')) ? JSON.parse(decrypted) : decrypted;
  } catch (err) {
    return encryptedData;
  }
}

function encryptResponse(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (!body || typeof body !== 'object') return originalJson(body);
    const payload = body.data !== undefined ? body.data : body;
    return originalJson({
      sukses: body.sukses !== undefined ? body.sukses : true,
      data: encryptData(payload),
      _encrypted: true,
      _algorithm: 'AES-128-CBC',
    });
  };
  next();
}

module.exports = { encryptData, decryptData, encryptResponse };
