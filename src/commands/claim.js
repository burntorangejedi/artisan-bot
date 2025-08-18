const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');
const IGNORED_PROFESSIONS = [
  'Cooking', 'Archaeology', 'First Aid', 'Fishing', 'Riding', 'Runeforging'
];

async function assignProfessionRoles(guild, member, characterNames) {
  // characterNames is an array of character names
  for (const characterName of characterNames) {
    await new Promise((resolve) => {
      db.all(
        `SELECT profession FROM professions
         JOIN guild_members ON professions.member_id = guild_members.id
         WHERE guild_members.name = ?`,
        [characterName],
        async (err, rows) => {
          if (err) {
            console.error('Role assignment DB error:', err);
            return resolve();
          }
          const professions = rows
            .map(row => row.profession)
            .filter(prof => !IGNORED_PROFESSIONS.includes(prof));
          for (const prof of professions) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
            if (role && !member.roles.cache.has(role.id)) {
              try {
                await member.roles.add(role);
              } catch (e) {
                console.warn(`Could not assign role ${prof} to ${member.user.tag}:`, e.message);
              }
            }
          }
          resolve();
        }
      );
    });
  }
}

module.exports = {

  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a character as your own or list your claimed characters')
    .addSubcommand(sub =>
      sub.setName('character')
        .setDescription('Claim a character as your own')
        .addStringOption(opt =>
          opt.setName('character')
            .setDescription('Character name (as in guild)')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all characters you have claimed')
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    db.all(
      `SELECT name FROM guild_members WHERE (discord_id IS NULL OR discord_id = '') AND name LIKE ? ORDER BY name LIMIT 25`,
      [`%${focused}%`],
      (err, rows) => {
        if (err) {
          console.error(err);
          return interaction.respond([]);
        }
        const choices = rows.map(row => ({
          name: row.name,
          value: row.name
        }));
        interaction.respond(choices);
      }
    );
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'character') {
      const characterInput = interaction.options.getString('character');
      const discordId = interaction.user.id;
      const characterNames = characterInput.split(/\s+/).filter(Boolean);

      let results = [];
      let completed = 0;

      characterNames.forEach(character => {
        db.get(
          `SELECT id, discord_id FROM guild_members WHERE name = ?`,
          [character],
          (err, row) => {
            if (err) {
              console.error(err);
              results.push(`❌ ${character}: Database error.`);
              checkDone();
            } else if (!row) {
              results.push(`❌ ${character}: Not found in the guild database.`);
              checkDone();
            } else if (row.discord_id && row.discord_id !== discordId) {
              results.push(`❌ ${character}: Already claimed by another user.`);
              checkDone();
            } else {
              db.run(
                `UPDATE guild_members SET discord_id = ? WHERE id = ?`,
                [discordId, row.id],
                async (err2) => {
                  if (err2) {
                    console.error(err2);
                    results.push(`❌ ${character}: Failed to claim.`);
                  } else {
                    results.push(`✅ ${character}: Claimed!`);
                    // Assign roles after successful claim
                    try {
                      const guild = interaction.guild;
                      const member = await guild.members.fetch(interaction.user.id);
                      await assignProfessionRoles(guild, member, [character]);
                    } catch (e) {
                      console.warn(`Could not assign roles for ${character}:`, e.message);
                    }
                  }
                  checkDone();
                }
              );
            }
          }
        );
      });

      function checkDone() {
        completed++;
        if (completed === characterNames.length) {
          interaction.reply(results.join('\n'));
        }
      }
    } else if (subcommand === 'list') {
      const discordId = interaction.user.id;
      db.all(
        `SELECT name FROM guild_members WHERE discord_id = ? ORDER BY name`,
        [discordId],
        (err, rows) => {
          if (err) {
            console.error(err);
            return interaction.reply('Database error.');
          }
          if (!rows.length) {
            return interaction.reply('You have not claimed any characters.');
          }
          const names = rows.map(row => row.name).join('\n');
          interaction.reply(`Your claimed characters:\n${names}`);
        }
      );
    }
  }
};