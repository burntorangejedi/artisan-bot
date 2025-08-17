const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listplayers')
    .setDescription('Lists all players in the guild')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins can use
  async execute(interaction) {
    // Only allow the command for the guild owner (you)
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the guild admin can use this command.', ephemeral: true });
    }

    await interaction.guild.members.fetch(); // Fetch all members
    const members = interaction.guild.members.cache
      .filter(member => !member.user.bot)
      .map(member => member.user.username);

    await interaction.reply(`Guild Members:\n${members.join('\n')}`);
  }
};