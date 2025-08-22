const sqlite3 = require('sqlite3').verbose();
const debug = require('./debug');
const path = require('path');
const { getBlizzardAccessToken, getProfessionsIndex, getSkillTiersForProfession, getRecipesForSkillTier } = require('../blizzard/api');
const dbPath = path.resolve(__dirname, '../../guilddata.sqlite');
console.log('[DB] Using database file:', dbPath);
const db = new sqlite3.Database(dbPath);

// Enable foreign key support
db.run('PRAGMA foreign_keys = ON;');

db.serialize(() => {
  debug.log('Initializing database tables...');

  // Guild members (characters)
  debug.log('guild_members...');
  db.run(`
    CREATE TABLE IF NOT EXISTS guild_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      realm TEXT NOT NULL,
      discord_id TEXT,
      class TEXT,
      spec TEXT,
      role TEXT,
      is_main INTEGER DEFAULT 0,
      UNIQUE(name, realm)
    )
  `);

  // Master professions list
  debug.log('professions...');
  db.run(`
    CREATE TABLE IF NOT EXISTS professions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      profession_id INTEGER UNIQUE
    );
  `);

  // Master recipes list
  debug.log('recipes...');
  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profession_id INTEGER NOT NULL,
      profession_name TEXT,
      skill_tier_id INTEGER,
      skill_tier_name TEXT,
      recipe_id INTEGER,
      recipe_name TEXT NOT NULL,
      item_id INTEGER,
      FOREIGN KEY(profession_id) REFERENCES professions(id)
    )
  `);

  // Character <-> Recipe mapping
  debug.log('character_recipes...');
  db.run(`
    CREATE TABLE IF NOT EXISTS character_recipes (
      member_id INTEGER NOT NULL,
      profession_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      max_skill_level INTEGER,
      PRIMARY KEY (member_id, profession_id, recipe_id),
      FOREIGN KEY (member_id) REFERENCES guild_members(id),
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

  // Initialize master data after tables and indexes are created
  initializeDb().catch(err => {
    debug.log('[DB] Error initializing master data:', err);
  });

});

async function populateProfessionsIfEmpty() {
  await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM professions', async (err, row) => {
      if (err) return reject('[DB:populateProfessionsIfEmpty] Error checking professions: ' + err);
      if (row.count === 0) {
        debug.log('[DB:populateProfessionsIfEmpty] Populating professions from Blizzard API...');
        try {
          const accessToken = await getBlizzardAccessToken();
          const data = await getProfessionsIndex(accessToken);
          if (!data || !data.professions) {
            debug.log('[DB:populateProfessionsIfEmpty] Failed to fetch professions from Blizzard API.', data);
            throw new Error('Failed to fetch professions from Blizzard API.');
          }
          await Promise.all(
            data.professions.map(prof => {
              let name = prof.name;
              if (typeof name === 'object') {
                name = name['en_US'] || Object.values(name)[0];
              }
              debug.log(`[DB:populateProfessionsIfEmpty] Inserting profession: ${name} (${prof.id})`);
              return new Promise((resolve2, reject2) => {
                db.run(
                  'INSERT OR IGNORE INTO professions (name, profession_id) VALUES (?, ?)',
                  [name, prof.id],
                  err2 => {
                    if (err2) {
                      debug.log(`[DB:populateProfessionsIfEmpty] Error inserting profession ${name} (${prof.id}):`, err2);
                      return reject2(err2);
                    }
                    resolve2();
                  }
                );
              });
            })
          );
          debug.log('[DB:populateProfessionsIfEmpty] Standard professions inserted.');
        } catch (e) {
          debug.log('[DB:populateProfessionsIfEmpty] Error populating professions:', e && e.stack ? e.stack : e);
          return reject(e);
        }
      } else {
        debug.log(`[DB:populateProfessionsIfEmpty] Professions table already populated with ${row.count} rows.`);
      }
      resolve();
    });
  });
}

async function populateRecipesIfEmpty() {
  await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM recipes', async (err2, row2) => {
      if (err2) return reject('[DB:populateRecipesIfEmpty] Error checking recipes: ' + err2);
      if (row2.count === 0) {
        debug.log('[DB:populateRecipesIfEmpty] Recipes table is empty. Populating all recipes from Blizzard API (new tier-aware method)...');
        try {
          const accessToken = await getBlizzardAccessToken();
          const professions = await new Promise((resolveProf, rejectProf) => {
            db.all('SELECT id, profession_id, name FROM professions', [], (err3, rows) => {
              if (err3) {
                debug.log('[DB:populateRecipesIfEmpty] Error fetching professions for recipes:', err3);
                return rejectProf('Error fetching professions: ' + err3);
              }
              resolveProf(rows);
            });
          });
          for (const prof of professions) {
            debug.log(`[DB:populateRecipesIfEmpty] Fetching skill tiers for ${prof.name} (${prof.profession_id})...`);
            const profDetails = await getSkillTiersForProfession(prof.profession_id, accessToken);
            if (!profDetails || !profDetails.skill_tiers || !profDetails.skill_tiers.length) {
              debug.log(`[DB:populateRecipesIfEmpty] No skill_tiers found for profession ${prof.name} (${prof.profession_id})`);
              continue;
            }
            for (const tier of profDetails.skill_tiers) {
              debug.log(`[DB:populateRecipesIfEmpty] Fetching recipes for skill tier ${tier.id} (${tier.name}) for profession ${prof.name}...`);
              const tierRecipes = await getRecipesForSkillTier(prof.profession_id, tier.id, accessToken);
              if (!tierRecipes || !tierRecipes.categories) {
                debug.log(`[DB:populateRecipesIfEmpty] No categories found for skill tier ${tier.id} (${tier.name}) in profession ${prof.name}`);
                continue;
              }
              // Deduplicate by crafted_item.id
              const seenCraftedItems = new Set();
              for (const category of tierRecipes.categories) {
                debug.log(`[DB:populateRecipesIfEmpty] Category: ${category.name}, recipes: ${category.recipes ? category.recipes.length : 0}`);
                if (!category.recipes) continue;
                for (const recipeRef of category.recipes) {
                  // recipeRef: { id, name, url }
                  const recipeId = recipeRef.id;
                  const recipeName = recipeRef.name || '';
                  if (seenCraftedItems.has(recipeName))
                    continue;
                  else
                    seenCraftedItems.add(recipeName);

                  await new Promise((resolve4, reject4) => {
                    db.run(
                      `INSERT OR IGNORE INTO recipes (profession_id, profession_name, skill_tier_id, skill_tier_name, recipe_id, recipe_name, item_id) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
                      [prof.id, prof.name, tier.id, tier.name, recipeId, recipeName],
                      (err4) => {
                        if (err4) debug.log(`[DB:populateRecipesIfEmpty] Error inserting recipe ${recipeName} (ID ${recipeId}) for profession ${prof.name}:`, err4);
                        resolve4();
                      }
                    );
                  });
                }
              }
            }
            debug.log(`[DB:populateRecipesIfEmpty] Done with ${prof.name}`);
          }
          debug.log('[DB:populateRecipesIfEmpty] All recipes populated!');
          resolve();
        } catch (e) {
          debug.log('[DB] Error populating recipes:', e && e.stack ? e.stack : e);
          return reject(e);
        }
      } else {
        debug.log(`[DB:populateRecipesIfEmpty] Recipes table already populated with ${row2.count} rows.`);
        resolve();
      }
    });
  });
}

async function initializeDb() {
  await populateProfessionsIfEmpty();
  await populateRecipesIfEmpty();
}


// Export the same interface as CosmosDB, plus master data init
module.exports = {
  run: (...args) => db.run(...args),
  get: (...args) => db.get(...args),
  all: (...args) => db.all(...args),
  serialize: (fn) => db.serialize(fn)
};

