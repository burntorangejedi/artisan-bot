const { SlashCommandBuilder } = require('discord.js');
const db = require('../data/platform/sqlite/db_sqlite');
const debug = require('../data/debug');
const { safeEditReply } = require('../utils/interaction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orders')
    .setDescription('Manage in-need orders')
    .addSubcommand(sub => sub.setName('list').setDescription('List open orders'))
    .addSubcommand(sub => sub.setName('my').setDescription('List your orders'))
    .addSubcommand(sub => sub.setName('start').setDescription('Start an open order').addIntegerOption(o => o.setName('id').setDescription('Order ID').setRequired(true)).addStringOption(o => o.setName('note').setDescription('Optional start note')))
    .addSubcommand(sub => sub.setName('complete').setDescription('Complete an order you started').addIntegerOption(o => o.setName('id').setDescription('Order ID').setRequired(true)).addStringOption(o => o.setName('note').setDescription('Optional completion note'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try { await interaction.deferReply({ flags: 64 }); } catch (e) { }
    try {
      if (sub === 'list') {
        const rows = await db.listOpenOrders();
        if (!rows.length) return await safeEditReply(interaction, 'No open orders.');
        // Post up to 10 public messages in the current channel with Claim buttons
        try {
          await interaction.editReply({ content: `Posting ${rows.length} open orders (max 10) to this channel...` });
        } catch { }
        const toPost = rows.slice(0, 10);
        for (const ord of toPost) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle(`Order #${ord.id}`)
            .addFields(
              { name: 'Item / Recipe', value: ord.recipe_name || '(unknown)', inline: false },
              { name: 'Requested by', value: `<@${ord.requester_discord_id}>`, inline: true },
              { name: 'Status', value: ord.status, inline: true },
              { name: 'Note', value: ord.note || '-', inline: false }
            )
            .setFooter({ text: `Order created: ${ord.created_at}` });

          const claimBtn = new ButtonBuilder().setCustomId(`order_claim:${ord.id}`).setLabel('Claim').setStyle(ButtonStyle.Primary);
          const completeBtn = new ButtonBuilder().setCustomId(`order_complete:${ord.id}`).setLabel('Complete').setStyle(ButtonStyle.Success).setDisabled(true);
          const row = new ActionRowBuilder().addComponents(claimBtn, completeBtn);
          const posted = await interaction.channel.send({ embeds: [embed], components: [row] });

          // Create a component collector for this message
          const filter = i => (i.customId === `order_claim:${ord.id}` || i.customId === `order_complete:${ord.id}`);
          const collector = posted.createMessageComponentCollector({ filter, time: 24 * 60 * 60 * 1000 }); // 24h
          collector.on('collect', async i => {
            try {
              // Claim flow
              if (i.customId === `order_claim:${ord.id}`) {
                // Attempt to start the order in DB; only succeeds if still open
                const res = await db.startOrder(ord.id, i.user.id, null);
                if (!res || !res.changes) {
                  try { await i.reply({ content: `Unable to claim order #${ord.id}. It may already be claimed.`, flags: 64 }); } catch { }
                  return;
                }
                // Update message: show claimed by and enable Complete button, disable Claim
                const { EmbedBuilder: EB, ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
                const updatedEmbed = new EB()
                  .setTitle(`Order #${ord.id}`)
                  .addFields(
                    { name: 'Item / Recipe', value: ord.recipe_name || '(unknown)', inline: false },
                    { name: 'Requested by', value: `<@${ord.requester_discord_id}>`, inline: true },
                    { name: 'Status', value: `in_progress (claimed by <@${i.user.id}>)`, inline: true },
                    { name: 'Note', value: ord.note || '-', inline: false }
                  )
                  .setFooter({ text: `Claimed by ${i.user.tag} at ${new Date().toISOString()}` });
                const claimBtn2 = new BB().setCustomId(`order_claim:${ord.id}`).setLabel('Claim').setStyle(BS.Primary).setDisabled(true);
                const completeBtn2 = new BB().setCustomId(`order_complete:${ord.id}`).setLabel('Complete').setStyle(BS.Success).setDisabled(false);
                const row2 = new ARB().addComponents(claimBtn2, completeBtn2);
                try {
                  await i.update({ embeds: [updatedEmbed], components: [row2] });
                } catch (e) {
                  try { await posted.edit({ embeds: [updatedEmbed], components: [row2] }); } catch { }
                }
              }

              // Complete flow
              if (i.customId === `order_complete:${ord.id}`) {
                // Only the crafter who started the order should complete it; ensure DB enforces that
                const res = await db.completeOrder(ord.id, i.user.id, null);
                if (!res || !res.changes) {
                  try { await i.reply({ content: `Unable to complete order #${ord.id}. It may not be in progress or you may not be the assigned crafter.`, flags: 64 }); } catch { }
                  return;
                }
                const { EmbedBuilder: EB2, ActionRowBuilder: ARB2, ButtonBuilder: BB2, ButtonStyle: BS2 } = require('discord.js');
                const completedEmbed = new EB2()
                  .setTitle(`Order #${ord.id}`)
                  .addFields(
                    { name: 'Item / Recipe', value: ord.recipe_name || '(unknown)', inline: false },
                    { name: 'Requested by', value: `<@${ord.requester_discord_id}>`, inline: true },
                    { name: 'Status', value: `completed by <@${i.user.id}>`, inline: true },
                    { name: 'Note', value: ord.note || '-', inline: false }
                  )
                  .setFooter({ text: `Completed by ${i.user.tag} at ${new Date().toISOString()}` });
                const claimBtn3 = new BB2().setCustomId(`order_claim:${ord.id}`).setLabel('Claim').setStyle(BS2.Primary).setDisabled(true);
                const completeBtn3 = new BB2().setCustomId(`order_complete:${ord.id}`).setLabel('Complete').setStyle(BS2.Success).setDisabled(true);
                const row3 = new ARB2().addComponents(claimBtn3, completeBtn3);
                try {
                  await i.update({ embeds: [completedEmbed], components: [row3] });
                } catch (e) {
                  try { await posted.edit({ embeds: [completedEmbed], components: [row3] }); } catch { }
                }
              }
            } catch (e) {
              debug.error('Order button handler error:', e);
            }
          });
        }
        return;
      }
      if (sub === 'my') {
        const rows = await db.listOrdersForRequester(interaction.user.id);
        if (!rows.length) return await safeEditReply(interaction, 'You have no orders.');
        const lines = rows.map(r => `#${r.id} - ${r.recipe_name || '(unknown)'} - status: ${r.status} - note: ${r.note || '-'} created: ${r.created_at}`);
        return await safeEditReply(interaction, { content: 'Your orders:\n' + lines.join('\n') });
      }
      if (sub === 'start') {
        const id = interaction.options.getInteger('id');
        const note = interaction.options.getString('note');
        const res = await db.startOrder(id, interaction.user.id, note);
        if (!res || !res.changes) return await safeEditReply(interaction, `Failed to start order #${id}. It may not be open.`);
        return await safeEditReply(interaction, `You started order #${id}.`);
      }
      if (sub === 'complete') {
        const id = interaction.options.getInteger('id');
        const note = interaction.options.getString('note');
        const res = await db.completeOrder(id, interaction.user.id, note);
        if (!res || !res.changes) return await safeEditReply(interaction, `Failed to complete order #${id}. It may not be in progress or owned by you.`);
        return await safeEditReply(interaction, `Order #${id} marked complete.`);
      }
    } catch (err) {
      debug.error('Error in /orders:', err);
      return await safeEditReply(interaction, 'An error occurred while managing orders.');
    }
  }
};
