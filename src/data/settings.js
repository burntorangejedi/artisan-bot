const backend = process.env.SETTINGS_BACKEND;

if (backend === 'keyvault') {
  module.exports = require('./platform/cosmosdb/settings_keyvault');
} else {
  module.exports = require('./platform/sqlite/settings_sqlite');
}