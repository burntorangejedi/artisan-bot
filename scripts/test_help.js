// Simple test harness to invoke the /help command handler locally
(async () => {
  try {
    const help = require('../src/commands/help');
    // Mock interaction with reply method
    const called = [];
    const interaction = {
      reply: async (opts) => {
        called.push(opts);
        console.log('reply called with:', opts && (opts.content ? opts.content.substring(0,200) : JSON.stringify(opts)));
      }
    };
    await help.execute(interaction);
    console.log('done. reply count:', called.length);
  } catch (e) {
    console.error('test_help error:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
