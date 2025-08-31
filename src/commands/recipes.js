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
          if (rows.length === 1) {
            const r = rows[0];
            const embed = new EmbedBuilder()
              .setTitle(r.recipe_name)
              .addFields(
                { name: 'Profession', value: r.profession_name || 'Unknown', inline: true },
                { name: 'Skill Tier', value: r.skill_tier_name || 'Unknown', inline: true },
                { name: 'Recipe ID', value: String(r.recipe_id), inline: true },
                { name: 'Item ID', value: r.item_id ? String(r.item_id) : 'Unknown', inline: true }
              );
            debug.log({ embeds: [embed] });
            return interaction.editReply({ embeds: [embed] });
          }
          // Multiple matches: add as embed fields (Discord limits fields to 25)
          const embed = new EmbedBuilder()
            .setTitle(`Recipes matching "${name}" (${rows.length})`)
            .addFields(
              { name: 'Profession', value: r.profession_name || 'Unknown', inline: true },
              { name: 'Skill Tier', value: r.skill_tier_name || 'Unknown', inline: true },
              { name: 'Recipe ID', value: String(r.recipe_id), inline: true },
              { name: 'Item ID', value: r.item_id ? String(r.item_id) : 'Unknown', inline: true }
            );
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
