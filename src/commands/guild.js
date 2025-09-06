const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');
const { MAIN_ROLES } = require('../constants/roles');
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
            .addStringOption(opt => opt.setName('profession').setDescription('Profession name').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('role')
            .setDescription('List all characters with the supplied main role (Tank/Healer/etc)')
            .addStringOption(opt => opt.setName('role').setDescription('Main role').setRequired(true).addChoices(...MAIN_ROLES.map(r => ({ name: r, value: r }))))
        )
        .addSubcommand(sub => sub
            .setName('class')
            .setDescription('List all characters of a given class')
            .addStringOption(opt => opt.setName('class').setDescription('Class name').setRequired(true))
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
                const profession = interaction.options.getString('profession');
                db.getCharactersByProfession(profession, async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    if (!rows.length) return await safeEditReply(interaction, `No characters found with profession "${profession}".`);
                    const discordNames = await resolveDiscordNames(guild, rows);
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
                    await safeEditReply(interaction, { content: pages[pageIdx], components: totalPages > 1 ? componentsFor('guild', true, totalPages <= 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                            await require('../utils/interaction').safeComponentUpdate(i, replyMsg, { content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                        });
                        collector.on('end', async () => {
                            try { await replyMsg.edit({ content: pages[pageIdx], components: [] }); } catch { }
                        });
                    }
                });

            } else if (sub === 'role') {
                const role = interaction.options.getString('role');
                db.getCharactersByRole(role, async (err, rows) => {
                    if (err) {
                        debug.error(err);
                        return await safeEditReply(interaction, 'Database error.');
                    }
                    if (!rows.length) return await safeEditReply(interaction, `No characters found with role "${role}".`);
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
                    await safeEditReply(interaction, { content: pages[pageIdx], components: totalPages > 1 ? componentsFor('guild', true, totalPages <= 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                            try {
                                await i.update({ content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                            } catch (err) {
                                debug.error('guild collector i.update failed, falling back to deferUpdate+edit:', err);
                                try { await i.deferUpdate(); await replyMsg.edit({ content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) }); } catch (e) { debug.error('guild fallback edit failed:', e); }
                            }
                        });
                        collector.on('end', async () => {
                            try { await replyMsg.edit({ content: pages[pageIdx], components: [] }); } catch { }
                        });
                    }
                });

            } else if (sub === 'class') {
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
                    await safeEditReply(interaction, { content: pages[pageIdx], components: totalPages > 1 ? componentsFor('guild', true, totalPages <= 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                            try {
                                await i.update({ content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                            } catch (err) {
                                debug.error('guild collector i.update failed, falling back to deferUpdate+edit:', err);
                                try { await i.deferUpdate(); await replyMsg.edit({ content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) }); } catch (e) { debug.error('guild fallback edit failed:', e); }
                            }
                        });
                        collector.on('end', async () => {
                            try { await replyMsg.edit({ content: pages[pageIdx], components: [] }); } catch { }
                        });
                    }
                });

            } else if (sub === 'claimed') {
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
                                    // Send as a single code-block reply using safeEditReply (ensures fallback to followUp)
                                    try {
                                        await safeEditReply(interaction, { content: `\`\`\`${table}\`\`\`` });
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
                    await safeEditReply(interaction, { content: pages[pageIdx], components: totalPages > 1 ? componentsFor('guild', true, totalPages <= 1) : [] });
                    const replyMsg = await interaction.fetchReply();
                    if (totalPages > 1) {
                        const filter = i => i.user.id === interaction.user.id && (i.customId === 'guild_next' || i.customId === 'guild_prev');
                        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });
                        collector.on('collect', async i => {
                            if (i.customId === 'guild_next' && pageIdx < totalPages - 1) pageIdx++;
                            else if (i.customId === 'guild_prev' && pageIdx > 0) pageIdx--;
                            try {
                                await i.update({ content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) });
                            } catch (err) {
                                debug.error('guild collector i.update failed, falling back to deferUpdate+edit:', err);
                                try { await i.deferUpdate(); await replyMsg.edit({ content: pages[pageIdx], components: componentsFor('guild', pageIdx === 0, pageIdx === totalPages - 1) }); } catch (e) { debug.error('guild fallback edit failed:', e); }
                            }
                        });
                        collector.on('end', async () => {
                            try { await replyMsg.edit({ content: pages[pageIdx], components: [] }); } catch { }
                        });
                    }
                });
            }
        } catch (err) {
            debug.error('Unhandled error in /guild:', err);
            return await safeEditReply(interaction, 'An unexpected error occurred while processing your request.');
        }
    }
};

// (safeEditReply provided by src/utils/interaction.js)