const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../data/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipes')
    .setDescription('List or look up recipes by ID')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all recipes (paginated)')
        .addIntegerOption(opt =>
          opt.setName('page')
            .setDescription('Page number (default 1)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Get details for a recipe by ID')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Recipe ID')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      const page = interaction.options.getInteger('page') || 1;
      const pageSize = 10;
      const offset = (page - 1) * pageSize;
      db.all(
        'SELECT id, recipe_name, profession_name, skill_tier_name FROM recipes ORDER BY profession_name, recipe_name LIMIT ? OFFSET ?',
        [pageSize, offset],
        (err, rows) => {
          if (err) return interaction.reply('Error fetching recipes.');
          if (!rows.length) return interaction.reply('No recipes found for this page.');
          const lines = rows.map(r => `**${r.recipe_name}** (ID: ${r.id})\nProfession: ${r.profession_name}${r.skill_tier_name ? `, Tier: ${r.skill_tier_name}` : ''}`);
          const embed = new EmbedBuilder()
            .setTitle(`Recipes List (Page ${page})`)
            .setDescription(lines.join('\n\n'));
          interaction.reply({ embeds: [embed] });
        }
      );
    } else if (sub === 'info') {
      const id = interaction.options.getInteger('id');
      db.get(
        'SELECT * FROM recipes WHERE id = ?',
        [id],
        (err, row) => {
          if (err) return interaction.reply('Error fetching recipe.');
          if (!row) return interaction.reply(`No recipe found with ID ${id}.`);
          const embed = new EmbedBuilder()
            .setTitle(row.recipe_name)
            .addFields(
              { name: 'Profession', value: row.profession_name || 'Unknown', inline: true },
              { name: 'Skill Tier', value: row.skill_tier_name || 'Unknown', inline: true },
              { name: 'Recipe ID', value: String(row.id), inline: true },
              { name: 'Blizzard Recipe ID', value: String(row.recipe_id || 'Unknown'), inline: true },
              { name: 'Item ID', value: row.item_id ? String(row.item_id) : 'Unknown', inline: true }
            );
          interaction.reply({ embeds: [embed] });
        }
      );
    }
  }
};
