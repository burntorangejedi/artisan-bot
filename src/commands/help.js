const { SlashCommandBuilder } = require('discord.js');
const helpText = `**Artisan Bot Commands**

/help — Show this help message
/whohas <item/recipe> — Find out who can craft a specific recipe or item (supports pagination with Next/Previous buttons)

**/characters** — Manage your claimed characters:
  • /characters claim <character> — Claim a character as your own
  • /characters setmain <character> — Set one of your claimed characters as your main
  • /characters list — List all characters you have claimed (shows class, spec, main role, and main status)
  • /characters unclaim <character> — Unclaim a character you previously claimed

**Admin Functions**
/admin sync — Admin: Sync or refresh guild data from Blizzard API (updates roster, professions, and recipes)
/admin add-roles — Admin: Create all class/spec, main, and profession roles
/admin remove-roles — Admin: Remove all class/spec, main, and profession roles

Other commands may be available depending on your guild's configuration.
`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show an overview of all commands supported by the bot'),
  async execute(interaction) {
    await interaction.reply({ content: helpText, flags: 64 });

  }

};
