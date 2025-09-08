const { SlashCommandBuilder } = require('discord.js');
const helpText = `Artisan Bot — quick reference

/whohas <item|recipe> — Find crafters for an item or recipe (paginated)
/guild — Guild listings (profession, role, class, claimed, unclaimed). Use autocomplete where available.
/characters — Claim/manage characters (claim, setmain, list, unclaim)
/recipes — Recipe info by id
/admin — Admin setup (sync roster, add/remove roles, import GRM)

Full command details and examples are in README.md in the project repository. Use the commands listed above; long outputs are paginated and the bot will fall back to follow-ups when needed.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show an overview of all commands supported by the bot'),
  async execute(interaction) {
    try {
      // GitHub README URL for quick access
      const readmeUrl = 'https://github.com/burntorangejedi/artisan-bot/blob/main/README.md';
      const components = [
        { type: 1, components: [ { type: 2, style: 5, label: 'Open README', url: readmeUrl } ] }
      ];
      // Use flags:64 (ephemeral) to avoid the deprecated `ephemeral` option warning
      await interaction.reply({ content: helpText, flags: 64, components });
    } catch (err) {
      const debug = require('../data/debug');
      debug.error('Error replying in /help:', err);
      // Fallback to safeEditReply which will try editReply/reply/followUp as needed
      try {
        const { safeEditReply } = require('../utils/interaction');
        const readmeUrl = 'https://github.com/burntorangejedi/artisan-bot/blob/main/README.md';
        const components = [ { type: 1, components: [ { type: 2, style: 5, label: 'Open README', url: readmeUrl } ] } ];
        await safeEditReply(interaction, { content: helpText, components });
      } catch (e) {
        // final fallback: try a plain followUp
        try { await interaction.followUp({ content: 'Unable to deliver help message.' }); } catch { }
      }
    }

  }

};
