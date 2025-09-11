jest.mock('../src/data/db', () => ({ getCharactersByProfession: jest.fn(), getCharactersByRole: jest.fn(), getCharactersByClass: jest.fn(), getClaimedCharacters: jest.fn(), getUnclaimedCharacters: jest.fn() }));
jest.mock('../src/data/debug', () => ({ error: jest.fn(), warn: jest.fn(), log: jest.fn(), verbose: jest.fn() }));

const db = require('../src/data/db');

function makeInteraction() {
  return {
    options: { getSubcommand: () => 'profession', getString: () => 'Blacksmith' },
    deferReply: jest.fn(async () => {}),
    fetchReply: jest.fn(async () => ({ createMessageComponentCollector: () => ({ on: () => {} }), edit: async () => {} })),
    guild: null,
    user: { id: 'user1' }
  };
}

test('guild profession executes', async () => {
  db.getCharactersByProfession.mockImplementation((profession, cb) => cb(null, [{ name: 'CharA', class: 'Warrior', spec: 'Arms', role: 'Melee DPS', discord_id: null }]));
  const cmd = require('../src/commands/guild');
  await cmd.execute(makeInteraction());
});
