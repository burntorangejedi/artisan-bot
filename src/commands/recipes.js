const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipes')
    .setDescription('Search recipes by ID or partial name')
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('Recipe ID')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Partial or full recipe name to search for')
        .setRequired(false)
    ),

  async execute(interaction) {
    const id = interaction.options.getInteger('id');
    const name = interaction.options.getString('name');

    // Defer reply to give DB queries time and avoid the "The application did not respond" timeout
    await interaction.deferReply();

    if (id) {
      db.get(
        'SELECT * FROM recipes WHERE recipe_id = ?',
        [id],
        (err, row) => {
          if (err) return interaction.editReply('Error fetching recipe.');
          if (!row) return interaction.editReply(`No recipe found with Recipe Id ${id}.`);
          const embed = new EmbedBuilder()
            .setTitle(row.recipe_name)
            .addFields(
              { name: 'Profession', value: row.profession_name || 'Unknown', inline: true },
              { name: 'Skill Tier', value: row.skill_tier_name || 'Unknown', inline: true },
              { name: 'Recipe ID', value: String(row.recipe_id), inline: true },
              { name: 'Item ID', value: row.item_id ? String(row.item_id) : 'Unknown', inline: true }
            );
          interaction.editReply({ embeds: [embed] });
        }
      );
      return;
    }

    if (name) {
      const q = `%${name}%`;
      db.all(
        'SELECT * FROM recipes WHERE recipe_name LIKE ? ORDER BY profession_name, recipe_name LIMIT 25',
        [q],
        (err, rows) => {
          if (err) return interaction.editReply('Error searching recipes.');
          if (!rows || !rows.length) return interaction.editReply(`No recipes found matching "${name}".`);
          debug.log(rows);
          // Multiple matches: add as embed fields (Discord limits fields to 25)
          const embed = new EmbedBuilder().setTitle(`Recipes matching "${name}" (${rows.length})`);
          // Put the "max of 25" note in the footer so the title remains a single line
          if (rows.length === 25) {
            embed.setFooter({ text: `Showing first 25 results - please narrow your search critiera` });
          }
          const fields = rows.slice(0, 25).map(r => {
            const prof = r.profession_name || 'Unknown';
            const tier = r.skill_tier_name ? `, Tier: ${r.skill_tier_name}` : '';
            const item = r.item_id ? `, Item ID: ${r.item_id}` : '';
            const value = `Recipe ID: ${r.recipe_id || 'N/A'} ${item} — ${prof}${tier}`;
            return { name: r.recipe_name || `Recipe ${r.recipe_id || r.id}`, value: value, inline: false };
          });
          embed.addFields(fields);
          debug.log({ embeds: [embed] });
          interaction.editReply({ embeds: [embed] });
        }
      );
      return;
    }

    // No parameters provided
    return interaction.editReply('Please provide either an `id` or a `name` to search for (e.g. `/recipes id:123` or `/recipes name:Iron`)');
  }
};
