const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'guilddata.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Using DB:', dbPath);

db.all(`SELECT role, COUNT(*) as cnt FROM guild_members GROUP BY role ORDER BY cnt DESC`, [], (err, rows) => {
  if (err) {
    console.error('Error querying roles:', err);
    process.exit(1);
  }
  console.log('Distinct roles and counts:');
  console.table(rows);
  db.all(`SELECT name, class, spec, role FROM guild_members LIMIT 30`, [], (err2, rows2) => {
    if (err2) {
      console.error('Error querying sample rows:', err2);
      process.exit(1);
    }
    console.log('Sample rows (name, role):');
    console.table(rows2);
    db.close();
  });
});
