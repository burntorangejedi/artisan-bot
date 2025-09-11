const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../data/platform/sqlite/db_sqlite');
const debug = require('../data/debug');
const settings = require('../settings');
const { safeEditReply } = require('../utils/interaction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ineed')
    .setDescription('Place an order for a specific recipe/item')
    .addStringOption(opt => opt.setName('query').setDescription('Recipe name or Item ID').setRequired(true))
    .addStringOption(opt => opt.setName('note').setDescription('Optional note to the crafter')),

  async execute(interaction) {
    try { await interaction.deferReply({ flags: 64 }); } catch (e) { }
    const query = interaction.options.getString('query');
    const note = interaction.options.getString('note');
    try {
      const isItemId = /^\d+$/.test(query.trim());
      const results = isItemId ? await db.searchRecipesByItemId(parseInt(query, 10)) : await db.searchRecipesByName(query);
      if (!results || !results.length) return await safeEditReply(interaction, `No recipes found for "${query}".`);

      // If only one result, create order directly
      if (results.length === 1) {
        const r = results[0];
        const res = await db.createOrder({ requesterDiscordId: interaction.user.id, recipeId: r.id, itemId: r.item_id, recipeName: r.recipe_name, note });
        // If ORDERS_CHANNEL_ID is configured, post the order there and ping role if configured
        try {
          const ORDERS_CHANNEL_ID = settings.ORDERS_CHANNEL_ID;
          const ORDERS_PING_ROLE_ID = settings.ORDERS_PING_ROLE_ID;
          if (ORDERS_CHANNEL_ID && interaction.client) {
            const ch = await interaction.client.channels.fetch(ORDERS_CHANNEL_ID).catch(() => null);
            if (ch && ch.send) {
              const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
              const embed = new EmbedBuilder()
                .setTitle(`Order #${res.id}`)
                .addFields(
                  { name: 'Item / Recipe', value: r.recipe_name || '(unknown)', inline: false },
                  { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Status', value: 'open', inline: true },
                  { name: 'Note', value: note || '-', inline: false }
                )
                .setFooter({ text: `Order created: ${new Date().toISOString()}` });
              const claimBtn = new ButtonBuilder().setCustomId(`order_claim:${res.id}`).setLabel('Claim').setStyle(ButtonStyle.Primary);
              const completeBtn = new ButtonBuilder().setCustomId(`order_complete:${res.id}`).setLabel('Complete').setStyle(ButtonStyle.Success).setDisabled(true);
              const row = new ActionRowBuilder().addComponents(claimBtn, completeBtn);
              const content = ORDERS_PING_ROLE_ID ? `<@&${ORDERS_PING_ROLE_ID}>` : undefined;
              await ch.send({ content, embeds: [embed], components: [row] }).catch(e => debug.error('Failed to post order to channel:', e));
            }
          }
        } catch (e) { debug.error('error posting order to configured channel:', e); }
        return await safeEditReply(interaction, `Order created (#${res.id}) for ${r.recipe_name}.`);
      }

      // Build select menu for user to pick recipe
      const options = results.slice(0, 25).map(r => ({ label: `${r.recipe_name}`.slice(0, 100), value: String(r.id), description: r.item_id ? `Item ${r.item_id}` : undefined }));
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ineed_select').setPlaceholder('Select recipe to order').addOptions(options)
      );
      await safeEditReply(interaction, { content: `Select the recipe to order for "${query}".`, components: [row] });
      const replyMsg = await interaction.fetchReply();
      const filter = i => i.user.id === interaction.user.id && i.customId === 'ineed_select';
      const collector = replyMsg.createMessageComponentCollector({ filter, max: 1, time: 60000 });
      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          const selected = i.values[0];
          const rowObj = results.find(r => String(r.id) === selected);
          if (!rowObj) return await safeEditReply(interaction, 'Selected recipe not found.');
          const out = await db.createOrder({ requesterDiscordId: interaction.user.id, recipeId: rowObj.id, itemId: rowObj.item_id, recipeName: rowObj.recipe_name, note });
          // Post to orders channel if configured
          try {
            const ORDERS_CHANNEL_ID = settings.ORDERS_CHANNEL_ID;
            const ORDERS_PING_ROLE_ID = settings.ORDERS_PING_ROLE_ID;
            if (ORDERS_CHANNEL_ID && interaction.client) {
              const ch = await interaction.client.channels.fetch(ORDERS_CHANNEL_ID).catch(() => null);
              if (ch && ch.send) {
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const embed = new EmbedBuilder()
                  .setTitle(`Order #${out.id}`)
                  .addFields(
                    { name: 'Item / Recipe', value: rowObj.recipe_name || '(unknown)', inline: false },
                    { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Status', value: 'open', inline: true },
                    { name: 'Note', value: note || '-', inline: false }
                  )
                  .setFooter({ text: `Order created: ${new Date().toISOString()}` });
                const claimBtn = new ButtonBuilder().setCustomId(`order_claim:${out.id}`).setLabel('Claim').setStyle(ButtonStyle.Primary);
                const completeBtn = new ButtonBuilder().setCustomId(`order_complete:${out.id}`).setLabel('Complete').setStyle(ButtonStyle.Success).setDisabled(true);
                const row = new ActionRowBuilder().addComponents(claimBtn, completeBtn);
                const content = ORDERS_PING_ROLE_ID ? `<@&${ORDERS_PING_ROLE_ID}>` : undefined;
                await ch.send({ content, embeds: [embed], components: [row] }).catch(e => debug.error('Failed to post order to channel:', e));
              }
            }
          } catch (e) { debug.error('error posting order to configured channel:', e); }
          await replyMsg.edit({ content: `Order created (#${out.id}) for ${rowObj.recipe_name}.`, components: [] });
        } catch (e) { debug.error('ineed collect error:', e); }
      });
      collector.on('end', async () => { try { await replyMsg.edit({ components: [] }); } catch { } });

    } catch (err) {
      debug.error('Error in /ineed:', err);
      return await safeEditReply(interaction, 'An error occurred while creating the order.');
    }
  }
};
