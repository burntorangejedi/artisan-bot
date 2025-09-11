jest.mock('../src/data/platform/sqlite/db_sqlite', () => ({ listOpenOrders: jest.fn(), listOrdersForRequester: jest.fn(), startOrder: jest.fn(), completeOrder: jest.fn() }));
jest.mock('../src/data/debug', () => ({ error: jest.fn(), warn: jest.fn(), log: jest.fn(), verbose: jest.fn() }));

const db = require('../src/data/platform/sqlite/db_sqlite');

function makeBaseInteraction(sub) {
  return {
    options: { getSubcommand: () => sub, getInteger: () => 1, getString: () => 'note' },
    deferReply: jest.fn(async () => {}),
    editReply: jest.fn(async () => {}),
    fetchReply: jest.fn(async () => ({ createMessageComponentCollector: () => ({ on: () => {} }), edit: async () => {} })),
    channel: { send: jest.fn(async () => ({ createMessageComponentCollector: () => ({ on: () => {} }) })) },
    user: { id: 'user1', tag: 'User#0001' },
  };
}

test('orders list posts messages', async () => {
  db.listOpenOrders.mockResolvedValue([{ id: 1, recipe_name: 'R1', requester_discord_id: 'userA', note: 'n', status: 'open', created_at: new Date().toISOString() }]);
  const cmd = require('../src/commands/orders');
  await cmd.execute(makeBaseInteraction('list'));
});

test('orders my lists requester orders', async () => {
  db.listOrdersForRequester.mockResolvedValue([{ id: 2, recipe_name: 'R2', status: 'open', note: '' }]);
  const cmd = require('../src/commands/orders');
  await cmd.execute(makeBaseInteraction('my'));
});

test('orders start and complete flow basic', async () => {
  db.startOrder.mockResolvedValue({ changes: 1 });
  db.completeOrder.mockResolvedValue({ changes: 1 });
  const cmd = require('../src/commands/orders');
  await cmd.execute(makeBaseInteraction('start'));
  await cmd.execute(makeBaseInteraction('complete'));
});
