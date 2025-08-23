// settings.js
// Centralized settings/configuration provider for the bot
// For now, reads from process.env, but can be extended for Azure KeyVault, etc.


class Settings {
  get WHOHAS_OUTPUT_STYLE() {
    return process.env.WHOHAS_OUTPUT_STYLE || 'table';
  }
  get DISCORD_LIMIT() {
    return process.env.DISCORD_LIMIT || 100;
  }
  get WHOHAS_PAGE_SIZE() {
    return parseInt(process.env.WHOHAS_PAGE_SIZE, 10) || 10;
  }
  get SYNC_BATCH_SIZE() {
    return parseInt(process.env.SYNC_BATCH_SIZE, 10) || 5;
  }
  get DISCORD_TOKEN() {
    return process.env.DISCORD_TOKEN;
  }
  get CLIENT_ID() {
    return process.env.CLIENT_ID;
  }
  get GUILD_ID() {
    return process.env.GUILD_ID;
  }
  get DEBUG_LEVEL() {
    return (process.env.DEBUG_LEVEL || 'none').toLowerCase();
  }
  get SETTINGS_BACKEND() {
    return process.env.SETTINGS_BACKEND || 'env';
  }
  get DB_BACKEND() {
    return process.env.DB_BACKEND || 'sqlite';
  }
  get REGION() {
    return process.env.REGION || 'us';
  }
  get LOCALE() {
    return process.env.LOCALE || 'en_US';
  }
  get BLIZZARD_CLIENT_ID() {
    return process.env.BLIZZARD_CLIENT_ID;
  }
  get BLIZZARD_CLIENT_SECRET() {
    return process.env.BLIZZARD_CLIENT_SECRET;
  }
  get REALM() {
    return process.env.REALM;
  }
  get GUILD_NAME() {
    return process.env.GUILD_NAME;
  }
  get KEYVAULT_URL() {
    return process.env.KEYVAULT_URL;
  }
}

module.exports = new Settings();
