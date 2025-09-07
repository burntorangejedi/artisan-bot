// =====================================
// artisan-bot: SQLite DB Implementation
// =====================================

// --- Module Imports ---
const debug = require('../../debug');
const path = require('path');
const { getBlizzardAccessToken, getProfessionsIndex, getSkillTiersForProfession, getRecipesForSkillTier } = require('../../../blizzard/api');
const roles = require('../../../constants/roles');


// =============================
// SQLite DB Implementation
// =============================

// --- Database Initialization ---
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.resolve(__dirname, '../../../../guilddata.sqlite');
const db = new sqlite3.Database(dbPath);
debug.log('[DB] Using database file:', dbPath);

// Enable foreign key support
db.run('PRAGMA foreign_keys = ON;');

// Build the database if needed
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

// =============================
// Character Helpers
// =============================

/**
 * Get class and spec for a character by name (case-insensitive).
 * @param {string} name
 * @returns {Promise<{class: string, spec: string}>}
 */
async function getClassAndSpecForCharacter(name) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT class, spec FROM guild_members WHERE name = ? COLLATE NOCASE`,
			[name],
			(err, row) => err ? reject(err) : resolve(row)
		);
	});
}

/**
 * Claim a character as your very own. If you have no main selected,
 * it will set this character as your main..
 * @param {string} name
 * @returns {Promise<{class: string, spec: string}>}
 */
async function claimCharacter(discordId, charId) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE guild_members SET discord_id = ? WHERE id = ?`,
			[discordId, charId],
			err => err ? reject(err) : resolve()
		);
	});
}

/**
 * Unset all main characters for a user.
 * @param {string} discordId
 * @returns {Promise<void>}
 */
async function unsetMainForUser(discordId) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE guild_members SET is_main = 0 WHERE discord_id = ?`,
			[discordId],
			err => err ? reject(err) : resolve()
		);
	});
}

/**
 * Set a character as main by character ID.
 * @param {number} charId
 * @returns {Promise<void>}
 */
async function setMainCharacter(charId) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE guild_members SET is_main = 1 WHERE id = ?`,
			[charId],
			err => err ? reject(err) : resolve()
		);
	});
}

/**
 * Get a character row by name for unclaim (case-insensitive).
 * @param {string} name
 * @returns {Promise<{id: number, discord_id: string, is_main: number}>}
 */
async function getCharacterRowForUnclaim(name) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT id, discord_id, is_main FROM guild_members WHERE name = ? COLLATE NOCASE`,
			[name],
			(err, row) => err ? reject(err) : resolve(row)
		);
	});
}

/**
 * Unclaim a character by character ID.
 * @param {number} charId
 * @returns {Promise<void>}
 */
async function unclaimCharacter(charId) {
	return new Promise((resolve, reject) => {
		db.run(
			`UPDATE guild_members SET discord_id = NULL, is_main = 0 WHERE id = ?`,
			[charId],
			err => err ? reject(err) : resolve()
		);
	});
}

/**
 * List all claimed characters for a user.
 * @param {string} discordId
 * @returns {Promise<Array>}
 */
async function listClaimedCharacters(discordId) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT name, class, spec, role, is_main FROM guild_members WHERE discord_id = ? ORDER BY name`,
			[discordId],
			(err, rows) => err ? reject(err) : resolve(rows)
		);
	});
}

/**
 * Get the count of claimed characters for a user, excluding a specific character name.
 * @param {string} discordId
 * @param {string} excludeName
 * @returns {Promise<number>}
 */
async function getClaimedCharacterCount(discordId, excludeName) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT COUNT(*) as count FROM guild_members WHERE discord_id = ? AND name != ? COLLATE NOCASE`,
			[discordId, excludeName],
			(err, row) => err ? reject(err) : resolve(row.count)
		);
	});
}

/**
 * Get a character row by name (case-insensitive).
 * @param {string} name
 * @returns {Promise<{id: number, discord_id: string}>}
 */
async function getCharacterRowByName(name) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT id, discord_id FROM guild_members WHERE name = ? COLLATE NOCASE`,
			[name],
			(err, row) => err ? reject(err) : resolve(row)
		);
	});
}

/**
 * Get all professions for a character (case-insensitive by name, based on recipes known).
 * @param {string} characterName
 * @returns {Promise<string[]>}
 */
async function getProfessionsForCharacter(characterName) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT DISTINCT p.name as profession
			 FROM character_recipes cr
			 JOIN professions p ON cr.profession_id = p.id
			 JOIN guild_members gm ON cr.member_id = gm.id
			 WHERE gm.name = ? COLLATE NOCASE`,
			[characterName],
			(err, rows) => err ? reject(err) : resolve(rows.map(row => row.profession))
		);
	});
}

// =============================
// High-Level Sync Helpers
// =============================

/**
 * Delete guild members not in the current roster (by name and realm).
 * @param {Array<{name: string, realm: string}>} currentNamesRealms
 */
async function deleteDepartedMembers(currentNamesRealms) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT id, name, realm FROM guild_members`,
			[],
			(err, rows) => {
				if (err) {
					debug.log('[DB] deleteDepartedMembers SELECT error:', err);
					return reject(err);
				}
				const toDelete = rows.filter(row =>
					!currentNamesRealms.some(nr => nr.name === row.name && nr.realm === row.realm)
				);
				let pending = toDelete.length;
				if (pending === 0) return resolve({ deletedMembers: 0, deletedCharacterRecipes: 0 });
				let deletedCharacterRecipes = 0;
				for (const del of toDelete) {
					db.run(
						`DELETE FROM character_recipes WHERE member_id = ?`,
						[del.id],
						function (err2) {
							if (err2) debug.log(`[DB] Error deleting character_recipes for departed member ${del.name} (${del.realm}):`, err2);
							const removedForMember = this && this.changes ? this.changes : 0;
							deletedCharacterRecipes += removedForMember;
							db.run(
								`DELETE FROM guild_members WHERE id = ?`,
								[del.id],
								(err3) => {
									if (err3) debug.log(`[DB] Error deleting departed member ${del.name} (${del.realm}):`, err3);
									if (--pending === 0) resolve({ deletedMembers: toDelete.length, deletedCharacterRecipes });
								}
							);
						}
					);
				}
			}
		);
	});
}

/**
 * Cleanup orphaned character_recipes (referencing non-existent members or recipes).
 */
async function cleanupOrphanedCharacterRecipes() {
	await new Promise((resolve, reject) => {
		db.run(`DELETE FROM character_recipes WHERE member_id NOT IN (SELECT id FROM guild_members)`, err => {
			if (err) return reject(err);
			db.run(`DELETE FROM character_recipes WHERE recipe_id NOT IN (SELECT id FROM recipes)`, err2 => {
				if (err2) return reject(err2);
				resolve();
			});
		});
	});
}

/**
 * Upsert a guild member and all their professions/recipes.
 * @param {Object} param0
 * @param {Object} param0.character
 * @param {Object} param0.summary
 * @param {Object} param0.professions
 * @param {string} param0.accessToken
 */
async function syncGuildMember({ character, summary, professions, accessToken }) {
	// character: { name, realm: { slug } }
	// summary: { character_class, active_spec }
	// professions: { primaries, secondaries }
	const charName = character.name;
	const realmSlug = character.realm.slug;
	let charClass = summary && summary.character_class ? summary.character_class.name : null;
	let charSpec = summary && summary.active_spec ? summary.active_spec.name : null;
	let charRole = null;
	// Derive the main role (Tank/Healer/Ranged DPS/Melee DPS) from spec+class when available
	try {
		if (charSpec && charClass) {
			charRole = roles.getMainRoleForSpecClass(charSpec, charClass) || null;
		}
	} catch (e) {
		// keep null on error but log for visibility
		debug.log('[DB] Failed to derive charRole for', { charSpec, charClass, err: e && e.stack ? e.stack : e });
	}
	// Counters for this member
	let addedMembers = 0;
	let updatedMembers = 0;
	let addedRecipes = 0;
	let removedRecipes = 0;

	// Upsert member
	const memberResult = await upsertGuildMember({
		name: charName,
		realm: realmSlug,
		charClass,
		charSpec,
		charRole
	});
	const memberId = memberResult.id;
	if (memberResult.created) addedMembers++;
	if (memberResult.updated) updatedMembers++;

	// Upsert professions/recipes
	const allProfs = [];
	if (professions && professions.primaries) allProfs.push(...professions.primaries);
	if (professions && professions.secondaries) allProfs.push(...professions.secondaries);
	for (const prof of allProfs) {
		const professionName = prof.profession.name;
		const professionId = await getProfessionIdByName(professionName);
		if (!professionId) continue;
		// Gather all known Blizzard recipe IDs for this character/profession
		let knownBlizzRecipeIds = [];
		if (prof.tiers && Array.isArray(prof.tiers)) {
			for (const tier of prof.tiers) {
				if (tier.known_recipes && Array.isArray(tier.known_recipes)) {
					knownBlizzRecipeIds.push(...tier.known_recipes.map(r => r.id));
				}
			}
		}
		// Map Blizzard recipe IDs to internal recipes.id
		let validRecipeRows = [];
		if (knownBlizzRecipeIds.length) {
			validRecipeRows = await new Promise((resolve, reject) => {
				db.all(
					`SELECT id, recipe_id FROM recipes WHERE profession_id = ? AND recipe_id IN (${knownBlizzRecipeIds.map(() => '?').join(',')})`,
					[professionId, ...knownBlizzRecipeIds],
					(err, rows) => {
						if (err) return reject(err);
						resolve(rows);
					}
				);
			});
		}
		const validRecipeIds = validRecipeRows.map(r => r.id);
		// Remove any character_recipes for this member/profession that are no longer known
		const removedForThisProf = await new Promise((resolve, reject) => {
			db.run(
				`DELETE FROM character_recipes WHERE member_id = ? AND profession_id = ? AND recipe_id NOT IN (${validRecipeIds.length ? validRecipeIds.map(() => '?').join(',') : 'NULL'})`,
				[memberId, professionId, ...validRecipeIds],
				function (err) {
					if (err) debug.log(`Error cleaning up old character_recipes for ${charName} (${professionName}):`, err);
					const removed = this && this.changes ? this.changes : 0;
					resolve(removed);
				}
			);
		});
		removedRecipes += removedForThisProf;
		// Insert or update character_recipes for all valid known recipes
		for (const recipeId of validRecipeIds) {
			const res = await upsertCharacterRecipe(memberId, professionId, recipeId);
			if (res && res.inserted) addedRecipes++;
		}
	}

	return { addedMembers, updatedMembers, addedRecipes, removedRecipes };
}

// --- Helper functions used by syncGuildMember ---
async function upsertGuildMember({ name, realm, charClass, charSpec, charRole }) {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT id FROM guild_members WHERE name = ? AND realm = ?`,
			[name, realm],
			(err, row) => {
				if (err) {
					debug.log('[DB] upsertGuildMember SELECT error:', { err, name, realm });
					return reject(err);
				}
				if (row) {
					db.run(
						`UPDATE guild_members SET class = ?, spec = ?, role = ? WHERE id = ?`,
						[charClass, charSpec, charRole, row.id],
						function (err2) {
							if (err2) {
								debug.log('[DB] upsertGuildMember UPDATE error:', { err2, name, realm, row });
								return reject(err2);
							}
							// this.changes may be 0 if no actual change
							const updated = this && this.changes && this.changes > 0;
							resolve({ id: row.id, created: false, updated });
						}
					);
				} else {
					db.run(
						`INSERT INTO guild_members (name, realm, class, spec, role) VALUES (?, ?, ?, ?, ?)`,
						[name, realm, charClass, charSpec, charRole],
						function (err2) {
							if (err2) {
								debug.log('[DB] upsertGuildMember INSERT error:', { err2, name, realm });
								return reject(err2);
							}
							resolve({ id: this.lastID, created: true, updated: false });
						}
					);
				}
			}
		);
	});
}

async function getProfessionIdByName(name) {
	return new Promise((resolve, reject) => {
		db.get('SELECT id FROM professions WHERE name = ?', [name], (err, row) => {
			if (err) {
				debug.log('[DB] getProfessionIdByName error:', { err, name });
				return reject(err);
			}
			if (!row) return resolve(null);
			resolve(row.id);
		});
	});
}

async function upsertCharacterRecipe(memberId, professionId, recipeId) {
	return new Promise((resolve, reject) => {
		db.run(
			`INSERT OR IGNORE INTO character_recipes (member_id, profession_id, recipe_id)
			 VALUES (?, ?, ?)`,
			[memberId, professionId, recipeId],
			function (err) {
				if (err) {
					debug.log('[DB] upsertCharacterRecipe INSERT error:', { err, memberId, professionId, recipeId });
					return reject(err);
				}
				const inserted = this && this.changes && this.changes > 0;
				resolve({ inserted, lastID: this.lastID });
			}
		);
	});
}


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



// =============================
// Query Helpers
// =============================

/**
 * Find crafters by partial recipe name.
 * @param {string} recipeName
 * @param {function} callback
 */
function searchCraftersByRecipeName(recipeName, callback) {
	db.all(
		`SELECT gm.name AS member, p.name AS profession, cr.max_skill_level, r.recipe_name, gm.discord_id, r.id as recipe_id, gm.id as member_id, r.item_id
		 FROM character_recipes cr
		 JOIN recipes r ON cr.recipe_id = r.id
		 JOIN professions p ON cr.profession_id = p.id
		 JOIN guild_members gm ON cr.member_id = gm.id
		 WHERE r.recipe_name LIKE ?`,
		[`%${recipeName}%`],
		callback
	);
}

/**
 * Find crafters by crafted item ID.
 * @param {number} itemId
 * @param {function} callback
 */
function searchCraftersByItemId(itemId, callback) {
	db.all(
		`SELECT gm.name AS member, p.name AS profession, cr.max_skill_level, r.recipe_name, gm.discord_id, r.id as recipe_id, gm.id as member_id, r.item_id
		 FROM character_recipes cr
		 JOIN recipes r ON cr.recipe_id = r.id
		 JOIN professions p ON cr.profession_id = p.id
		 JOIN guild_members gm ON cr.member_id = gm.id
		 WHERE r.item_id = ?`,
		[itemId],
		callback
	);
}

/**
 * Get characters that have a given profession (based on character_recipes)
 * @param {string} profession
 * @param {function} callback
 */
function getCharactersByProfession(profession, callback) {
	db.all(
		`SELECT DISTINCT gm.name, gm.class, gm.spec, gm.role, gm.discord_id
		 FROM character_recipes cr
		 JOIN professions p ON cr.profession_id = p.id
		 JOIN guild_members gm ON cr.member_id = gm.id
		 WHERE p.name = ? COLLATE NOCASE
		 ORDER BY gm.name`,
		[profession],
		callback
	);
}

/**
 * Get characters by main role (Tank/Healer/etc)
 * @param {string} role
 * @param {function} callback
 */
function getCharactersByRole(role, callback) {
	// First try exact match on stored role. If no rows (legacy data), fall back to deriving main role from spec+class.
	db.all(
		`SELECT name, class, spec, role, discord_id FROM guild_members WHERE role = ? COLLATE NOCASE ORDER BY name`,
		[role],
		(err, rows) => {
			if (err) return callback(err);
			if (rows && rows.length) return callback(null, rows);
			// Fallback: load all members and filter by derived main role (handles legacy rows with NULL role)
			db.all(`SELECT name, class, spec, role, discord_id FROM guild_members`, [], (err2, allRows) => {
				if (err2) return callback(err2);
				const desired = String(role || '').toLowerCase();
				const filtered = (allRows || []).filter(r => {
					try {
						const derived = roles.getMainRoleForSpecClass(r.spec || '', r.class || '') || null;
						if (r.role && String(r.role).toLowerCase() === desired) return true;
						if (derived && String(derived).toLowerCase() === desired) return true;
						return false;
					} catch (e) {
						return false;
					}
				});
				// sort by name
				filtered.sort((a, b) => String(a.name).localeCompare(String(b.name)));
				return callback(null, filtered);
			});
		}
	);
}

/**
 * Get characters by class name
 * @param {string} clazz
 * @param {function} callback
 */
function getCharactersByClass(clazz, callback) {
	db.all(
		`SELECT name, class, spec, role, discord_id FROM guild_members WHERE class = ? COLLATE NOCASE ORDER BY name`,
		[clazz],
		callback
	);
}

/**
 * Get claimed characters; if mainsOnly is true, return only is_main = 1
 * @param {boolean} mainsOnly
 * @param {function} callback
 */
function getClaimedCharacters(mainsOnly, callback) {
	const sql = mainsOnly
		? `SELECT name, class, spec, is_main, discord_id FROM guild_members WHERE is_main = 1 AND discord_id IS NOT NULL ORDER BY name`
		: `SELECT name, class, spec, is_main, discord_id FROM guild_members WHERE discord_id IS NOT NULL ORDER BY name`;
	db.all(sql, [], callback);
}

/**
 * Get unclaimed characters
 * @param {function} callback
 */
function getUnclaimedCharacters(callback) {
	db.all(`SELECT name, class, spec FROM guild_members WHERE discord_id IS NULL ORDER BY name`, [], callback);
}

// =============================
// Module Exports
// =============================
module.exports = {
	getClassAndSpecForCharacter,
	run: (...args) => db.run(...args),
	get: (...args) => db.get(...args),
	all: (...args) => db.all(...args),
	serialize: (fn) => db.serialize(fn),
	searchCraftersByRecipeName,
	searchCraftersByItemId,
	// High-level character helpers
	getClaimedCharacterCount,
	getCharacterRowByName,
	claimCharacter,
	unsetMainForUser,
	setMainCharacter,
	getCharacterRowForUnclaim,
	unclaimCharacter,
	listClaimedCharacters,
	getProfessionsForCharacter,
	// Guild listing helpers
	getCharactersByProfession,
	getCharactersByRole,
	getCharactersByClass,
	getClaimedCharacters,
	getUnclaimedCharacters,
	// High-level sync helpers
	deleteDepartedMembers,
	cleanupOrphanedCharacterRecipes,
	syncGuildMember
};
