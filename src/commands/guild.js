const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');
const { MAIN_ROLES, SPEC_ROLE_MAP, ALL_PROFESSIONS } = require('../constants/roles');
const { safeEditReply } = require('../utils/interaction');
const settings = require('../settings');

// Helper: resolve discord id -> display name (guild displayName or user.tag)
async function resolveDiscordNames(guild, rows) {
    const discordNames = {};
    const ids = [...new Set(rows.map(r => r.discord_id).filter(Boolean))];
    for (const id of ids) {
        try {
            let name = '-';
            if (guild) {
                const member = await guild.members.fetch(id).catch(() => null);
                if (member) name = member.displayName;
                else {
                    const user = await guild.client.users.fetch(id).catch(() => null);
                    if (user) name = user.tag;
                }
            } else {
                const user = await (globalThis.client ? globalThis.client.users.fetch(id) : null).catch(() => null);
                if (user) name = user.tag;
            }
            discordNames[id] = name;
        } catch (e) {
            discordNames[id] = '-';
        }
    }
    return discordNames;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('Guild-wide listing helpers')
        .addSubcommand(sub => sub
            .setName('profession')
            .setDescription('List all characters with the supplied profession')
            .addStringOption(opt => opt.setName('profession').setDescription('Profession name').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub => sub
            .setName('role')
            .setDescription('List all characters with the supplied main role (Tank/Healer/etc)')
            .addStringOption(opt => opt.setName('role').setDescription('Main role (Tank/Healer/Melee DPS/Ranged DPS)').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub => sub
            .setName('class')
            .setDescription('List all characters of a given class')
            .addStringOption(opt => opt.setName('class').setDescription('Class name').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub => sub
            .setName('claimed')
            .setDescription('List all claimed characters with owner, class & spec')
            .addBooleanOption(opt => opt.setName('mains_only').setDescription('Return mains only'))
        )
        .addSubcommand(sub => sub
            .setName('unclaimed')
            .setDescription('List all unclaimed characters with class & spec')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        try {
            // Defer early for potentially long-running DB queries to avoid interaction expiry
            try { await interaction.deferReply(); } catch (e) { }
            const { paginateTable, componentsFor } = require('../utils/pagination');
            const PAGE_SIZE = parseInt(settings.WHOHAS_PAGE_SIZE || '10', 10) || 10;
            if (sub === 'profession') {
                debug.verbose('Here in /guild profession');
                const profession = interaction.options.getString('profession');
                db.getCharactersByProfession(profession, async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    if (!rows.length) return await safeEditReply(interaction, `No characters found with profession "${profession}".`);
                    const discordNames = await resolveDiscordNames(guild, rows);
                    const messagePrefix = `Found ${rows.length} characters for profession "${profession}".` + '\n\n';
                    const header = `Character           | Class         | Spec           | Role          | Owner`;
                    const separator = `--------------------|---------------|----------------|---------------|----------------`;
                    const lines = rows.map(r => (
                        `${String(r.name).padEnd(20)}| ` +
                        `${String(r.class ?? '-').padEnd(14)}| ` +
                        `${String(r.spec ?? '-').padEnd(15)}| ` +
                        `${String(r.role ?? '-').padEnd(14)}| ` +
                        `${String(discordNames[r.discord_id] ?? '-').padEnd(16)}`
                    ));
                    const pages = paginateTable([header, separator].join('\n'), lines, PAGE_SIZE);
                    let pageIdx = 0;
                    const totalPages = pages.length;
                    // Ensure the prefix appears inside the code block so it is visible in the message
                    const pageBody = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                    await safeEditReply(interaction, { content: '```' + messagePrefix + pageBody + '```', components: totalPages > 1 ? componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                            const pageBody2 = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                            await require('../utils/interaction').safeComponentUpdate(i, replyMsg, { content: '```' + messagePrefix + pageBody2 + '```', components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                        });
                        collector.on('end', async () => {
                            try { const pageBody3 = pages[pageIdx].replace(/^```/, '').replace(/```$/, ''); await replyMsg.edit({ content: '```' + messagePrefix + pageBody3 + '```', components: [] }); } catch { }
                        });
                    }
                });

            } else if (sub === 'role') {
                debug.verbose('Here in /guild role');
                let role = interaction.options.getString('role') || '';
                role = String(role).trim();
                debug.log(`/guild role invoked: role='${role}'`);
                db.getCharactersByRole(role, async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    debug.log(`/guild role: DB returned rows=${rows ? rows.length : 0}`);
                    if (!rows || !rows.length) return await safeEditReply(interaction, `No characters found with role "${role}".`);
                    const discordNames = await resolveDiscordNames(guild, rows);
                    // Include the original role query in results so users remember what was searched
                    const header = `Character           | Class         | Spec           | Role Name     | Owner`;
                    const separator = `--------------------|---------------|----------------|---------------|----------------`;
                    const lines = rows.map(r => (
                        `${String(r.name).padEnd(20)}| ` +
                        `${String(r.class ?? '-').padEnd(14)}| ` +
                        `${String(r.spec ?? '-').padEnd(15)}| ` +
                        `${String(role ?? '-').padEnd(14)}| ` +
                        `${String(discordNames[r.discord_id] ?? '-').padEnd(16)}`
                    ));
                    const pages = paginateTable([header, separator].join('\n'), lines, PAGE_SIZE);
                    let pageIdx = 0;
                    const totalPages = pages.length;
                    const messagePrefix = `Found ${rows.length} characters with role "${role}".` + '\n\n';
                    const pageBodyProf = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                    await safeEditReply(interaction, { content: '```' + messagePrefix + pageBodyProf + '```', components: totalPages > 1 ? componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                            const pageBodyProf2 = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                            await require('../utils/interaction').safeComponentUpdate(i, replyMsg, { content: '```' + messagePrefix + pageBodyProf2 + '```', components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                        });
                        collector.on('end', async () => {
                            try { const pageBodyProf3 = pages[pageIdx].replace(/^```/, '').replace(/```$/, ''); await replyMsg.edit({ content: '```' + messagePrefix + pageBodyProf3 + '```', components: [] }); } catch { }
                        });
                    }
                });

            } else if (sub === 'class') {
                debug.verbose('Here in /guild class');
                const clazz = interaction.options.getString('class');
                db.getCharactersByClass(clazz, async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    if (!rows.length) return await safeEditReply(interaction, `No characters found for class "${clazz}".`);
                    const discordNames = await resolveDiscordNames(guild, rows);
                    const header = `Character           | Class         | Spec           | Owner`;
                    const separator = `--------------------|---------------|----------------|----------------`;
                    const lines = rows.map(r => (
                        `${String(r.name).padEnd(20)}| ` +
                        `${String(r.class ?? '-').padEnd(14)}| ` +
                        `${String(r.spec ?? '-').padEnd(15)}| ` +
                        `${String(discordNames[r.discord_id] ?? '-').padEnd(16)}`
                    ));
            const pages = paginateTable([header, separator].join('\n'), lines, PAGE_SIZE);
            let pageIdx = 0;
            const totalPages = pages.length;
            const messagePrefix = `Found ${rows.length} characters for class "${clazz}".` + '\n\n';
            const pageBody = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
            await safeEditReply(interaction, { content: '```' + messagePrefix + pageBody + '```', components: totalPages > 1 ? componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                const pageBody2 = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                await require('../utils/interaction').safeComponentUpdate(i, replyMsg, { content: '```' + messagePrefix + pageBody2 + '```', components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                        });
                        collector.on('end', async () => {
                try { const pageBody3 = pages[pageIdx].replace(/^```/, '').replace(/```$/, ''); await replyMsg.edit({ content: '```' + messagePrefix + pageBody3 + '```', components: [] }); } catch { }
                        });
                    }
                });

            } else if (sub === 'claimed') {
                debug.verbose('Here in /guild claimed');
                const mainsOnly = interaction.options.getBoolean('mains_only');
                db.getClaimedCharacters(mainsOnly, async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    if (!rows.length) return await safeEditReply(interaction, 'No claimed characters found.');
                    const discordNames = await resolveDiscordNames(guild, rows);
                    const header = `Character           | Class         | Spec           | Main | Owner`;
                    const separator = `--------------------|---------------|----------------|------|----------------`;
                    const lines = rows.map(r => (
                        `${String(r.name).padEnd(20)}| ` +
                        `${String(r.class ?? '-').padEnd(14)}| ` +
                        `${String(r.spec ?? '-').padEnd(15)}| ` +
                        `${r.is_main ? 'YES '.padEnd(5) : '    '.padEnd(5)}| ` +
                        `${String(discordNames[r.discord_id] ?? '-').padEnd(16)}`
                    ));
                    const table = [header, separator, ...lines].join('\n');
                    const messagePrefix = `Found ${rows.length} claimed characters${mainsOnly ? ' (mains only)' : ''}.` + '\n\n';
                    // Send as a single code-block reply using safeEditReply (ensures fallback to followUp)
                    try {
                        await safeEditReply(interaction, { content: '```' + messagePrefix + table + '```' });
                        return;
                    } catch (err) {
                        debug.error('Failed to reply in /guild claimed handler:', err);
                        try { await interaction.followUp({ content: 'Failed to deliver result. The interaction may have expired.' }); } catch (e) { }
                        return;
                    }
                });

            } else if (sub === 'unclaimed') {
                db.getUnclaimedCharacters(async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    if (!rows.length) return await safeEditReply(interaction, 'No unclaimed characters found.');
                    const header = `Character           | Class         | Spec`;
                    const separator = `--------------------|---------------|----------------`;
                    const lines = rows.map(r => (
                        `${String(r.name).padEnd(20)}| ` +
                        `${String(r.class ?? '-').padEnd(14)}| ` +
                        `${String(r.spec ?? '-').padEnd(15)}`
                    ));
                    const pages = paginateTable([header, separator].join('\n'), lines, PAGE_SIZE);
                    let pageIdx = 0;
                    const totalPages = pages.length;
                const messagePrefix = `Found ${rows.length} unclaimed characters.` + '\n\n';
                const pageBody = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                await safeEditReply(interaction, { content: '```' + messagePrefix + pageBody + '```', components: totalPages > 1 ? componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                    const pageBody2 = pages[pageIdx].replace(/^```/, '').replace(/```$/, '');
                    await require('../utils/interaction').safeComponentUpdate(i, replyMsg, { content: '```' + messagePrefix + pageBody2 + '```', components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                        });
                        collector.on('end', async () => {
                    try { const pageBody3 = pages[pageIdx].replace(/^```/, '').replace(/```$/, ''); await replyMsg.edit({ content: '```' + messagePrefix + pageBody3 + '```', components: [] }); } catch { }
                        });
                    }
                });
            }
        } catch (e999) {
            debug.error('Unhandled error in /guild:', e999);
            return await safeEditReply(interaction, 'An unexpected error occurred while processing your request.');
        }
    }
};

// (safeEditReply provided by src/utils/interaction.js)

// Autocomplete handler for the /guild command (provides class suggestions)
module.exports.autocomplete = async function (interaction) {
    try {
        const sub = interaction.options.getSubcommand(false);
        let focused = interaction.options.getFocused();
        // Try to get the focused option name (getFocused(true) returns an object { name, value })
        let focusedOptionName = null;
        try {
            const focusedObj = interaction.options.getFocused(true);
            if (focusedObj && typeof focusedObj === 'object') focusedOptionName = focusedObj.name;
        } catch (e) {
            // ignore - some discord.js versions throw when true is passed if not supported
        }
        debug.log && debug.log(`/guild autocomplete invoked: sub=${sub}, focused=${focused}, focusedOption=${focusedOptionName}`);

        // Use the focused option name when available, otherwise fall back to subcommand
        const target = focusedOptionName || sub;

        // Handle profession autocomplete
        if (target === 'profession') {
            const filtered = ALL_PROFESSIONS.filter(p => p.toLowerCase().includes(String(focused || '').toLowerCase())).slice(0, 25);
            const choices = filtered.map(p => ({ name: p, value: p }));
            try {
                return await interaction.respond(choices);
            } catch (err) {
                if (err && (err.code === 40060 || String(err.message || '').toLowerCase().includes('already been acknowledged') || String(err.message || '').toLowerCase().includes('already acknowledged'))) {
                    debug.warn('Autocomplete respond (profession) failed because interaction was already acknowledged; skipping.');
                    return;
                }
                throw err;
            }
        }

        // Handle role autocomplete
        if (target === 'role') {
            const filtered = MAIN_ROLES.filter(r => r.toLowerCase().includes(String(focused || '').toLowerCase())).slice(0, 25);
            const choices = filtered.map(r => ({ name: r, value: r }));
            try {
                return await interaction.respond(choices);
            } catch (err) {
                if (err && (err.code === 40060 || String(err.message || '').toLowerCase().includes('already been acknowledged') || String(err.message || '').toLowerCase().includes('already acknowledged'))) {
                    debug.warn('Autocomplete respond (role) failed because interaction was already acknowledged; skipping.');
                    return;
                }
                throw err;
            }
        }

        // Class suggestions
        if (target === 'class') {
            // Use the hierarchical class -> specs file for class autocomplete so we suggest top-level class names
            const classSpecs = require('../constants/class_specs.json');
            const rawKeys = Object.keys(classSpecs);
            // Normalize keys to Title Case and sort
            const allClasses = rawKeys.map(k => k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).sort();
            debug.log && debug.log('/guild autocomplete class - rawKeys:', rawKeys);
            debug.log && debug.log('/guild autocomplete class - allClasses:', allClasses);
            const query = String(focused || '').toLowerCase();
            // Filter, normalize, and dedupe
            const seen = new Set();
            const filtered = [];
            for (const raw of allClasses) {
                const title = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                if (title.toLowerCase().includes(query) && !seen.has(title)) {
                    seen.add(title);
                    filtered.push(title);
                    if (filtered.length >= 25) break;
                }
            }
            const choices = filtered.map(c => ({ name: c, value: c }));
            try {
                return await interaction.respond(choices);
            } catch (err) {
                // If Discord says the interaction was already acknowledged, just log and don't attempt a second respond
                if (err && (err.code === 40060 || String(err.message || '').toLowerCase().includes('already been acknowledged') || String(err.message || '').toLowerCase().includes('already acknowledged'))) {
                    debug.warn('Autocomplete respond failed because interaction was already acknowledged; skipping second respond.');
                    return;
                }
                throw err;
            }
        }

        // Default: no suggestions - await and gracefully handle 'already acknowledged'
        try {
            return await interaction.respond([]);
        } catch (err) {
            if (err && (err.code === 40060 || String(err.message || '').toLowerCase().includes('already been acknowledged') || String(err.message || '').toLowerCase().includes('already acknowledged'))) {
                debug.warn('Autocomplete default respond failed because interaction was already acknowledged; skipping.');
                return;
            }
            throw err;
        }
    } catch (err) {
        const debug = require('../data/debug');
        debug.error('Error in /guild autocomplete:', err);
        try {
            return await interaction.respond([]);
        } catch (err2) {
            if (err2 && (err2.code === 40060 || String(err2.message || '').toLowerCase().includes('already been acknowledged') || String(err2.message || '').toLowerCase().includes('already acknowledged'))) {
                debug.warn('Autocomplete fallback respond failed because interaction was already acknowledged; skipping.');
                return;
            }
            return;
        }
    }
}