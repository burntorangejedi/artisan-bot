const sqlite3 = require('sqlite3').verbose();
const debug = require('./debug');
const path = require('path');
const dbPath = path.resolve(__dirname, '../../guilddata.sqlite');
console.log('[DB] Using database file:', dbPath);
const db = new sqlite3.Database(dbPath);

// Enable foreign key support
db.run('PRAGMA foreign_keys = ON;');

db.serialize(() => {
  debug.log('Initializing database tables...');

  db.run(`
    CREATE TABLE IF NOT EXISTS guild_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      realm TEXT,
      discord_id TEXT,
      class TEXT,
      spec TEXT,
      role TEXT,
      is_main INTEGER DEFAULT 0
    )
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS professions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      profession_id INTEGER UNIQUE
    );
  `);



  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profession_id INTEGER,
      recipe_name TEXT,
      known INTEGER,
      item_id INTEGER,
      FOREIGN KEY(profession_id) REFERENCES professions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS character_recipes (
      member_id INTEGER,
      profession_id INTEGER,
      recipe_id INTEGER,
      max_skill_level INTEGER,
      PRIMARY KEY (member_id, profession_id, recipe_id),
      FOREIGN KEY (member_id) REFERENCES guild_members(id),
      FOREIGN KEY (profession_id) REFERENCES professions(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS character_recipes (
      profession_id INTEGER,
      recipe_id INTEGER,
      max_skill_level INTEGER,
      PRIMARY KEY (profession_id, recipe_id),
      FOREIGN KEY (profession_id) REFERENCES professions(id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    )
  `);


  // Add indexes for performance
  db.run('CREATE INDEX IF NOT EXISTS idx_professions_name ON professions(name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_recipes_profession_id ON recipes(profession_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_recipes_item_id ON recipes(item_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_character_recipes_member_id ON character_recipes(member_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_character_recipes_profession_id ON character_recipes(profession_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_character_recipes_recipe_id ON character_recipes(recipe_id)');

  debug.log("... database table creation complete!");


  // Populate professions if empty
  db.get('SELECT COUNT(*) as count FROM professions', (err, row) => {
    if (err) return debug.log('Error checking professions:', err);
    if (row.count === 0) {
      debug.log('Populating professions with standard professions...');
      const professions = [
        ['Alchemy', 171],
        ['Blacksmithing', 164],
        ['Enchanting', 333],
        ['Engineering', 202],
        ['Herbalism', 182],
        ['Inscription', 773],
        ['Jewelcrafting', 755],
        ['Leatherworking', 165],
        ['Mining', 186],
        ['Skinning', 393],
        ['Tailoring', 197],
        ['Cooking', 185],
        ['Fishing', 356],
        ['Archaeology', 794],
        ['First Aid', 129]
      ];
      const stmt = db.prepare('INSERT INTO professions (name, profession_id) VALUES (?, ?)');
      for (const [name, id] of professions) {
        debug.log(`Inserting profession: ${name} (${id})`);
        stmt.run(name, id);
      }
      stmt.finalize();
      debug.log('Standard professions inserted.');
    } else {
      debug.log(`Professions table already populated with ${row.count} rows.`);
    }
  });

});

// Export the same interface as CosmosDB
module.exports = {
  run: (...args) => db.run(...args),
  get: (...args) => db.get(...args),
  all: (...args) => db.all(...args),
  serialize: (fn) => db.serialize(fn),
  db // export the raw db instance if needed elsewhere
};