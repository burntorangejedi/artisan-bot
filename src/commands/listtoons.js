const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../data/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listtoons')
    .setDescription('Admin: List all toons')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the guild admin can use this command.', ephemeral: true });
    }
    db.all('SELECT toon_name, profession, skill_level FROM toons', [], (err, rows) => {
      if (err) {
        return interaction.reply('Error fetching toons.');
      }
      if (rows.length === 0) {
        return interaction.reply('No toons found.');
      }
      const list = rows.map(row => `${row.toon_name} (${row.profession}, ${row.skill_level})`).join('\n');
      interaction.reply(`Toons:\n${list}`);
    });
  }
};