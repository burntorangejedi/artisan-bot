const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../guilddata.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS toons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT,
      toon_name TEXT,
      profession TEXT,
      skill_level INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toon_id INTEGER,
      recipe_name TEXT,
      known INTEGER,
      FOREIGN KEY(toon_id) REFERENCES toons(id)
    )
  `);
});

module.exports = db;