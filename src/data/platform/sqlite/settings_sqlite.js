require('dotenv').config();

function get(key, fallback = undefined) {
  return process.env[key] || fallback;
}

module.exports = {
  get,
};