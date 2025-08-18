const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listprofessions')
    .setDescription('Lists all professions covered by guild members'),
  async execute(interaction) {
    db.all(
      `SELECT DISTINCT profession FROM professions ORDER BY profession COLLATE NOCASE`,
      [],
      (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.reply('Error fetching professions from the database.');
        }
        if (!rows.length) {
          return interaction.reply('No professions found in the guild database.');
        }
        const profList = rows.map(row => row.profession);
        interaction.reply(`Professions covered by guild members:\n${profList.join('\n')}`);
      }
    );
  }
};