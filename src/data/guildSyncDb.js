const db = require('./db');

// Upsert (insert or update) a guild member by name and realm
async function upsertGuildMember({ name, realm, charClass, charSpec, charRole }) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id FROM guild_members WHERE name = ? AND realm = ?`,
            [name, realm],
            (err, row) => {
                if (err) return reject(err);
                if (row) {
                    db.run(
                        `UPDATE guild_members SET class = ?, spec = ?, role = ? WHERE id = ?`,
                        [charClass, charSpec, charRole, row.id],
                        err2 => err2 ? reject(err2) : resolve(row.id)
                    );
                } else {
                    db.run(
                        `INSERT INTO guild_members (name, realm, class, spec, role) VALUES (?, ?, ?, ?, ?)`,
                        [name, realm, charClass, charSpec, charRole],
                        function (err2) {
                            if (err2) return reject(err2);
                            resolve(this.lastID);
                        }
                    );
                }
            }
        );
    });
}

// Upsert a profession for a member
async function insertProfession(memberId, profession, skillLevel) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO professions (member_id, profession, skill_level) VALUES (?, ?, ?)`,
            [memberId, profession, skillLevel],
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Insert a recipe for a profession
async function insertRecipe(professionId, recipeName, known = 1) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO recipes (profession_id, recipe_name, known) VALUES (?, ?, ?)`,
            [professionId, recipeName, known],
            function (err) {
                if (err) return reject(err);
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
    insertProfession,
    insertRecipe,
    deleteDepartedMembers
};