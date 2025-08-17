const { SlashCommandBuilder } = require('discord.js');
const professions = require('../data/professions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listprofessions')
    .setDescription('Lists all professions tracked by the bot'),
  async execute(interaction) {
    console.log('professions:', professions);
    const profList = Array.isArray(professions) ? professions : professions.default;
    await interaction.reply(`Professions:\n${profList.join('\n')}`);
  }
};