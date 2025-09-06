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
            // Ensure the bot can actually manage this role before attempting remove
            try {
                const botMember = guild.members.me;
                if (!botMember || (botMember.permissions && botMember.permissions.has && botMember.permissions.has('ManageRoles')) ) {
                    // also ensure bot's highest role is above the target role
                    if (!botMember || botMember.roles.highest.position > role.position) {
                        await member.roles.remove(role);
                    }
                }
            } catch (e) { }
        }
    }
}

// Remove all spec/class and main role roles
async function removeOldSpecClassAndMainRoles(guild, member) {
    // Remove main roles
    for (const roleName of MAIN_ROLES) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role && member.roles.cache.has(role.id)) {
            try {
                const botMember = guild.members.me;
                if (!botMember || (botMember.permissions && botMember.permissions.has && botMember.permissions.has('ManageRoles'))) {
                    if (!botMember || botMember.roles.highest.position > role.position) {
                        await member.roles.remove(role);
                    }
                }
            } catch (e) { }
        }
    }
    // Remove all known Spec+Class roles defined in SPEC_ROLE_MAP (safe - only known managed roles)
    for (const key of Object.keys(SPEC_ROLE_MAP)) {
        const roleName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role && member.roles.cache.has(role.id)) {
            try {
                const botMember = guild.members.me;
                if (!botMember || (botMember.permissions && botMember.permissions.has && botMember.permissions.has('ManageRoles'))) {
                    if (!botMember || botMember.roles.highest.position > role.position) {
                        await member.roles.remove(role);
                    }
                }
            } catch (e) { }
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
            // Interaction may take time (DB updates) — defer the reply
            try { await interaction.deferReply(); } catch (e) { }
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
                    try { return await interaction.editReply('Character not found in the guild database.'); } catch (e) { try { return await interaction.followUp('Character not found in the guild database.'); } catch (_) { return; } }
                }
                if (charRow.discord_id && charRow.discord_id !== discordId) {
                    try { return await interaction.editReply('Character already claimed by another user.'); } catch (e) { try { return await interaction.followUp('Character already claimed by another user.'); } catch (_) { return; } }
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
                try { return await interaction.editReply(msg); } catch (e) { try { return await interaction.followUp(msg); } catch (_) { return; } }
            } catch (err) {
                const debug = require('../data/debug');
                debug.error(err);
                try { return await interaction.editReply('Database error.'); } catch (e) { try { return await interaction.followUp('Database error.'); } catch (_) { return; } }
            }
        }

        else if (subcommand === 'unclaim') {
            try { await interaction.deferReply(); } catch (e) { }
            const character = interaction.options.getString('character');
            try {
                const row = await db.getCharacterRowForUnclaim(character);
                if (!row || row.discord_id !== discordId) {
                    try { return await interaction.editReply('You must claim this character first.'); } catch (e) { try { return await interaction.followUp('You must claim this character first.'); } catch (_) { return; } }
                }
                // If this was your main, unset is_main and remove roles
                if (row.is_main) {
                    await removeAllRelevantRoles(guild, member);
                }
                await db.unclaimCharacter(row.id);
                try { return await interaction.editReply(`✅ ${character} has been unclaimed.`); } catch (e) { try { return await interaction.followUp(`✅ ${character} has been unclaimed.`); } catch (_) { return; } }
            } catch (err) {
                const debug = require('../data/debug');
                debug.error(err);
                try { return await interaction.editReply('Database error.'); } catch (e) { try { return await interaction.followUp('Database error.'); } catch (_) { return; } }
            }
        }

        else if (subcommand === 'list') {
            try {
                await interaction.deferReply();
                const rows = await db.listClaimedCharacters(discordId);
                if (!rows.length) {
                    try { return await interaction.editReply('You have not claimed any characters.'); } catch (e) { try { return await interaction.followUp('You have not claimed any characters.'); } catch (_) { return; } }
                }
                // Use explicit column widths and consistent separators
                const COL = { name: 20, class: 14, spec: 15, role: 14, main: 4 };
                const hdr = [
                    'Character'.padEnd(COL.name),
                    'Class'.padEnd(COL.class),
                    'Spec'.padEnd(COL.spec),
                    'Role'.padEnd(COL.role),
                    'Main'.padEnd(COL.main)
                ].join(' | ');
                const sep = [
                    '-'.repeat(COL.name),
                    '-'.repeat(COL.class),
                    '-'.repeat(COL.spec),
                    '-'.repeat(COL.role),
                    '-'.repeat(COL.main)
                ].join('-+-');
                const lines = rows.map(row => {
                    const roleName = (row.class && row.spec) ? getMainRoleForSpecClass(row.spec, row.class) : '-';
                    return [
                        String(row.name).padEnd(COL.name),
                        String(row.class ?? '-').padEnd(COL.class),
                        String(row.spec ?? '-').padEnd(COL.spec),
                        String(roleName ?? '-').padEnd(COL.role),
                        (row.is_main ? 'YES' : '').padEnd(COL.main)
                    ].join(' | ');
                });
                const table = [hdr, sep, ...lines].join('\n');
                try { return await interaction.editReply(`\`\`\`${table}\`\`\``); } catch (e) { try { return await interaction.followUp(`\`\`\`${table}\`\`\``); } catch (_) { return; } }
            } catch (err) {
                const debug = require('../data/debug');
                debug.error(err);
                try { return await interaction.editReply('Database error.'); } catch (e) { try { return await interaction.followUp('Database error.'); } catch (_) { return; } }
            }
        }

        else if (subcommand === 'setmain') {
            try { await interaction.deferReply(); } catch (e) { }
            const character = interaction.options.getString('character');
            try {
                const row = await db.getCharacterRowByName(character);
                if (!row || row.discord_id !== discordId) {
                    try { return await interaction.editReply('You must claim this character first.'); } catch (e) { try { return await interaction.followUp('You must claim this character first.'); } catch (_) { return; } }
                }
                await db.unsetMainForUser(discordId);
                await db.setMainCharacter(row.id);
                await assignAllMainRoles(guild, member, character);
                try { return await interaction.editReply(`${character} is now your main. Roles updated.`); } catch (e) { try { return await interaction.followUp(`${character} is now your main. Roles updated.`); } catch (_) { return; } }
            } catch (err) {
                const debug = require('../data/debug');
                debug.error(err);
                try { return await interaction.editReply('Database error.'); } catch (e) { try { return await interaction.followUp('Database error.'); } catch (_) { return; } }
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
                        const debug = require('../data/debug');
                        debug.error(err);
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
                        const debug = require('../data/debug');
                        debug.error(err);
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
                const debug = require('../data/debug');
                debug.error(err);
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
