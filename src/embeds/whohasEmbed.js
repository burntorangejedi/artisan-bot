// whohasEmbed.js
// Helper for building paginated embed results for the /whohas command

const { EmbedBuilder } = require('discord.js');

const PROF_COLORS = {
  'Alchemy': '🧪',
  'Blacksmithing': '⚒️',
  'Enchanting': '✨',
  'Engineering': '🔧',
  'Jewelcrafting': '💎',
  'Leatherworking': '👢',
  'Tailoring': '🧵',
  'Inscription': '📜',
  'Cooking': '🍳',
  'Herbalism': '🌿',
  'Mining': '⛏️',
  'Skinning': '🔪',
  'Fishing': '🎣',
  'Archaeology': '🏺',
  'First Aid': '🩹'
};

function buildWhohasEmbedPage({ results, pageIdx, searchType, recipeInput }) {
  const PAGE_SIZE = 5;
  const pageResults = results.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
  const embed = new EmbedBuilder()
    .setTitle(`Crafters for ${searchType === 'Item ID' ? `Item ID ${recipeInput}` : `"${recipeInput}"`}`)
    .setColor(0x00AE86)
    .setDescription(
      pageResults.map(row => {
        let wowhead = row.item_id ? `https://www.wowhead.com/item=${row.item_id}` : null;
        let itemIdField = row.item_id ? `[${row.item_id}](${wowhead})` : '-';
        let profIcon = PROF_COLORS[row.profession] || '';
        let crafterLine = `**${profIcon} ${row.member}**  ${row.discord_id ? `<@${row.discord_id}>` : ''}\n` +
          `*Profession:* __${row.profession}__\n` +
          `*Recipe:* **${row.recipe_name}**\n` +
          (row.item_id ? `*Item ID:* ${itemIdField}\n` : '') +
          `\u200B`;
        return crafterLine;
      }).join('\n')
    );
  let wowheadLink = pageResults[0]?.item_id ? `https://www.wowhead.com/item=${pageResults[0].item_id}` : null;
  if (wowheadLink) embed.setURL(wowheadLink);
  // Optionally, set a thumbnail if you have an icon URL
  if (pageResults[0]?.icon) {
    embed.setThumbnail(pageResults[0].icon);
  }
  return embed;
}

module.exports = { buildWhohasEmbedPage };
