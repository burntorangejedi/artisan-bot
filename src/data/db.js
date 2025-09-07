
const backend = process.env.DB_BACKEND || 'sqlite';

if (backend === 'cosmosdb') {
  // CosmosDB backend
  const db = require('./platform/cosmosdb/db_cosmosdb');
} else {
  // SQLite backend
  const db = require('./platform/sqlite/db_sqlite');
  // Exports
  module.exports = {
    ...db
  };
}