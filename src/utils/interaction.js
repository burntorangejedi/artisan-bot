const debug = require('../data/debug');

// Safely reply/edit an interaction, with fallbacks when the interaction has expired.
// Accepts an Interaction and a payload (string or reply options object).
async function safeEditReply(interaction, payload) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply(payload);
    }
    return await interaction.editReply(payload);
  } catch (err) {
    debug.error('safeEditReply failed:', err);
    try {
      return await interaction.followUp(typeof payload === 'string' ? { content: payload } : payload);
    } catch (e) {
      return;
    }
  }
}

module.exports = { safeEditReply };

// Safely handle message component updates (button interactions).
// Tries i.update(payload). If that fails (interaction expired/invalid), falls back to deferUpdate() and edits the original reply message.
async function safeComponentUpdate(i, replyMsg, payload) {
  try {
    return await i.update(payload);
  } catch (err) {
    debug.error('safeComponentUpdate i.update failed, falling back to deferUpdate+edit:', err);
    try {
      await i.deferUpdate();
      return await replyMsg.edit(payload);
    } catch (e) {
      debug.error('safeComponentUpdate fallback failed:', e);
      return;
    }
  }
}

module.exports = { safeEditReply, safeComponentUpdate };
