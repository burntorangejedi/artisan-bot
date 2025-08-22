const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../data/db');

const OUTPUT_STYLE = process.env.WHOHAS_OUTPUT_STYLE || 'table'; // 'table' or 'embed'
const DISCORD_LIMIT = process.env.DISCORD_LIMIT || 100;
const WHOHAS_PAGE_SIZE = parseInt(process.env.WHOHAS_PAGE_SIZE, 10) || 10;


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
    let query, params, searchType;

    if (/^\d+$/.test(recipeInput.trim())) {
      // Numeric input: search by item_id
      query = `
        SELECT gm.name AS member, p.name AS profession, cr.max_skill_level, r.recipe_name, gm.discord_id, r.id as recipe_id, gm.id as member_id
        FROM character_recipes cr
        JOIN recipes r ON cr.recipe_id = r.id
        JOIN professions p ON cr.profession_id = p.id
        JOIN guild_members gm ON cr.member_id = gm.id
        WHERE r.item_id = ?
      `;
      params = [parseInt(recipeInput.trim(), 10)];
      searchType = 'Item ID';
    } else {
      // Text input: search by recipe name
      query = `
        SELECT gm.name AS member, p.name AS profession, cr.max_skill_level, r.recipe_name, gm.discord_id, r.id as recipe_id, gm.id as member_id
        FROM character_recipes cr
        JOIN recipes r ON cr.recipe_id = r.id
        JOIN professions p ON cr.profession_id = p.id
        JOIN guild_members gm ON cr.member_id = gm.id
        WHERE r.recipe_name LIKE ?
      `;
      params = [`%${recipeInput}%`];
      searchType = 'name';
    }

    db.all(
      query,
      params,
      async (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply('Error searching for crafters.');
        }
        if (!rows.length) {
          return interaction.reply(
            searchType === 'Item ID'
              ? `No guild member can craft a recipe with Item ID "${recipeInput}".`
              : `No guild member can craft a recipe matching "${recipeInput}".`
          );
        }

        // Fetch Discord usernames for claimed characters
        const discordNames = {};
        for (const row of rows) {
          if (row.discord_id && !discordNames[row.discord_id]) {
            try {
              const user = await interaction.client.users.fetch(row.discord_id);
              discordNames[row.discord_id] = user ? user.username : '-';
            } catch {
              discordNames[row.discord_id] = '-';
            }
          }
        }

        // Prepare output, sorted by character name
        const results = rows.map(row => ({
          ...row,
          discordName: row.discord_id ? discordNames[row.discord_id] : '-',
        })).sort((a, b) => a.member.localeCompare(b.member));

        let headerLine = `Character           | Discord Name        | Profession     | Recipe                | Item ID`;
        let separatorLine = `--------------------|---------------------|----------------|-----------------------|---------`;

        const lines = results.map(row => {
          let itemIdStr = row.item_id ? `${row.item_id}` : '-';
          let wowhead = row.item_id ? `https://www.wowhead.com/item=${row.item_id}` : '';
          // Markdown hyperlink for Discord (not supported in code blocks, but show URL for copy)
          let itemIdDisplay = row.item_id ? `${row.item_id} (${wowhead})` : '-';
          return `${row.member.padEnd(20)}| ${row.discordName.padEnd(20)}| ${row.profession.padEnd(15)}| ${row.recipe_name.padEnd(22)}| ${itemIdDisplay}`;
        });

        const claimedMentions = results
          .filter(row => row.discord_id)
          .map(row => `<@${row.discord_id}>`);

        const header = `**Crafters for ${searchType === 'Item ID' ? `Item ID ${recipeInput}` : `"${recipeInput}"`}:**` +
          (claimedMentions.length
            ? `\nClaimed by: ${[...new Set(claimedMentions)].join(', ')}`
            : '');

        if (OUTPUT_STYLE === 'embed') {
          // Build fields for the embed (no quality)
          const fields = results.map(row => {
            let wowhead = row.item_id ? `https://www.wowhead.com/item=${row.item_id}` : null;
            let itemIdField = row.item_id ? `[${row.item_id}](${wowhead})` : '-';
            return {
              name: `${row.member} (${row.profession})`,
              value:
                `**Discord:** ${row.discord_id ? `<@${row.discord_id}>` : '-'}\n` +
                `**Recipe:** ${row.recipe_name}` +
                (row.item_id ? `\n**Item ID:** [${row.item_id}](${wowhead})` : ''),
              inline: true
            };
          });

          // If all results are for the same item, show a Wowhead link in the title
          let wowheadLink = results[0]?.item_id ? `https://www.wowhead.com/item=${results[0].item_id}` : null;
          const embed = new EmbedBuilder()
            .setTitle(`Crafters for ${searchType === 'Item ID' ? `Item ID ${recipeInput}` : `"${recipeInput}"`}`)
            .setColor(0x00AE86)
            .addFields(fields);
          if (wowheadLink) embed.setURL(wowheadLink);

          await interaction.reply({ embeds: [embed] });
        } else {
          // Monospaced table output (default) with interactive pagination
          const codeHeader = `${headerLine}\n${separatorLine}`;
          const pagedLines = [];
          for (let i = 0; i < lines.length; i += WHOHAS_PAGE_SIZE) {
            pagedLines.push([codeHeader, ...lines.slice(i, i + WHOHAS_PAGE_SIZE)]);
          }

          // Helper to build the page content
          function buildPage(pageIdx) {
            return {
              content: `${header}\n\nPage ${pageIdx + 1} of ${pagedLines.length}:\n\n\`\`\`${pagedLines[pageIdx].join('\n')}\`\`\``,
              components: [
                {
                  type: 1, // ActionRow
                  components: [
                    {
                      type: 2, // Button
                      style: 1, // Primary
                      label: 'Previous',
                      custom_id: 'whohas_prev',
                      disabled: pageIdx === 0
                    },
                    {
                      type: 2, // Button
                      style: 1, // Primary
                      label: 'Next',
                      custom_id: 'whohas_next',
                      disabled: pageIdx === pagedLines.length - 1
                    }
                  ]
                }
              ]
            };
          }

          let pageIdx = 0;
          await interaction.reply(buildPage(pageIdx));
          const replyMsg = await interaction.fetchReply();

          if (pagedLines.length > 1) {
            const filter = i =>
              i.user.id === interaction.user.id &&
              (i.customId === 'whohas_next' || i.customId === 'whohas_prev');
            const collector = replyMsg.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
              if (i.customId === 'whohas_next' && pageIdx < pagedLines.length - 1) {
                pageIdx++;
              } else if (i.customId === 'whohas_prev' && pageIdx > 0) {
                pageIdx--;
              }
              await i.update(buildPage(pageIdx));
            });

            collector.on('end', async () => {
              // Disable buttons after timeout
              try {
                await replyMsg.edit({ ...buildPage(pageIdx), components: [] });
              } catch {}
            });
          }
        }
      }
    )
  }
};