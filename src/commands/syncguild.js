const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const db = require('../data/db');
const debugFlag = require('../data/debug');
require('dotenv').config();

const REGION = process.env.REGION;
const LOCALE = 'en_US';

async function getBlizzardAccessToken() {
  console.log('Fetching accessToken from Blizzard API...');
  console.log('Using REGION:', REGION);
  console.log('Using LOCALE:', LOCALE);
  console.log('Using BLIZZARD_CLIENT_ID:', process.env.BLIZZARD_CLIENT_ID);
  console.log('Using BLIZZARD_CLIENT_SECRET:', process.env.BLIZZARD_CLIENT_SECRET);

  const response = await axios.post(
    `https://${REGION}.battle.net/oauth/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: process.env.BLIZZARD_CLIENT_ID,
        password: process.env.BLIZZARD_CLIENT_SECRET,
      },
    }
  );

  console.log('Fetched accessToken: ', response.data.access_token);

  return response.data.access_token;
}

async function getGuildRoster(accessToken) {
  const realm = process.env.REALM.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
  const guild = process.env.GUILD_NAME.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
  const url = `https://${REGION}.api.blizzard.com/data/wow/guild/${realm}/${guild}/roster?namespace=profile-${REGION}&locale=${LOCALE}`;
  console.log('Guild roster URL:', url);
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return response.data.members;
}

// Fetch professions for a character
async function getCharacterProfessions(realmSlug, charName, token) {
  const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName.toLowerCase()}/professions?namespace=profile-${REGION}&locale=${LOCALE}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.warn(`Failed profession fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncguild')
    .setDescription('Admin: Sync or refresh guild data from Blizzard API')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the guild admin can use this command.', ephemeral: true });
    }

    await interaction.reply('Fetching guild roster and professions from Blizzard API...');

    try {
      const accessToken = await getBlizzardAccessToken();
      debugFlag.debugLog('Fetched accessToken:', accessToken);
      const members = await getGuildRoster(accessToken);
      debugFlag.debugLog('Fetched guild roster:', members);


      // Clear out guild_members, professions, and recipes tables
      db.serialize(async () => {
        db.run('DELETE FROM recipes');
        db.run('DELETE FROM professions');
        db.run('DELETE FROM guild_members', [], async (err) => {
          if (err) {
            console.error(err);
            return interaction.followUp('Failed to clear guild members table.');
          }

          const memberStmt = db.prepare('INSERT INTO guild_members (name) VALUES (?)');
          const profStmt = db.prepare('INSERT INTO professions (member_id, profession, skill_level) VALUES (?, ?, ?)');
          const recipeStmt = db.prepare('INSERT INTO recipes (profession_id, recipe_name, known) VALUES (?, ?, ?)');

          let imported = 0;
          for (const m of members) {
            const charName = m.character.name;
            const realmSlug = m.character.realm.slug;

            // Insert member
            await new Promise((resolve, reject) => {
              memberStmt.run(charName, function (err) {
                if (err) {
                  console.warn(`Failed to insert member ${charName}: ${err.message}`);
                  return resolve();
                }
                const memberId = this.lastID;

                // Fetch and insert professions
                getCharacterProfessions(realmSlug, charName, accessToken).then(async profData => {

                  debugFlag.debugLog('Professions API response for', charName, JSON.stringify(profData, null, 2));

                  const allProfs = [];
                  if (profData && profData.primaries) allProfs.push(...profData.primaries);
                  if (profData && profData.secondaries) allProfs.push(...profData.secondaries);

                  for (const prof of allProfs) {
                    await new Promise((profResolve) => {
                      profStmt.run(memberId, prof.profession.name, prof.skill_level, function (err) {
                        if (err) {
                          console.warn(`Failed to insert profession for ${charName}: ${err.message}`);
                          return profResolve();
                        }
                        const professionId = this.lastID;

                        // Insert known recipes for this profession (across all tiers)
                        if (prof.tiers && Array.isArray(prof.tiers)) {
                          for (const tier of prof.tiers) {
                            if (tier.known_recipes && Array.isArray(tier.known_recipes)) {
                              for (const recipe of tier.known_recipes) {
                                recipeStmt.run(professionId, recipe.name, 1); // 1 = known
                              }
                            }
                          }
                        }

                        profResolve();
                      });
                    });
                  }
                  imported++;
                  resolve();
                });
              });
            });
          }

          memberStmt.finalize();
          profStmt.finalize();
          recipeStmt.finalize();

          interaction.followUp(`Guild roster, professions, and recipes synced! ${members.length} members imported.`);
        });
      });
    } catch (err) {
      console.error(err);
      await interaction.followUp('Failed to fetch guild roster or professions from Blizzard API.');
    }
  }
};