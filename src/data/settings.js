const backend = process.env.SETTINGS_BACKEND || 'env';

if (backend === 'keyvault') {
  module.exports = require('./settings_keyvault');
} else {
  module.exports = require('./settings_env');
}