const debug = require('../data/debug');

// Safely reply/edit an interaction, with fallbacks when the interaction has expired.
// Accepts an Interaction and a payload (string or reply options object).
async function safeEditReply(interaction, payload) {
  // Try to update an existing reply first. This avoids attempting a new acknowledgement when one already exists.
  // Then fall back to creating a reply if edit fails because nothing exists. Lastly, fall back to followUp.
  try {
    try {
      return await interaction.editReply(payload);
    } catch (errEdit) {
      // If editReply failed because there was no prior reply, try to send a fresh reply
      // If it failed because the interaction was already acknowledged, don't attempt another reply.
      const code = errEdit && errEdit.code;
      const msg = String(errEdit && (errEdit.message || errEdit));
      if (code === 40060 || msg.toLowerCase().includes('already been acknowledged') || msg.toLowerCase().includes('already acknowledged')) {
        debug.warn('safeEditReply: editReply failed because interaction already acknowledged; not attempting reply.');
        return;
      }
      // Try replying if the interaction hasn't been acknowledged
      try {
        if (!interaction.deferred && !interaction.replied) {
          return await interaction.reply(payload);
        }
      } catch (errReply) {
        const code2 = errReply && errReply.code;
        const msg2 = String(errReply && (errReply.message || errReply));
        if (code2 === 40060 || msg2.toLowerCase().includes('already been acknowledged') || msg2.toLowerCase().includes('already acknowledged')) {
          debug.warn('safeEditReply: reply failed because interaction already acknowledged; skipping followUp.');
          return;
        }
        // Fall through to followUp below
      }

      // Final fallback: try a followUp (works even if original token expired)
      try {
        return await interaction.followUp(typeof payload === 'string' ? { content: payload } : payload);
      } catch (e) {
        debug.error('safeEditReply followUp failed:', e);
        return;
      }
    }
  } catch (err) {
    debug.error('safeEditReply unexpected error:', err);
    try { await interaction.followUp(typeof payload === 'string' ? { content: payload } : payload); } catch { }
    return;
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
