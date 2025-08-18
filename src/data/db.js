const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../guilddata.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS guild_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      discord_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS professions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      profession TEXT,
      skill_level INTEGER,
      FOREIGN KEY(member_id) REFERENCES guild_members(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profession_id INTEGER,
      recipe_name TEXT,
      known INTEGER,
      FOREIGN KEY(profession_id) REFERENCES professions(id)
    )
  `);
});

module.exports = db;