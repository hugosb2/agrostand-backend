/**
 * @file tokens.js
 * @description Ajudantes de JWT para logout/denylist: nunca persistimos o
 * token bruto, só seu hash SHA-256.
 */

const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { hashToken };
