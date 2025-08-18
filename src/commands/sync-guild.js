const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const debug = require('../data/debug');

const {
  getBlizzardAccessToken,
  getGuildRoster,
  getCharacterProfessions,
  getCharacterSummary
} = require('../blizzard/api');

const {
  upsertGuildMember,
  insertProfession,
  insertRecipe,
  deleteDepartedMembers
} = require('../data/guildSyncDb');

const { SPEC_ROLE_MAP } = require('../constants/roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-guild')
    .setDescription('Admin: Sync or refresh guild data from Blizzard API')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the guild admin can use this command.', ephemeral: true });
    }

    debug.log('sync-guild: command started');
    await interaction.deferReply();

    const startTime = Date.now();
    let imported = 0;

    try {
      const accessToken = await getBlizzardAccessToken();
      debug.log('sync-guild: Access token ' + accessToken);
      const members = await getGuildRoster(accessToken);
      debug.log('syncguild: Fetched members count:', members.length);

      // Gather all current guild character names and realms
      const currentNamesRealms = members.map(m => ({
        name: m.character.name,
        realm: m.character.realm.slug
      }));

      // Clear out professions and recipes, but NOT guild_members
      const db = require('../data/db');
      db.serialize(async () => {
        db.run('DELETE FROM recipes');
        db.run('DELETE FROM professions');

        let imported = 0;
        await interaction.editReply(`Starting sync of ${members.length} characters - this might take a while, about 1 minute for every 40 toons right now. I'll try to make this faster in the future.`);

        for (const m of members) {
          // Update progress every 10 characters
          if (imported > 0 && imported % 10 === 0) {
            await interaction.editReply(`Syncing... (${imported}/${members.length} characters processed)`);
          }
          const charName = m.character.name;
          const realmSlug = m.character.realm.slug;

          // Fetch class/spec info
          let charClass = null, charSpec = null;
          const summary = await getCharacterSummary(realmSlug, charName, accessToken);
          if (summary && summary.character_class && summary.active_spec) {
            charClass = summary.character_class.name;
            charSpec = summary.active_spec.name;
          }

          // Use mapping to get main role
          let charRole = null;
          if (charClass && charSpec) {
            charRole = getMainRoleForSpecClass(charSpec, charClass);
          }

          debug.log(`sync-guild: Processing ${charName} (${realmSlug}) - Class: ${charClass}, Spec: ${charSpec}, Role: ${charRole}`);

          // Upsert guild member and get memberId
          const memberId = await upsertGuildMember({
            name: charName,
            realm: realmSlug,
            charClass,
            charSpec,
            charRole
          });

          // Fetch and insert professions
          const profData = await getCharacterProfessions(realmSlug, charName, accessToken);
          const allProfs = [];
          if (profData && profData.primaries) allProfs.push(...profData.primaries);
          if (profData && profData.secondaries) allProfs.push(...profData.secondaries);

          for (const prof of allProfs) {
            const professionId = await insertProfession(memberId, prof.profession.name, prof.skill_level);
            // Insert known recipes for this profession (across all tiers)
            if (prof.tiers && Array.isArray(prof.tiers)) {
              for (const tier of prof.tiers) {
                if (tier.known_recipes && Array.isArray(tier.known_recipes)) {
                  for (const recipe of tier.known_recipes) {
                    await insertRecipe(professionId, recipe.name, 1); // 1 = known
                  }
                }
              }
            }
          }
          imported++;
        }

        // Delete departed members
        await deleteDepartedMembers(currentNamesRealms);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        debug.log(`sync-guild: Command finished! Imported ${imported} members in ${elapsed} seconds`);
        await interaction.editReply(`Guild roster, professions, and recipes synced! ${members.length} members imported in ${elapsed} seconds.`);
      });
    } catch (err) {
      console.error('DB error: ', err);
      console.error(err);
      await interaction.editReply('Failed to fetch guild roster or professions from Blizzard API.');
    }
  }
};