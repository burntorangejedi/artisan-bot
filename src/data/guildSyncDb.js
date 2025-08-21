const db = require('./db');

// Upsert (insert or update) a guild member by name and realm
async function upsertGuildMember({ name, realm, charClass, charSpec, charRole }) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id FROM guild_members WHERE name = ? AND realm = ?`,
            [name, realm],
            (err, row) => {
                if (err) {
                    console.error('[DB] upsertGuildMember SELECT error:', err);
                    return reject(err);
                }
                if (row) {
                    db.run(
                        `UPDATE guild_members SET class = ?, spec = ?, role = ? WHERE id = ?`,
                        [charClass, charSpec, charRole, row.id],
                        err2 => {
                            if (err2) {
                                console.error('[DB] upsertGuildMember UPDATE error:', err2);
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
                                console.error('[DB] upsertGuildMember INSERT error:', err2);
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
    return new Promise((resolve) => {
        db.get('SELECT id FROM professions WHERE name = ?', [name], (err, row) => {
            if (err || !row) return resolve(null);
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
                    console.error('[DB] upsertRecipe SELECT error:', err);
                    return reject(err);
                }
                if (row) return resolve(row.id);
                db.run(
                    `INSERT INTO recipes (profession_id, recipe_name, item_id) VALUES (?, ?, ?)`,
                    [professionId, recipeName, itemId],
                    function (err2) {
                        if (err2) {
                            console.error('[DB] upsertRecipe INSERT error:', err2);
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
                    console.error('[DB] upsertCharacterRecipe INSERT error:', err);
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
            `SELECT name, realm FROM guild_members`,
            [],
            (err, rows) => {
                if (err) return reject(err);
                const toDelete = rows.filter(row =>
                    !currentNamesRealms.some(nr => nr.name === row.name && nr.realm === row.realm)
                );
                let pending = toDelete.length;
                if (pending === 0) return resolve();
                for (const del of toDelete) {
                    db.run(
                        `DELETE FROM guild_members WHERE name = ? AND realm = ?`,
                        [del.name, del.realm],
                        err2 => {
                            if (err2) console.error(`Error deleting departed member ${del.name} (${del.realm}):`, err2);
                            if (--pending === 0) resolve();
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