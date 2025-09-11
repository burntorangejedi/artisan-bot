jest.mock('../src/data/debug', () => ({ error: jest.fn(), warn: jest.fn(), log: jest.fn() }));

function makeInteraction() {
  return {
    reply: jest.fn(async () => {}),
  };
}

test('help replies with content', async () => {
  const cmd = require('../src/commands/help');
  await cmd.execute(makeInteraction());
});
