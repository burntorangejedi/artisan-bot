const axios = require('axios');
const debug = require('../data/debug');

const settings = require('../settings');
const REGION = settings.REGION;
const LOCALE = settings.LOCALE;
const BLIZZARD_CLIENT_ID = settings.BLIZZARD_CLIENT_ID;
const BLIZZARD_CLIENT_SECRET = settings.BLIZZARD_CLIENT_SECRET;

// Fetch profession details (returns object with .tiers)
async function getSkillTiersForProfession(professionId, accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/profession/${professionId}?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching skill tiers for profession from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (err) {
    debug.error(`Failed to fetch skill tiers for profession ${professionId}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

// Fetch skill tiers for a profession
async function getSkillTiersForProfession(professionId, accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/profession/${professionId}?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching profession details from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (err) {
    debug.error(`Failed to fetch profession details for ${professionId}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

// Fetch recipes for a skill tier (categories and recipes)
async function getRecipesForSkillTier(professionId, skillTierId, accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/profession/${professionId}/skill-tier/${skillTierId}?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching profession skill tier from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (err) {
    debug.error(`Failed to fetch skill tier ${skillTierId} for profession ${professionId}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}
async function getBlizzardAccessToken() {
  debug.verbose('Fetching accessToken from Blizzard API...');
  const response = await axios.post(
    `https://${REGION}.battle.net/oauth/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: BLIZZARD_CLIENT_ID,
        password: BLIZZARD_CLIENT_SECRET,
      },
    }
  );
  debug.verbose('Fetched accessToken: ', response.data.access_token);
  return response.data.access_token;
}

async function getGuildRoster(accessToken) {
  const realm = settings.REALM.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
  const guild = settings.GUILD_NAME.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
  const url = `https://${REGION}.api.blizzard.com/data/wow/guild/${realm}/${guild}/roster?namespace=profile-${REGION}&locale=${LOCALE}`;
  debug.log('Guild roster URL:', url);
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  debug.log('Fetched guild roster:', response.data.members.length, "members");
  return response.data.members;
}

async function getCharacterProfessions(realmSlug, charName, token) {
  const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName.toLowerCase()}/professions?namespace=profile-${REGION}&locale=${LOCALE}`;
  debug.log('Fetching character professions from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    debug.error(`Failed profession fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

async function getCharacterSummary(realmSlug, charName, token) {
  const summaryUrl = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName.toLowerCase()}?namespace=profile-${REGION}&locale=${LOCALE}`;
  debug.log('Fetching character Summary for:', charName);
  try {
    const response = await axios.get(summaryUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.error(`Failed summary fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

async function getCharacterSpecialization(realmSlug, charName, token) {
  const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName.toLowerCase()}/specializations?namespace=profile-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching character Specialization from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.error(`Failed specialization fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}


// Fetch all recipe references for a profession from Blizzard API
async function getProfessionRecipeIndex(professionId, accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/profession/${professionId}/recipe/index?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching profession recipe index from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    // Returns { recipes: [ { id, name }, ... ] }
    return response.data;
  } catch (err) {
    debug.error(`Failed to fetch recipe index for profession ${professionId}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

// Fetch recipe details from Blizzard API by recipe ID
async function getRecipeDetails(recipeId, accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/recipe/${recipeId}?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching recipe details from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    // The response should contain name and crafted_item (with id)
    const name = response.data.name && response.data.name[LOCALE] ? response.data.name[LOCALE] : response.data.name;
    const item_id = response.data.crafted_item ? response.data.crafted_item.id : null;
    return { name, item_id };
  } catch (err) {
    debug.error(`Failed to fetch recipe details for ID ${recipeId}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

// Export all functions as an object
// Fetch the professions index from Blizzard API
async function getProfessionsIndex(accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/profession/index?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.verbose('Fetching professions index from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    // Returns { professions: [ { id, name }, ... ] }
    return response.data;
  } catch (err) {
    debug.error(`Failed to fetch professions index: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

module.exports = {
  getBlizzardAccessToken,
  getGuildRoster,
  getCharacterProfessions,
  getCharacterSummary,
  getCharacterSpecialization,
  getRecipeDetails,
  getProfessionRecipeIndex,
  getProfessionsIndex,
  getSkillTiersForProfession,
  getRecipesForSkillTier
};