const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOSDB_ENDPOINT;
const key = process.env.COSMOSDB_KEY;
const databaseId = process.env.COSMOSDB_DATABASE || 'artisanbot';
const containerId = process.env.COSMOSDB_CONTAINER || 'guildmembers';

const client = new CosmosClient({ endpoint, key });
const db = client.database(databaseId);
const container = db.container(containerId);

// Helper to mimic sqlite's callback style for get/all/run
function callbackify(promise, cb) {
  promise
    .then(result => cb(null, result))
    .catch(err => cb(err));
}

// Run: for inserts/updates/deletes
function run(query, params, cb) {
  // Example: Only supports simple upserts for now
  // You will need to parse your SQL and convert to CosmosDB queries
  cb(new Error('CosmosDB run() not fully implemented. Please implement query translation.'));
}

// Get: fetch a single document
function get(query, params, cb) {
  // Example: Only supports fetching by id for now
  // You will need to parse your SQL and convert to CosmosDB queries
  cb(new Error('CosmosDB get() not fully implemented. Please implement query translation.'));
}

// All: fetch multiple documents
function all(query, params, cb) {
  // Example: Only supports fetching all documents
  // You will need to parse your SQL and convert to CosmosDB queries
  cb(new Error('CosmosDB all() not fully implemented. Please implement query translation.'));
}

// Serialize: just run the function immediately (no-op for Cosmos)
function serialize(fn) {
  fn();
}

module.exports = {
  run,
  get,
  all,
  serialize,
};