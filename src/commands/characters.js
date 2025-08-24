// Assign all Discord roles for a main character (professions, spec/class, main role)
async function assignAllMainRoles(guild, member, characterName) {
    await removeOldProfessionRoles(guild, member);
    await assignProfessionRoles(guild, member, characterName);
    await removeOldSpecClassAndMainRoles(guild, member);
    await assignSpecClassAndMainRole(guild, member, characterName);
}
const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');

// Profession and role lists (customize as needed)
const { ALL_PROFESSIONS, MAIN_ROLES, SPEC_ROLE_MAP, getMainRoleForSpecClass } = require('../constants/roles');

// Remove all profession roles
async function removeOldProfessionRoles(guild, member) {
    for (const prof of ALL_PROFESSIONS) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
        if (role && member.roles.cache.has(role.id)) {
            try { await member.roles.remove(role); } catch (e) { }
        }
    }
}

// Remove all spec/class and main role roles
async function removeOldSpecClassAndMainRoles(guild, member) {
    // Remove main roles
    for (const roleName of MAIN_ROLES) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role && member.roles.cache.has(role.id)) {
            try { await member.roles.remove(role); } catch (e) { }
        }
    }
    // Remove all roles that look like "Spec Class" (e.g., "Frost Mage")
    for (const role of guild.roles.cache.values()) {
        if (/^[A-Za-z ]+ [A-Za-z]+$/.test(role.name) && member.roles.cache.has(role.id)) {
            try { await member.roles.remove(role); } catch (e) { }
        }
    }
}

// Assign all profession roles for a character
async function assignProfessionRoles(guild, member, characterName) {
    const professions = await db.getProfessionsForCharacter(characterName);
    for (const prof of professions) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
        if (role && !member.roles.cache.has(role.id)) {
            try { await member.roles.add(role); } catch (e) { }
        }
    }
}

// Assign spec/class and main role for a character
async function assignSpecClassAndMainRole(guild, member, characterName) {
    const row = await db.getClassAndSpecForCharacter(characterName);
    if (!row) return;
    // Assign Spec+Class role
    if (row.class && row.spec) {
        const specClass = `${row.spec} ${row.class}`.trim();
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === specClass.toLowerCase());
        if (role && !member.roles.cache.has(role.id)) {
            try { await member.roles.add(role); } catch (e) { }
        }
        // Assign Main Role (Tank, Healer, Ranged DPS, Melee DPS)
        const mainRoleName = getMainRoleForSpecClass(row.spec, row.class);
        if (mainRoleName && mainRoleName !== "-") {
            const mainRole = guild.roles.cache.find(r => r.name.toLowerCase() === mainRoleName.toLowerCase());
            if (mainRole && !member.roles.cache.has(mainRole.id)) {
                try { await member.roles.add(mainRole); } catch (e) { }
            }
        }
    }
}

// Remove all relevant roles (professions, spec/class, main role)
async function removeAllRelevantRoles(guild, member) {
    await removeOldProfessionRoles(guild, member);
    await removeOldSpecClassAndMainRoles(guild, member);
}

// Assign all roles for a character (professions, spec/class, main role)
async function assignAllRolesForCharacter(guild, member, characterName) {
    await assignProfessionRoles(guild, member, characterName);
    await assignSpecClassAndMainRole(guild, member, characterName);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('characters')
        .setDescription('Claim characters and set your main')
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Claim a character as your own')
                .addStringOption(opt =>
                    opt.setName('character')
                        .setDescription('Character name (as in guild)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addBooleanOption(opt =>
                    opt.setName('ismain')
                        .setDescription('Set this character as your main')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('setmain')
                .setDescription('Set one of your claimed characters as your main')
                .addStringOption(opt =>
                    opt.setName('character')
                        .setDescription('Character name (must be claimed by you)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all characters you have claimed')
        )
        .addSubcommand(sub =>
            sub.setName('unclaim')
                .setDescription('Unclaim a character you previously claimed')
                .addStringOption(opt =>
                    opt.setName('character')
                        .setDescription('Character name (must be claimed by you)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const discordId = interaction.user.id;
        const guild = interaction.guild;
        const member = await guild.members.fetch(discordId);

        if (subcommand === 'claim') {
            const character = interaction.options.getString('character');
            let isMain = interaction.options.getBoolean('ismain');

            try {
                // Check if user already has any claimed characters (excluding this one)
                const claimedCount = await db.getClaimedCharacterCount(discordId, character);
                if (claimedCount === 0) {
                    isMain = true;
                }

                // Get the character row
                const charRow = await db.getCharacterRowByName(character);
                if (!charRow) {
                    return interaction.reply('Character not found in the guild database.');
                }
                if (charRow.discord_id && charRow.discord_id !== discordId) {
                    return interaction.reply('Character already claimed by another user.');
                }

                // Claim the character
                await db.claimCharacter(discordId, charRow.id);

                let msg = `✅ ${character} claimed!`;
                if (isMain) {
                    await db.unsetMainForUser(discordId);
                    await db.setMainCharacter(charRow.id);
                    await assignAllMainRoles(guild, member, character);
                    msg += ` Set as your main. Roles updated.`;
                }
                return interaction.reply(msg);
            } catch (err) {
                console.error(err);
                return interaction.reply('Database error.');
            }
        }

        else if (subcommand === 'unclaim') {
            const character = interaction.options.getString('character');
            try {
                const row = await db.getCharacterRowForUnclaim(character);
                if (!row || row.discord_id !== discordId) {
                    return interaction.reply('You must claim this character first.');
                }
                // If this was your main, unset is_main and remove roles
                if (row.is_main) {
                    await removeAllRelevantRoles(guild, member);
                }
                await db.unclaimCharacter(row.id);
                return interaction.reply(`✅ ${character} has been unclaimed.`);
            } catch (err) {
                console.error(err);
                return interaction.reply('Database error.');
            }
        }

        else if (subcommand === 'list') {
            try {
                const rows = await db.listClaimedCharacters(discordId);
                if (!rows.length) {
                    return interaction.reply('You have not claimed any characters.');
                }
                // Set column widths to match the header
                const header = `Character           | Class         | Spec           | Role          | Main`;
                const separator = `--------------------|---------------|----------------|---------------|------`;
                const lines = rows.map(row => {
                    const roleName = (row.class && row.spec)
                        ? getMainRoleForSpecClass(row.spec, row.class)
                        : '-';
                    return (
                        `${row.name.padEnd(20)}| ` +
                        `${String(row.class ?? '-').padEnd(14)}| ` +
                        `${String(row.spec ?? '-').padEnd(15)}| ` +
                        `${String(roleName ?? '-').padEnd(14)}| ` +
                        `${row.is_main ? 'YES' : ''}`
                    );
                });
                const table = [header, separator, ...lines].join('\n');
                interaction.reply(`\`\`\`${table}\`\`\``);
            } catch (err) {
                console.error(err);
                return interaction.reply('Database error.');
            }
        }

        else if (subcommand === 'setmain') {
            const character = interaction.options.getString('character');
            try {
                const row = await db.getCharacterRowByName(character);
                if (!row || row.discord_id !== discordId) {
                    return interaction.reply('You must claim this character first.');
                }
                await db.unsetMainForUser(discordId);
                await db.setMainCharacter(row.id);
                await assignAllMainRoles(guild, member, character);
                return interaction.reply(`${character} is now your main. Roles updated.`);
            } catch (err) {
                console.error(err);
                return interaction.reply('Database error.');
            }
        }

    },

    async autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused();

        if (subcommand === 'claim') {
            // Suggest unclaimed or unowned characters
            db.all(
                `SELECT name FROM guild_members WHERE (discord_id IS NULL OR discord_id = '') AND name LIKE ? ORDER BY name LIMIT 25`,
                [`%${focused}%`],
                (err, rows) => {
                    if (err) {
                        console.error(err);
                        return interaction.respond([]);
                    }
                    const choices = rows.map(row => ({
                        name: row.name,
                        value: row.name
                    }));
                    interaction.respond(choices);
                }
            );
        }

        else if (subcommand === 'unclaim') {
            const discordId = interaction.user.id;
            db.all(
                `SELECT name FROM guild_members WHERE discord_id = ? AND name LIKE ? ORDER BY name LIMIT 25`,
                [discordId, `%${focused}%`],
                (err, rows) => {
                    if (err) {
                        console.error(err);
                        return interaction.respond([]);
                    }
                    const choices = rows.map(row => ({
                        name: row.name,
                        value: row.name
                    }));
                    interaction.respond(choices);
                }
            );
        }
        else if (subcommand === 'setmain') {
            // Suggest characters claimed by this user
            const discordId = interaction.user.id;
            newFunction(discordId, focused, interaction);
        }

        else {
            interaction.respond([]);
        }
    }

};

function newFunction(discordId, focused, interaction) {
    db.all(
        `SELECT name FROM guild_members WHERE discord_id = ? AND name LIKE ? ORDER BY name LIMIT 25`,
        [discordId, `%${focused}%`],
        (err, rows) => {
            if (err) {
                console.error(err);
                return interaction.respond([]);
            }
            const choices = rows.map(row => ({
                name: row.name,
                value: row.name
            }));
            interaction.respond(choices);
        }
    );
}
