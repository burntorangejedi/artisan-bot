const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const debugFlag = require('../data/debug');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debug')
    .setDescription('Enable or disable debug logging')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('on or off')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    debugFlag.setDebug(mode === 'on');
    await interaction.reply(`Debug mode is now ${mode === 'on' ? 'ENABLED' : 'DISABLED'}.`);
  }
};