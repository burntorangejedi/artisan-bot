// Mock the DB module before any code requires it (avoids loading unrelated modules)
jest.mock('../src/data/platform/sqlite/db_sqlite', () => ({ createOrder: jest.fn(), searchRecipesByName: jest.fn(), searchRecipesByItemId: jest.fn() }));
jest.mock('../src/data/debug', () => ({ error: jest.fn(), warn: jest.fn(), log: jest.fn() }));

const db = require('../src/data/platform/sqlite/db_sqlite');
const settings = require('../src/settings');
const debug = require('../src/data/debug');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Minimal mock channel
class MockChannel {
  constructor() { this.sent = []; }
  async send(payload) { this.sent.push(payload); return { id: 'msg123', ...payload }; }
}

// Minimal mock client
class MockClient {
  constructor(channel) { this._channel = channel; this.channels = { fetch: async (id) => this._channel }; }
}

// Fake interaction object used by ineed
function makeMockInteraction(client, userId = 'user1') {
  let replied = false;
  return {
    user: { id: userId, tag: 'TestUser#0001' },
    client,
    options: { getString: (k) => { if (k === 'query') return 'Test Recipe'; if (k === 'note') return 'Please make 1'; return null; } },
    deferReply: jest.fn(async () => { replied = true; }),
    editReply: jest.fn(async (payload) => { replied = true; return payload; }),
    reply: jest.fn(async (payload) => { replied = true; return payload; }),
    fetchReply: jest.fn(async () => ({ createMessageComponentCollector: () => ({ on: () => {} }), edit: async () => {} })),
  };
}

describe('ineed posting', () => {
  test('creates order and posts to configured channel with ping', async () => {
    // Arrange
    const mockChannel = new MockChannel();
    const client = new MockClient(mockChannel);
    // Set settings via env override for the test
    process.env.ORDERS_CHANNEL_ID = 'chan123';
    process.env.ORDERS_PING_ROLE_ID = 'role456';

  // Mock DB createOrder and search result
  db.createOrder.mockResolvedValue({ id: 42 });
  db.searchRecipesByName.mockResolvedValue([{ id: 1, recipe_name: 'Test Recipe', item_id: 999 }]);
    // Load the command module freshly and run it
    await jest.isolateModulesAsync ? await jest.isolateModulesAsync(async () => {
      const ineed = require('../src/commands/ineed');
      await ineed.execute(makeMockInteraction(client));
    }) : await (async () => { const ineed = require('../src/commands/ineed'); await ineed.execute(makeMockInteraction(client)); })();

    // Assert: channel got a message with embed and content ping
    expect(mockChannel.sent.length).toBeGreaterThanOrEqual(1);
    const posted = mockChannel.sent[0];
    expect(posted.content).toBe('<@&role456>');
    expect(posted.embeds).toBeDefined();
    expect(posted.components).toBeDefined();
  });
});
