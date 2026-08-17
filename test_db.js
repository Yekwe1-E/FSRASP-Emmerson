const Database = require('better-sqlite3');
const dbFilePath = 'C:\\Users\\hp\\OneDrive\\Desktop\\ALazigha\\database\\fsarap.sqlite';
const db = new Database(dbFilePath);
const id = 'q-1';
const studentId = 'usr-stu-1';

const rows = db.prepare(`SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?`).all([id, studentId]);

console.log("Rows returned:", rows);
console.log("Count value:", rows[0].count);

const attemptNum = parseInt(rows[0].count) + 1;
console.log("attemptNum inside logic:", attemptNum);

db.close();
