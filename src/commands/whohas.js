const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../data/db');
const OUTPUT_STYLE = process.env.WHOHAS_OUTPUT_STYLE || 'table'; // 'table' or 'embed'
const DISCORD_LIMIT = process.env.DISCORD_LIMIT || 100;

function splitMessage(header, lines) {
  const messages = [];
  let current = header + '\n```';
  for (const line of lines) {
    if ((current + line + '\n').length > DISCORD_LIMIT - 3) { // -3 for closing ```
      current += '```';
      messages.push(current.trim());
      current = '```';
    }
    current += line + '\n';
  }
  if (current.trim() !== '```') {
    current += '```';
    messages.push(current.trim());
  }
  return messages;
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

        // Prepare output without quality/breakpoints
        const results = rows.map(row => ({
          ...row,
          discordName: row.discord_id ? discordNames[row.discord_id] : '-',
        }));

        let headerLine = `Character           | Discord Name        | Profession     | MaxSkill| Recipe`;
        let separatorLine = `--------------------|---------------------|----------------|---------|---------------------`;

        const lines = results.map(row =>
          `${row.member.padEnd(20)}| ${row.discordName.padEnd(20)}| ${row.profession.padEnd(15)}| ${String(row.max_skill_level ?? 'unknown').padEnd(8)}| ${row.recipe_name}`
        );

        const claimedMentions = results
          .filter(row => row.discord_id)
          .map(row => `<@${row.discord_id}>`);

        const header = `**Crafters for ${searchType === 'Item ID' ? `Item ID ${recipeInput}` : `"${recipeInput}"`}:**` +
          (claimedMentions.length
            ? `\nClaimed by: ${[...new Set(claimedMentions)].join(', ')}`
            : '');

        if (OUTPUT_STYLE === 'embed') {
          // Build fields for the embed (no quality)
          const fields = results.map(row => ({
            name: `${row.member} (${row.profession})`,
            value:
              `**Discord:** ${row.discord_id ? `<@${row.discord_id}>` : '-'}\n` +
              `**Skill:** ${row.skill_level ?? 'unknown'}\n` +
              `**Recipe:** ${row.recipe_name}`,
            inline: true
          }));

          const embed = new EmbedBuilder()
            .setTitle(`Crafters for ${searchType === 'Item ID' ? `Item ID ${recipeInput}` : `"${recipeInput}"`}`)
            .addFields(fields)
            .setColor(0x00AE86);

          await interaction.reply({ embeds: [embed] });
        } else {
          // Monospaced table output (default)
          const codeHeader = `${headerLine}\n${separatorLine}`;
          const messages = splitMessage(header, [codeHeader, ...lines]);

          await interaction.reply(messages[0]);
          for (let i = 1; i < messages.length; i++) {
            await interaction.followUp(messages[i]);
          }
        }
      }
    );
  }
};