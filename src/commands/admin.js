const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');
const settings = require('../settings');
const { isBusy, setBusy } = require('../data/botState');
const { getBlizzardAccessToken, getGuildRoster, getCharacterSummary, getCharacterProfessions } = require('../blizzard/api');
const { safeEditReply } = require('../utils/interaction');

// WoW class colors (hex)
const CLASS_COLORS = {
    'Druid': 0xFF7D0A,
    'Paladin': 0xF58CBA,
    'Priest': 0xFFFFFF,
    'Rogue': 0xFFF569,
    'Shaman': 0x0070DE,
    'Warlock': 0x8787ED,
    'Warrior': 0xC79C6E,
    'Hunter': 0xABD473,
    'Mage': 0x40C7EB,
    'Death Knight': 0xC41F3B,
    'Monk': 0x00FF96,
    'Demon Hunter': 0xA330C9,
    'Evoker': 0x33937F
};

const MAIN_ROLE_COLORS = {
    'Tank': 0x3B5998,
    'Healer': 0x43B581,
    'Ranged DPS': 0x7289DA,
    'Melee DPS': 0xFAA61A
};

const PROFESSION_COLORS = {
    'Alchemy': 0x4B0082,
    'Blacksmithing': 0x808080,
    'Enchanting': 0x4169E1,
    'Engineering': 0xFFD700,
    'Herbalism': 0x228B22,
    'Inscription': 0x8B4513,
    'Jewelcrafting': 0xE0115F,
    'Leatherworking': 0xA0522D,
    'Mining': 0xB87333,
    'Skinning': 0xDEB887,
    'Tailoring': 0x4682B4
};

const MAIN_ROLES = ['Tank', 'Healer', 'Ranged DPS', 'Melee DPS'];

const SPEC_CLASS_ROLES = [
    'Restoration Druid', 'Balance Druid', 'Feral Druid', 'Guardian Druid',
    'Holy Paladin', 'Protection Paladin', 'Retribution Paladin',
    'Discipline Priest', 'Holy Priest', 'Shadow Priest',
    'Assassination Rogue', 'Outlaw Rogue', 'Subtlety Rogue',
    'Elemental Shaman', 'Enhancement Shaman', 'Restoration Shaman',
    'Affliction Warlock', 'Demonology Warlock', 'Destruction Warlock',
    'Arms Warrior', 'Fury Warrior', 'Protection Warrior',
    'Beast Mastery Hunter', 'Marksmanship Hunter', 'Survival Hunter',
    'Arcane Mage', 'Fire Mage', 'Frost Mage',
    'Blood Death Knight', 'Frost Death Knight', 'Unholy Death Knight',
    'Brewmaster Monk', 'Mistweaver Monk', 'Windwalker Monk',
    'Havoc Demon Hunter', 'Vengeance Demon Hunter',
    'Devastation Evoker', 'Preservation Evoker', 'Augmentation Evoker'
];

const PROFESSION_ROLES = Object.keys(PROFESSION_COLORS);

function getClassFromSpecClass(specClass) {
    return specClass.split(' ').slice(-1)[0];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync')
                .setDescription('Sync or refresh guild data from Blizzard API')
        )
        .addSubcommand(sub =>
            sub.setName('add-roles')
                .setDescription('Create all class/spec, main, and profession roles')
        )
        .addSubcommand(sub =>
            sub.setName('remove-roles')
                .setDescription('Remove all class/spec, main, and profession roles')
        )
        .addSubcommand(sub =>
            sub.setName('import-grm')
                .setDescription('Import Guild Roster Manager (GRM) SavedVariables file')
                .addAttachmentOption(option =>
                    option.setName('file')
                        .setDescription('Guild_Roster_Manager.lua file exported from WoW')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (subcommand === 'sync') {
            if (await isBusy()) {
                return interaction.reply({ content: 'A sync is already in progress. Please wait until it completes.', flags: 64 });
            }
            setBusy(true);
            try {
                debug.log('admin sync: command started');
                await interaction.deferReply();

                const accessToken = await getBlizzardAccessToken();
                debug.log('admin sync: Access token ' + accessToken);
                const members = await getGuildRoster(accessToken);
                debug.log('admin sync: Fetched members count:', members.length);

                // Gather all current guild character names and realms
                const currentNamesRealms = members.map(m => ({
                    name: m.character.name,
                    realm: m.character.realm.slug
                }));

                let imported = 0;
                // Totals to report
                let totals = { addedMembers: 0, updatedMembers: 0, addedRecipes: 0, removedRecipes: 0 };
                // Send initial reply and capture the message object so we can edit it later without using the interaction callback (avoids token expiry issues)
                let replyMsg = null;
                try {
                    await interaction.editReply(`Starting sync of ${members.length} characters. The more characters you have, the longer it can take. Please be patient while we crank through your imense guild..`);
                    try { replyMsg = await interaction.fetchReply(); } catch (e) { debug.log('fetchReply failed after initial editReply:', e.message || e); replyMsg = null; }
                } catch (err) {
                    debug.log('editReply failed (likely expired interaction):', err.message || err);
                }

                // Batch processing with concurrency limit
                const BATCH_SIZE = settings.SYNC_BATCH_SIZE;
                for (let i = 0; i < members.length; i += BATCH_SIZE) {
                    const batch = members.slice(i, i + BATCH_SIZE);
                    const results = await Promise.allSettled(batch.map(async (m) => {
                        const charName = m.character.name;
                        const realmSlug = m.character.realm.slug;
                        // Fetch summary and professions for this character
                        const summary = await getCharacterSummary(realmSlug, charName, accessToken);
                        const professions = await getCharacterProfessions(realmSlug, charName, accessToken);
                        return await db.syncGuildMember({ character: m.character, summary, professions, accessToken });
                    }));
                    // Aggregate results
                    for (const r of results) {
                        if (r.status === 'fulfilled' && r.value) {
                            totals.addedMembers += r.value.addedMembers || 0;
                            totals.updatedMembers += r.value.updatedMembers || 0;
                            totals.addedRecipes += r.value.addedRecipes || 0;
                            totals.removedRecipes += r.value.removedRecipes || 0;
                        } else if (r.status === 'rejected') {
                            debug.error('Error syncing member in batch:', r.reason);
                        }
                    }
                    imported += batch.length;
                    try {
                        if (replyMsg) {
                            await replyMsg.edit(`Syncing... (${imported}/${members.length} characters processed)`);
                        } else {
                            await safeEditReply(interaction, `Syncing... (${imported}/${members.length} characters processed)`);
                        }
                    } catch (err) {
                        debug.log('progress update failed (likely expired interaction):', err.message || err);
                    }
                }

                // Delete departed members and capture deletion counts
                let departedStats = { deletedMembers: 0, deletedCharacterRecipes: 0 };
                try {
                    departedStats = await db.deleteDepartedMembers(currentNamesRealms);
                } catch (e) {
                    debug.log('Error deleting departed members:', e);
                }

                // Clean up character_recipes that reference non-existent members or recipes
                await db.cleanupOrphanedCharacterRecipes();

                debug.log(`admin sync: Command finished! Imported ${imported} members.`);
                try {
                    const totalChanges = totals.addedMembers + totals.updatedMembers + totals.addedRecipes + totals.removedRecipes + (departedStats.deletedMembers || 0) + (departedStats.deletedCharacterRecipes || 0);
                    const finalMsg = `Guild roster sync complete!
Members processed: ${members.length}
Member additions: ${totals.addedMembers}
Member updates: ${totals.updatedMembers}
Recipe additions: ${totals.addedRecipes}
Recipe deletions: ${totals.removedRecipes}
Departed members removed: ${departedStats.deletedMembers || 0}
Character-recipe rows removed for departed members: ${departedStats.deletedCharacterRecipes || 0}
Total changes (approx): ${totalChanges}`;
                    if (replyMsg) await replyMsg.edit(finalMsg);
                    else await safeEditReply(interaction, finalMsg);
                } catch (err) {
                    debug.log('final edit failed (likely expired interaction):', err.message || err);
                }
            } catch (err) {
                debug.error('DB error: ', err);
                try {
                    if (replyMsg) await replyMsg.edit('Failed to fetch guild roster or professions from Blizzard API.');
                    else await safeEditReply(interaction, 'Failed to fetch guild roster or professions from Blizzard API.');
                } catch (err2) {
                    debug.log('error reporting failed (likely expired interaction):', err2.message || err2);
                }
            } finally {
                setBusy(false);
            }
        } else if (subcommand === 'add-roles') {
            await interaction.deferReply();
            let created = [];
            // Create spec/class roles
            for (const roleName of SPEC_CLASS_ROLES) {
                let role = guild.roles.cache.find(r => r.name === roleName);
                if (!role) {
                    const className = getClassFromSpecClass(roleName);
                    const color = CLASS_COLORS[className] || 0x888888;
                    try {
                        await guild.roles.create({ name: roleName, color, reason: 'Class/Spec role setup' });
                        created.push(roleName);
                    } catch (e) { }
                }
            }
            // Create main roles
            for (const roleName of MAIN_ROLES) {
                let role = guild.roles.cache.find(r => r.name === roleName);
                if (!role) {
                    const color = MAIN_ROLE_COLORS[roleName] || 0x888888;
                    try {
                        await guild.roles.create({ name: roleName, color, reason: 'Main role setup' });
                        created.push(roleName);
                    } catch (e) { }
                }
            }
            // Create profession roles
            for (const roleName of PROFESSION_ROLES) {
                let role = guild.roles.cache.find(r => r.name === roleName);
                if (!role) {
                    const color = PROFESSION_COLORS[roleName] || 0x888888;
                    try {
                        await guild.roles.create({ name: roleName, color, reason: 'Profession role setup' });
                        created.push(roleName);
                    } catch (e) { }
                }
            }
            await interaction.editReply(`Created roles: ${created.length ? created.join(', ') : 'None (all already exist)'}`);
        } else if (subcommand === 'remove-roles') {
            await interaction.deferReply();
            let removed = [];
            for (const roleName of [...SPEC_CLASS_ROLES, ...MAIN_ROLES, ...PROFESSION_ROLES]) {
                let role = guild.roles.cache.find(r => r.name === roleName);
                if (role) {
                    try {
                        await role.delete('Class/Spec/Main/Profession role cleanup');
                        removed.push(roleName);
                    } catch (e) { }
                }
            }
            await interaction.editReply(`Removed roles: ${removed.length ? removed.join(', ') : 'None found'}`);
        } else if (subcommand === 'import-grm') {
            await interaction.deferReply({ ephemeral: true });
            const file = interaction.options.getAttachment('file');
            if (!file) {
                return interaction.editReply('No file uploaded. Please attach your Guild_Roster_Manager.lua file.');
            }
            // Download the file
            const axios = require('axios');
            try {
                const response = await axios.get(file.url);
                const luaData = response.data;
                // TODO: Parse luaData and import GRM data
                await interaction.editReply('GRM file received! (Parsing and import not yet implemented.)');
            } catch (err) {
                debug.error('Failed to download or process GRM file:', err.message || err);
                await interaction.editReply('Failed to download or process the GRM file.');
            }
        }
    }
};
