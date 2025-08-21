const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show an overview of all commands supported by the bot'),
  async execute(interaction) {
    const helpText = `**Artisan Bot Commands**\n\n
/sync-guild — Admin: Sync or refresh guild data from Blizzard API\n
/whohas <item/recipe> — Find out who can craft a specific recipe or item\n
/help — Show this help message\n\nOther commands may be available depending on your guild's configuration.`;
    await interaction.reply({ content: helpText, ephemeral: true });
  }
};
