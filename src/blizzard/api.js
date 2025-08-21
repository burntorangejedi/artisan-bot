const axios = require('axios');
const debug = require('../data/debug');

const REGION = process.env.REGION || 'us';
const LOCALE = process.env.LOCALE || 'en_US';
const BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID;
const BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET;

async function getBlizzardAccessToken() {
  debug.log('Fetching accessToken from Blizzard API...');
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
  debug.log('Fetched accessToken: ', response.data.access_token);
  return response.data.access_token;
}

async function getGuildRoster(accessToken) {
  const realm = process.env.REALM.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
  const guild = process.env.GUILD_NAME.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
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
    console.warn(`Failed profession fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
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
    console.warn(`Failed summary fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

async function getCharacterSpecialization(realmSlug, charName, token) {
  const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${charName.toLowerCase()}/specializations?namespace=profile-${REGION}&locale=${LOCALE}`;
  debug.log('Fetching character Specialization from:', url);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.warn(`Failed specialization fetch for ${charName}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

// Fetch recipe details from Blizzard API by recipe ID
async function getRecipeDetails(recipeId, accessToken) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/recipe/${recipeId}?namespace=static-${REGION}&locale=${LOCALE}`;
  debug.log('Fetching recipe details from:', url);
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
    debug.log(`Failed to fetch recipe details for ID ${recipeId}: ${err.response ? err.response.status : err.message}`);
    return null;
  }
}

// Export all functions as an object
module.exports = {
  getBlizzardAccessToken,
  getGuildRoster,
  getCharacterProfessions,
  getCharacterSummary,
  getCharacterSpecialization,
  getRecipeDetails
};