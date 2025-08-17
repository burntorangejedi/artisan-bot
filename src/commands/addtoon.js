const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../data/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addtoon')
    .setDescription('Admin: Add a toon for testing')
    .addStringOption(opt =>
      opt.setName('toon_name').setDescription('Toon name').setRequired(true))
    .addStringOption(opt =>
      opt.setName('profession').setDescription('Profession').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('skill_level').setDescription('Skill level').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the guild admin can use this command.', ephemeral: true });
    }
    const toonName = interaction.options.getString('toon_name');
    const profession = interaction.options.getString('profession');
    const skillLevel = interaction.options.getInteger('skill_level');
    db.run(
      'INSERT INTO toons (discord_id, toon_name, profession, skill_level) VALUES (?, ?, ?, ?)',
      [interaction.user.id, toonName, profession, skillLevel],
      function (err) {
        if (err) {
          return interaction.reply('Error adding toon.');
        }
        interaction.reply(`Toon ${toonName} (${profession}, ${skillLevel}) added!`);
      }
    );
  }
};