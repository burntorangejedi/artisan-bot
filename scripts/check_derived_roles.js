const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const roles = require('../src/constants/roles');
const dbPath = path.resolve(__dirname, '..', 'guilddata.sqlite');
const db = new sqlite3.Database(dbPath);

db.all(`SELECT name, class, spec FROM guild_members`, [], (err, rows) => {
  if (err) { console.error(err); process.exit(1); }
  let healerCount = 0;
  const samples = [];
  for (const r of rows) {
    const derived = roles.getMainRoleForSpecClass(r.spec || '', r.class || '');
    if (String(derived || '').toLowerCase() === 'healer') healerCount++;
    if (samples.length < 10) samples.push({ name: r.name, class: r.class, spec: r.spec, derived });
  }
  console.log('Derived Healer count:', healerCount);
  console.table(samples);
  db.close();
});
