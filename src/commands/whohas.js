const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');

const DISCORD_LIMIT = 2000;

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
        .setDescription('Recipe name (partial match allowed)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const recipeName = interaction.options.getString('recipe');

    db.all(
      `
      SELECT gm.name AS member, p.profession, p.skill_level, r.recipe_name, gm.discord_id
      FROM recipes r
      JOIN professions p ON r.profession_id = p.id
      JOIN guild_members gm ON p.member_id = gm.id
      WHERE r.recipe_name LIKE ? AND r.known = 1
      `,
      [`%${recipeName}%`],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply('Error searching for crafters.');
        }
        if (!rows.length) {
          return interaction.reply(`No guild member can craft a recipe matching "${recipeName}".`);
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

        let headerLine = `Character           | Discord Name        | Profession     | Skill   | Recipe`;
        let separatorLine = `--------------------|---------------------|----------------|---------|---------------------`;

        const results = rows.map(row =>
          `${row.member.padEnd(20)}| ${(
            row.discord_id ? discordNames[row.discord_id] : '-'
          ).padEnd(20)}| ${row.profession.padEnd(15)}| ${String(row.skill_level ?? 'unknown').padEnd(8)}| ${row.recipe_name}`
        );

        const claimedMentions = rows
          .filter(row => row.discord_id)
          .map(row => `<@${row.discord_id}>`);

        const header = `**Crafters for "${recipeName}":**` +
          (claimedMentions.length
            ? `\nClaimed by: ${[...new Set(claimedMentions)].join(', ')}`
            : '');

        const codeHeader = `${headerLine}\n${separatorLine}`;
        const messages = splitMessage(header, [codeHeader, ...results]);

        // Send the first message as the reply, the rest as follow-ups
        await interaction.reply(messages[0]);
        for (let i = 1; i < messages.length; i++) {
          await interaction.followUp(messages[i]);
        }
      }
    );
  }
};