const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncguild')
    .setDescription('Admin: Sync or refresh guild data')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins can use
  async execute(interaction) {
    // Only allow the command for the guild owner (you)
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the guild admin can use this command.', ephemeral: true });
    }

    // Placeholder for actual sync logic
    await interaction.reply('Guild data sync started! (This is a placeholder. Real syncing coming soon.)');
  }
};