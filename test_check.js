const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../database/fsarap.sqlite'));

const users = db.prepare("SELECT * FROM users").all();
for (const u of users) {
  console.log(`User: ${u.id} | Email: ${u.email} | Role: ${u.role} | Name: ${u.first_name || ''} ${u.last_name || ''}`);
}

db.close();
