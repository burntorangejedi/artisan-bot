const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../data/platform/sqlite/db_sqlite');
const debug = require('../data/debug');
const { safeEditReply } = require('../utils/interaction');
const { paginateTable, componentsFor } = require('../utils/pagination');


const settings = require('../settings');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('whohas')
    .setDescription('Find guild members who can craft a specific recipe')
    .addStringOption(opt =>
      opt.setName('recipe')
        .setDescription('Recipe name or Item ID (partial match allowed)')
        .setRequired(true)
    ),
  async execute(interaction) {
  try { await interaction.deferReply(); } catch (e) { }
    const recipeInput = interaction.options.getString('recipe');
    const isItemId = /^\d+$/.test(recipeInput.trim());
    const searchFn = isItemId ? db.searchCraftersByItemId : db.searchCraftersByRecipeName;
    const searchType = isItemId ? 'Item ID' : 'name';
    const searchArg = isItemId ? parseInt(recipeInput.trim(), 10) : recipeInput;

    try {
      const rows = await new Promise((resolve, reject) => {
        searchFn(searchArg, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });

      if (!rows || !rows.length) {
        const msg = searchType === 'Item ID'
          ? `No guild member can craft a recipe with Item ID "${recipeInput}".`
          : `No guild member can craft a recipe matching "${recipeInput}".`;
        try { return await interaction.editReply(msg); } catch (err) { debug.error('whohas reply failed:', err); try { return await interaction.followUp(msg); } catch (e) { return; } }
        return;
      }

      // Helper: resolve Discord display names
      async function resolveDiscordNames(rows) {
        const discordNames = {};
        for (const row of rows) {
          if (row.discord_id && !discordNames[row.discord_id]) {
            try {
              let displayName = '-';
              let username = '-';
              const guild = interaction.guild;
              if (guild) {
                const member = await guild.members.fetch(row.discord_id).catch(() => null);
                if (member) {
                  displayName = member.displayName;
                  username = member.user.username;
                } else {
                  const user = await interaction.client.users.fetch(row.discord_id);
                  if (user) {
                    displayName = user.username;
                    username = user.username;
                  }
                }
              } else {
                const user = await interaction.client.users.fetch(row.discord_id);
                if (user) {
                  displayName = user.username;
                  username = user.username;
                }
              }
              discordNames[row.discord_id] = displayName !== username ? `${displayName} (${username})` : displayName;
            } catch {
              discordNames[row.discord_id] = '-';
            }
          }
        }
        return discordNames;
      }

      // Use embed helper
      const { buildWhohasEmbedPage } = require('../embeds/whohasEmbed');

      const discordNames = await resolveDiscordNames(rows);
      const results = rows.map(row => ({
        ...row,
        discordName: row.discord_id ? discordNames[row.discord_id] : '-',
      })).sort((a, b) => a.member.localeCompare(b.member));

      // Decide output style: 'embed' or 'table' (default 'table' in settings)
      const outputStyle = (settings.WHOHAS_OUTPUT_STYLE || 'table').toLowerCase();

      let pageIdx = 0;
  const PAGE_SIZE = parseInt(settings.WHOHAS_PAGE_SIZE || '10', 10) || 10;
      const totalPages = Math.ceil(results.length / PAGE_SIZE);

      // Prepare common components (Previous / Next)
  // componentsFor is imported from utils/pagination and will use prefix 'whohas'

      if (outputStyle === 'embed') {
        // Existing embed flow — use safeEditReply because we deferred earlier
        const replyRes = await safeEditReply(interaction, {
          embeds: [buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput })],
          components: totalPages > 1 ? componentsFor('whohas', true, totalPages <= 1) : []
        });
        // replyRes may be the message object (from editReply) or undefined; fetchReply is a reliable way
        const replyMsg = await interaction.fetchReply();

        if (totalPages > 1) {
          const filter = i => i.user.id === interaction.user.id && (i.customId === 'whohas_next' || i.customId === 'whohas_prev');
          const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });

          collector.on('collect', async i => {
            if (i.customId === 'whohas_next' && pageIdx < totalPages - 1) pageIdx++;
            else if (i.customId === 'whohas_prev' && pageIdx > 0) pageIdx--;
            await require('../utils/interaction').safeComponentUpdate(i, replyMsg, {
              embeds: [buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput })],
              components: componentsFor('whohas', pageIdx === 0, pageIdx === totalPages - 1)
            });
          });

          collector.on('end', async () => {
            try {
              await replyMsg.edit({ embeds: [buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput })], components: [] });
            } catch { }
          });
        }
      } else {
        // Table/text output flow using paginateTable
        // Columns: Character (18) | Profession (15) | Skill (5) | Discord (18) | Recipe (30)
        const COL = { char: 18, prof: 15, skill: 5, discord: 18, recipe: 30 };
        const hdrCols = [
          'Character'.padEnd(COL.char).slice(0, COL.char),
          'Profession'.padEnd(COL.prof).slice(0, COL.prof),
          'Skill'.padEnd(COL.skill).slice(0, COL.skill),
          'Discord'.padEnd(COL.discord).slice(0, COL.discord),
          'Recipe'.padEnd(COL.recipe).slice(0, COL.recipe)
        ];
        const header = hdrCols.join(' | ');
        const separator = [
          '-'.repeat(COL.char),
          '-'.repeat(COL.prof),
          '-'.repeat(COL.skill),
          '-'.repeat(COL.discord),
          '-'.repeat(COL.recipe)
        ].join('-+-');

        const lines = results.map(r => {
          const charName = (r.member || '-').padEnd(COL.char).slice(0, COL.char);
          const prof = (r.profession || '-').padEnd(COL.prof).slice(0, COL.prof);
          const skill = (r.max_skill_level ? String(r.max_skill_level) : '-').padEnd(COL.skill).slice(0, COL.skill);
          const discord = (r.discordName || '-').padEnd(COL.discord).slice(0, COL.discord);
          const recipe = (r.recipe_name || '-').padEnd(COL.recipe).slice(0, COL.recipe);
          return `${charName} | ${prof} | ${skill} | ${discord} | ${recipe}`;
        });
        const pages = paginateTable(header, lines, PAGE_SIZE);

  try { await interaction.editReply({ content: pages[pageIdx], components: totalPages > 1 ? componentsFor('whohas', true, totalPages <= 1) : [] }); } catch (err) { debug.error('whohas initial editReply failed:', err); try { await interaction.followUp({ content: pages[pageIdx], components: totalPages > 1 ? componentsFor('whohas', true, totalPages <= 1) : [] }); } catch (e) { } }
  const replyMsg = await interaction.fetchReply();

        if (totalPages > 1) {
          const filter = i => i.user.id === interaction.user.id && (i.customId === 'whohas_next' || i.customId === 'whohas_prev');
          const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });

          collector.on('collect', async i => {
            if (i.customId === 'whohas_next' && pageIdx < totalPages - 1) pageIdx++;
            else if (i.customId === 'whohas_prev' && pageIdx > 0) pageIdx--;
            await require('../utils/interaction').safeComponentUpdate(i, replyMsg, { content: pages[pageIdx], components: componentsFor('whohas', pageIdx === 0, pageIdx === totalPages - 1) });
          });

          collector.on('end', async () => {
            try {
              await replyMsg.edit({ content: pages[pageIdx], components: [] });
            } catch { }
          });
        }
      }
    } catch (err) {
      debug.error('Unhandled error in /whohas:', err);
      return await safeEditReply(interaction, 'An unexpected error occurred while searching for crafters.');
    }
  }
};

// (safeEditReply provided by src/utils/interaction.js)