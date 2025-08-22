// src/commands/terms.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('terms')
    .setDescription('View the Terms of Service for Artisan'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Artisan Terms of Service')
      .setDescription('Click the link below to view the full Terms of Service.')
      .setURL('https://github.com/burntorangejedi/artisan-bot/blob/main/TERMS.md')
      .setColor(0xFF8C00); // warm orange
  await interaction.reply({ embeds: [embed], flags: 64 });
  },
};