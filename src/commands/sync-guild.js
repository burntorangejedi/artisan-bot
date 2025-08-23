const db = require('../data/db');
const debug = require('../data/debug');
const { getMainRoleForSpecClass } = require('../constants/roles');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getBlizzardAccessToken, getGuildRoster, getCharacterSummary, getCharacterProfessions } = require('../blizzard/api');
const { isBusy, setBusy } = require('../data/botState');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-guild')
    .setDescription('Admin: Sync or refresh guild data from Blizzard API')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (await isBusy()) {
      return interaction.reply({ content: 'A sync is already in progress. Please wait until it completes.', flags: 64 });
    }
    setBusy(true);
    try {
      debug.log('sync-guild: command started');
      await interaction.deferReply();

      const accessToken = await getBlizzardAccessToken();
      debug.log('sync-guild: Access token ' + accessToken);
      const members = await getGuildRoster(accessToken);
      debug.log('syncguild: Fetched members count:', members.length);

      // Gather all current guild character names and realms
      const currentNamesRealms = members.map(m => ({
        name: m.character.name,
        realm: m.character.realm.slug
      }));

      let imported = 0;
      try {
        await interaction.editReply(`Starting sync of ${members.length} characters. The more characters you have, the longer it can take. Please be patient while we crank through your imense guild..`);
      } catch (err) {
        debug.log('editReply failed (likely expired interaction):', err.message || err);
      }

      // Batch processing with concurrency limit
      const settings = require('../settings');
      const BATCH_SIZE = settings.SYNC_BATCH_SIZE;
      for (let i = 0; i < members.length; i += BATCH_SIZE) {
        const batch = members.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (m) => {
          const charName = m.character.name;
          const realmSlug = m.character.realm.slug;
          // Fetch summary and professions for this character
          const summary = await getCharacterSummary(realmSlug, charName, accessToken);
          const professions = await getCharacterProfessions(realmSlug, charName, accessToken);
          await db.syncGuildMember({ character: m.character, summary, professions, accessToken });
        }));
        imported += batch.length;
        try {
          await interaction.editReply(`Syncing... (${imported}/${members.length} characters processed)`);
        } catch (err) {
          debug.log('editReply failed (likely expired interaction):', err.message || err);
        }
      }

      // Delete departed members
      await db.deleteDepartedMembers(currentNamesRealms);

      // Clean up character_recipes that reference non-existent members or recipes
      await db.cleanupOrphanedCharacterRecipes();

      debug.log(`sync-guild: Command finished! Imported ${imported} members.`);
      try {
        await interaction.editReply(`Guild roster, professions, and recipes synced! ${members.length} members imported.`);
      } catch (err) {
        debug.log('editReply failed (likely expired interaction):', err.message || err);
      }
    } catch (err) {
      console.error('DB error: ', err);
      try {
        await interaction.editReply('Failed to fetch guild roster or professions from Blizzard API.');
      } catch (err2) {
        debug.log('editReply failed (likely expired interaction):', err2.message || err2);
      }
    } finally {
      setBusy(false);
    }
  }
};