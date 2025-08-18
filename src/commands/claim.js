const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/db');
const debug = require('../data/debug');

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
                        } else if (!row) {
                            results.push(`❌ ${character}: Not found in the guild database.`);
                        } else if (row.discord_id && row.discord_id !== discordId) {
                            results.push(`❌ ${character}: Already claimed by another user.`);
                        } else {
                            db.run(
                                `UPDATE guild_members SET discord_id = ? WHERE id = ?`,
                                [discordId, row.id],
                                (err2) => {
                                    if (err2) {
                                        console.error(err2);
                                        results.push(`❌ ${character}: Failed to claim.`);
                                    } else {
                                        results.push(`✅ ${character}: Claimed!`);
                                    }
                                    checkDone();
                                }
                            );
                            return; // Don't call checkDone here, wait for db.run
                        }
                        checkDone();
                    }
                );
            });

            function checkDone() {
                completed++;
                if (completed === characterNames.length) {
                    interaction.reply(results.join('\n'));
                }
            }
        }
    }
};