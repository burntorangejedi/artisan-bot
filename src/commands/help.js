const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show an overview of all commands supported by the bot'),
  async execute(interaction) {
    const helpText = `**Artisan Bot Commands**\n\n
/sync-guild — Admin: Sync or refresh guild data from Blizzard API\n/whohas <item/recipe> — Find out who can craft a specific recipe or item (with pagination)\n\n**/characters** — Manage your claimed characters:\n  • /characters claim <character> — Claim a character as your own\n  • /characters setmain <character> — Set one of your claimed characters as your main\n  • /characters list — List all characters you have claimed\n  • /characters unclaim <character> — Unclaim a character you previously claimed\n\n/guild-roles add — Admin: Create all class/spec, main, and profession roles\n/guild-roles remove — Admin: Remove all class/spec, main, and profession roles\n/help — Show this help message\n\nOther commands may be available depending on your guild's configuration.`;
  await interaction.reply({ content: helpText, flags: 64 });
  }
};
