const db = require('../data/db');
const debug = require('../data/debug');
const { getMainRoleForSpecClass } = require('../constants/roles')
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
  getBlizzardAccessToken,
  getGuildRoster,
  getCharacterProfessions,
  getCharacterSummary,
  getRecipeDetails
} = require('../blizzard/api');
const {
  upsertGuildMember,
  getProfessionIdByName,
  upsertRecipe,
  upsertCharacterRecipe,
  deleteDepartedMembers
} = require('../data/guildSyncDb');
const { isBusy, setBusy } = require('../data/botState');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-guild')
    .setDescription('Admin: Sync or refresh guild data from Blizzard API')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (await isBusy()) {
      return interaction.reply({ content: 'A sync is already in progress. Please wait until it completes.', ephemeral: true });
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

  // No longer delete all recipes and character_recipes at the start.
  // Instead, we will upsert as needed and clean up after sync.

      // In-memory cache for recipe details by recipe.id
      const recipeDetailsCache = {};

      let imported = 0;
      try {
        await interaction.editReply(`Starting sync of ${members.length} characters. The more characters you have, the longer it can take. Please be patient while we crank through your imense guild..`);
      } catch (err) {
        debug.log('editReply failed (likely expired interaction):', err.message || err);
      }

      // Helper to process a single member (returns a promise)
      async function processMember(m) {
        const charName = m.character.name;
        const realmSlug = m.character.realm.slug;
        const t0 = Date.now();

        // Fetch class/spec info
        let charClass = null, charSpec = null;
        const tSummaryStart = Date.now();
        const summary = await getCharacterSummary(realmSlug, charName, accessToken);
        const tSummaryEnd = Date.now();
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
        const tUpsertStart = Date.now();
        const memberId = await upsertGuildMember({
          name: charName,
          realm: realmSlug,
          charClass,
          charSpec,
          charRole
        });
        const tUpsertEnd = Date.now();

        // Fetch professions
        const tProfStart = Date.now();
        const profData = await getCharacterProfessions(realmSlug, charName, accessToken);
        const tProfEnd = Date.now();
        const allProfs = [];
        if (profData && profData.primaries) allProfs.push(...profData.primaries);
        if (profData && profData.secondaries) allProfs.push(...profData.secondaries);

        debug.verbose(`Professions found for ${charName}: ${allProfs.map(p => p.profession.name).join(', ')}`);

        const tRecipesStart = Date.now();
        for (const prof of allProfs) {
          const professionName = prof.profession.name;
          const professionId = await getProfessionIdByName(professionName);

          if (!professionId) {
            debug.log(`Profession "${professionName}" not found in professions. Skipping.`);
            continue;
          }
          debug.verbose(`Processing profession: ${professionName} (id: ${professionId}) for ${charName}`);

          // Insert known recipes for this profession (across all tiers)
          if (prof.tiers && Array.isArray(prof.tiers)) {
            for (const tier of prof.tiers) {
              if (tier.known_recipes && Array.isArray(tier.known_recipes)) {
                for (const recipe of tier.known_recipes) {
                  // Try to get recipe details from Blizzard API, with in-memory cache
                  let recipeName = recipe.name;
                  let itemId = null;
                  let details = null;
                  if (recipe.id) {
                    if (recipeDetailsCache[recipe.id]) {
                      details = recipeDetailsCache[recipe.id];
                    } else {
                      details = await getRecipeDetails(recipe.id, accessToken);
                      if (details) recipeDetailsCache[recipe.id] = details;
                    }
                    if (details) {
                      recipeName = details.name || recipeName;
                      itemId = details.item_id;
                    }
                  }
                  debug.verbose(`Upserting recipe: ${recipeName} (itemId: ${itemId}) for professionId: ${professionId}`);
                  // Insert recipe if not exists, get recipeId
                  const recipeId = await upsertRecipe(professionId, recipeName, itemId);
                  debug.verbose(`Upserting character recipe: memberId=${memberId}, professionId=${professionId}, recipeId=${recipeId}`);
                  // Insert or update character_recipes (no skill level)
                  await upsertCharacterRecipe(memberId, professionId, recipeId);
                }
              }
            }
          }
        }
        const tRecipesEnd = Date.now();

        const t1 = Date.now();
        debug.verbose(`TIMING: ${charName} (${realmSlug}) - summary: ${tSummaryEnd - tSummaryStart}ms, upsert: ${tUpsertEnd - tUpsertStart}ms, professions: ${tProfEnd - tProfStart}ms, recipes: ${tRecipesEnd - tRecipesStart}ms, TOTAL: ${t1 - t0}ms`);
      }

      // Batch processing with concurrency limit
  // For faster syncs, increase SYNC_BATCH_SIZE in your .env (e.g., 5 or 10). For debugging, use 1.
  const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE, 10) || 5;
      for (let i = 0; i < members.length; i += BATCH_SIZE) {
        const batch = members.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(processMember));
        imported += batch.length;
        try {
          await interaction.editReply(`Syncing... (${imported}/${members.length} characters processed)`);
        } catch (err) {
          debug.log('editReply failed (likely expired interaction):', err.message || err);
        }
      }



      // Delete departed members
      await deleteDepartedMembers(currentNamesRealms);

      // Clean up character_recipes that reference non-existent members or recipes
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM character_recipes WHERE member_id NOT IN (SELECT id FROM guild_members)`, err => {
          if (err) return reject(err);
          db.run(`DELETE FROM character_recipes WHERE recipe_id NOT IN (SELECT id FROM recipes)`, err2 => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });

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