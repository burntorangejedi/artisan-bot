require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const debug = require('./data/debug');
const db = require('./data/db');

const settings = require('./settings');
const DISCORD_TOKEN = settings.DISCORD_TOKEN;
const CLIENT_ID = settings.CLIENT_ID;
const GUILD_ID = settings.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  // Skip files that don't export a valid SlashCommand (protect against empty/malformed files)
  if (!command || !command.data || !command.data.name) {
    // Use debug.warn if available, otherwise fall back to console.warn
    if (debug && typeof debug.warn === 'function') {
      debug.warn(`Skipping invalid or empty command file: ${file}`);
    } else {
      console.warn(`Skipping invalid or empty command file: ${file}`);
    }
    continue;
  }
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    debug.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );
    debug.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command && command.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error executing that command!', flags: 64 });
  }
});

(async () => {
  await registerCommands();
  await client.login(DISCORD_TOKEN);
})();