const backend = process.env.DB_BACKEND || 'sqlite';

if (backend === 'cosmosdb') {
  module.exports = require('./db_cosmosdb');
} else {
  module.exports = require('./db_sqlite');
}