const { SlashCommandBuilder } = require('discord.js');
const helpText = `**Artisan Bot Commands**

/help — Show this help message
/whohas <item/recipe> — Find out who can craft a specific recipe or item (supports pagination with Next/Previous buttons)

**/guild** — Guild-wide listing helpers (supports autocomplete and pagination):
  • /guild profession <profession> — List characters who have the given profession (autocomplete supported)
  • /guild role <role> — List characters by main role (Tank / Healer / Melee DPS / Ranged DPS) (autocomplete supported)
  • /guild class <class> — List characters of a given class (autocomplete supported)
  • /guild claimed [mains_only] — List claimed characters with owner, class & spec (optional boolean 'mains_only')
  • /guild unclaimed — List unclaimed characters (class & spec shown)

  Notes:
   - Results are paginated with Next/Previous buttons for long lists.
   - Each page prepends a "Found N..." line inside the code block so the total is visible.
   - Autocomplete is used where noted to help pick professions, classes, and roles.

**/characters** — Manage your claimed characters:
  • /characters claim <character> — Claim a character as your own (autocomplete supported)
  • /characters setmain <character> — Set one of your claimed characters as your main (autocomplete supported)
  • /characters list — List all characters you have claimed (shows class, spec, main role, and main status)
  • /characters unclaim <character> — Unclaim a character you previously claimed (autocomplete supported)

**/recipes**
  • /recipes info <id> — Show details for a specific recipe by internal ID

**/admin - Administrative and setup functions**
  • /admin sync — Admin: Sync or refresh guild data from Blizzard API (updates roster, professions, and recipes)
  • /admin add-roles — Admin: Create all class/spec, main, and profession roles
  • /admin remove-roles — Admin: Remove all class/spec, main, and profession roles
  • /admin import-grm <file> — Admin: Import a Guild_Roster_Manager.lua file (upload)

Other commands may be available depending on your guild's configuration. Note that some long-running interactions use safe reply/update helpers so the bot will gracefully fall back to follow-up messages if the original interaction has expired.
`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show an overview of all commands supported by the bot'),
  async execute(interaction) {
    await interaction.reply({ content: helpText, flags: 64 });

  }

};
