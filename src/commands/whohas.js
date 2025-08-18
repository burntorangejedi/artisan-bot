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
    )
    .addBooleanOption(opt =>
      opt.setName('details')
        .setDescription('Show extra details (skill level, etc.)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const recipeName = interaction.options.getString('recipe');
    const showDetails = interaction.options.getBoolean('details');

    db.all(
      `
      SELECT gm.name AS member, p.profession, p.skill_level, r.recipe_name
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
        const results = rows.map(row => {
          if (showDetails) {
            return `${row.member.padEnd(18)} | ${row.profession.padEnd(15)} | skill: ${row.skill_level ?? 'unknown'} | ${row.recipe_name}`;
          } else {
            return `${row.member.padEnd(18)} | ${row.profession.padEnd(15)} | ${row.recipe_name}`;
          }
        });

        const header = `**Crafters for "${recipeName}":**`;
        const messages = splitMessage(header, results);

        // Send the first message as the reply, the rest as follow-ups
        await interaction.reply(messages[0]);
        for (let i = 1; i < messages.length; i++) {
          await interaction.followUp(messages[i]);
        }
      }
    );
  }
};