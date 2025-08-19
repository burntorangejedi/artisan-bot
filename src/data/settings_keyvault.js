const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

const keyVaultUrl = process.env.KEYVAULT_URL; // e.g. "https://myvault.vault.azure.net/"
if (!keyVaultUrl) {
  throw new Error('KEYVAULT_URL environment variable is required for Key Vault settings provider.');
}

const credential = new DefaultAzureCredential();
const client = new SecretClient(keyVaultUrl, credential);

// Simple in-memory cache to avoid repeated lookups
const cache = {};

async function get(key, fallback = undefined) {
  if (cache[key]) return cache[key];

  try {
    const secret = await client.getSecret(key);
    cache[key] = secret.value;
    return secret.value;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Key Vault: Could not retrieve secret "${key}": ${err.message}`);
  }
}

module.exports = {
  get,
}