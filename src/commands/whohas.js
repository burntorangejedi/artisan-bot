const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../data/platform/sqlite/db_sqlite');


const settings = require('../settings');


function paginateTable(header, lines, pageSize) {
  const pages = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    const pageLines = lines.slice(i, i + pageSize);
    const page = header + '\n```' + pageLines.join('\n') + '```';
    pages.push(page);
  }
  return pages;
}
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
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(msg);
        } else {
          await interaction.followUp(msg);
        }
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

      let pageIdx = 0;
      const PAGE_SIZE = 5;
      const totalPages = Math.ceil(results.length / PAGE_SIZE);

      await interaction.reply({
        embeds: [buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput })],
        components: totalPages > 1 ? [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: 'Previous',
                custom_id: 'whohas_embed_prev',
                disabled: pageIdx === 0
              },
              {
                type: 2,
                style: 1,
                label: 'Next',
                custom_id: 'whohas_embed_next',
                disabled: pageIdx === totalPages - 1
              }
            ]
          }
        ] : []
      });
      const replyMsg = await interaction.fetchReply();

      if (totalPages > 1) {
        const filter = i =>
          i.user.id === interaction.user.id &&
          (i.customId === 'whohas_embed_next' || i.customId === 'whohas_embed_prev');
        const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          if (i.customId === 'whohas_embed_next' && pageIdx < totalPages - 1) {
            pageIdx++;
          } else if (i.customId === 'whohas_embed_prev' && pageIdx > 0) {
            pageIdx--;
          }
          await i.update({
            embeds: [buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput })],
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: 'Previous',
                    custom_id: 'whohas_embed_prev',
                    disabled: pageIdx === 0
                  },
                  {
                    type: 2,
                    style: 1,
                    label: 'Next',
                    custom_id: 'whohas_embed_next',
                    disabled: pageIdx === totalPages - 1
                  }
                ]
              }
            ]
          });
        });

        collector.on('end', async () => {
          // Disable buttons after timeout
          try {
            await replyMsg.edit({ embeds: [buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput })], components: [] });
          } catch {}
        });
      }
    } catch (err) {
      console.error('Unhandled error in /whohas:', err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply('An unexpected error occurred while searching for crafters.');
      } else {
        return interaction.followUp('An unexpected error occurred while searching for crafters.');
      }
    }
  }
};