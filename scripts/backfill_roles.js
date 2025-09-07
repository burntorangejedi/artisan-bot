const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const roles = require('../src/constants/roles');
const dbPath = path.resolve(__dirname, '..', 'guilddata.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Backfilling roles in DB:', dbPath);

db.serialize(() => {
  db.all(`SELECT id, name, class, spec, role FROM guild_members WHERE role IS NULL OR role = ''`, [], (err, rows) => {
    if (err) { console.error('SELECT error:', err); process.exit(1); }
    console.log('Candidates to backfill:', rows.length);
    let updated = 0;
    let attempted = 0;
    const updates = [];
    for (const r of rows) {
      attempted++;
      const derived = roles.getMainRoleForSpecClass(r.spec || '', r.class || '');
      if (derived) {
        updates.push({ id: r.id, role: derived });
      }
    }

    if (!updates.length) {
      console.log('No derived roles available to update.');
      db.close();
      return;
    }

    console.log('Will update', updates.length, 'rows. Beginning transaction...');
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('UPDATE guild_members SET role = ? WHERE id = ?');
    for (const u of updates) {
      stmt.run([u.role, u.id], function (err2) {
        if (err2) console.error('UPDATE error for id', u.id, err2);
        else if (this && this.changes) updated++;
      });
    }
    stmt.finalize(err3 => {
      if (err3) console.error('Finalize error:', err3);
      db.run('COMMIT', () => {
        console.log(`Backfill complete. attempted=${attempted}, updated=${updated}`);
        db.close();
      });
    });
  });
});
