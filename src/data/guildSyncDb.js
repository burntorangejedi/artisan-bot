const db = require('./db');
const debug = require('./debug');

// Upsert (insert or update) a guild member by name and realm
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
                        err2 => {
                            if (err2) {
                                debug.log('[DB] upsertGuildMember UPDATE error:', { err2, name, realm, row });
                                return reject(err2);
                            }
                            resolve(row.id);
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
                            resolve(this.lastID);
                        }
                    );
                }
            }
        );
    });
}


// Get profession id by name
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

// Insert a recipe for a profession if not exists, return recipe id
async function upsertRecipe(professionId, recipeName, itemId = null) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id FROM recipes WHERE profession_id = ? AND recipe_name = ?`,
            [professionId, recipeName],
            (err, row) => {
                if (err) {
                    debug.log('[DB] upsertRecipe SELECT error:', { err, professionId, recipeName });
                    return reject(err);
                }
                if (row) return resolve(row.id);
                db.run(
                    `INSERT INTO recipes (profession_id, recipe_name, item_id) VALUES (?, ?, ?)`,
                    [professionId, recipeName, itemId],
                    function (err2) {
                        if (err2) {
                            debug.log('[DB] upsertRecipe INSERT error:', { err2, professionId, recipeName, itemId });
                            return reject(err2);
                        }
                        resolve(this.lastID);
                    }
                );
            }
        );
    });
}

// Insert or update a character's known recipe (no skill level)
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
                resolve(this.lastID);
            }
        );
    });
}

// Delete guild members not in the current roster (by name and realm)
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
                if (pending === 0) return resolve();
                for (const del of toDelete) {
                    db.run(
                        `DELETE FROM character_recipes WHERE member_id = ?`,
                        [del.id],
                        err2 => {
                            if (err2) debug.log(`[DB] Error deleting character_recipes for departed member ${del.name} (${del.realm}):`, err2);
                            db.run(
                                `DELETE FROM guild_members WHERE id = ?`,
                                [del.id],
                                err3 => {
                                    if (err3) debug.log(`[DB] Error deleting departed member ${del.name} (${del.realm}):`, err3);
                                    if (--pending === 0) resolve();
                                }
                            );
                        }
                    );
                }
            }
        );
    });
}

module.exports = {
    upsertGuildMember,
    getProfessionIdByName,
    upsertRecipe,
    upsertCharacterRecipe,
    deleteDepartedMembers
};