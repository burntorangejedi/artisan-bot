jest.mock('../src/data/platform/sqlite/db_sqlite', () => ({ searchCraftersByRecipeName: jest.fn(), searchCraftersByItemId: jest.fn() }));
jest.mock('../src/data/debug', () => ({ error: jest.fn(), warn: jest.fn(), log: jest.fn(), verbose: jest.fn() }));

const db = require('../src/data/platform/sqlite/db_sqlite');

function makeInteraction() {
  return {
    options: { getString: () => 'Test Recipe' },
    deferReply: jest.fn(async () => {}),
    editReply: jest.fn(async () => {}),
    fetchReply: jest.fn(async () => ({ createMessageComponentCollector: () => ({ on: () => {} }), edit: async () => {} })),
    client: { users: { fetch: async () => null } },
    guild: null,
    user: { id: 'user1' }
  };
}

test('whohas basic path executes', async () => {
  db.searchCraftersByRecipeName.mockImplementation((arg, cb) => cb(null, [{ member: 'Bob', profession: 'Blacksmith', max_skill_level: 300, discord_id: null, recipe_name: 'Test Recipe' }]));
  const cmd = require('../src/commands/whohas');
  await cmd.execute(makeInteraction());
});
