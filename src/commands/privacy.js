// src/commands/privacy.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('View the Privacy Policy for Artisan'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Artisan Privacy Policy')
      .setDescription('Click the link below to view the full Privacy Policy.')
      .setURL('https://github.com/burntorangejedi/artisan-bot/blob/main/PRIVACY.md')
      .setColor(0xFFD700); // gold
  await interaction.reply({ embeds: [embed], flags: 64 });
  },
};