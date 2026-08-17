const Database = require('better-sqlite3');
const path = require('path');

const dbFilePath = path.join(__dirname, '../database/fsarap.sqlite');
const db = new Database(dbFilePath);

// Add lecturer_id column if missing
try {
  db.exec('ALTER TABLE courses ADD COLUMN lecturer_id TEXT;');
  console.log('✅ Added lecturer_id column to courses table');
} catch (e) {
  console.log('ℹ️  lecturer_id column already exists');
}

// Set lecturer_id for all existing courses
const updated = db.prepare('UPDATE courses SET lecturer_id = ? WHERE lecturer_id IS NULL').run('usr-lec-1');
console.log(`✅ Updated ${updated.changes} course(s) with lecturer_id`);

// Insert sample materials
try {
  db.prepare(`
    INSERT OR IGNORE INTO materials 
    (id, title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'mat-1',
    'CSC 111 Comprehensive Lecture Notes',
    'Introduction to computer science fundamentals, boolean logic, and algorithms.',
    'crs-csc111', 'dept-1', 'lvl-100', 'sem-1', 'sess-2025-2026', 'usr-lec-1',
    'Lecture Notes', '/uploads/CSC111_Notes.pdf', 'CSC/100L/CSC111_Notes.pdf', 'pdf', 2450000, 'approved'
  );
  console.log('✅ Inserted material: CSC 111 Lecture Notes');
} catch (e) {
  console.log('ℹ️  mat-1 already exists:', e.message);
}

try {
  db.prepare(`
    INSERT OR IGNORE INTO materials
    (id, title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'mat-2',
    'MCB 211 General Microbiology Manual',
    'Practical guide for general microbiology techniques and microscopy.',
    'crs-mcb211', 'dept-2', 'lvl-200', 'sem-1', 'sess-2025-2026', 'usr-lec-1',
    'Lab Guides', '/uploads/MCB211_Manual.pdf', 'MCB/200L/MCB211_Manual.pdf', 'pdf', 1850000, 'approved'
  );
  console.log('✅ Inserted material: MCB 211 Manual');
} catch (e) {
  console.log('ℹ️  mat-2 already exists:', e.message);
}

try {
  db.prepare(`
    INSERT OR IGNORE INTO materials
    (id, title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'mat-3',
    'CSC 311 Data Structures Past Questions',
    'Past examination questions for Data Structures and Algorithms 2019-2024.',
    'crs-csc311', 'dept-1', 'lvl-300', 'sem-1', 'sess-2025-2026', 'usr-lec-1',
    'Past Questions', '/uploads/CSC311_PastQ.pdf', 'CSC/300L/CSC311_PastQ.pdf', 'pdf', 1200000, 'approved'
  );
  console.log('✅ Inserted material: CSC 311 Past Questions');
} catch (e) {
  console.log('ℹ️  mat-3 already exists:', e.message);
}

console.log('\n📊 Current database summary:');
console.log('   Courses:', db.prepare('SELECT count(*) as c FROM courses').get().c);
console.log('   Materials:', db.prepare('SELECT count(*) as c FROM materials').get().c);
console.log('   Quizzes:', db.prepare('SELECT count(*) as c FROM quizzes').get().c);
console.log('   Users:', db.prepare('SELECT count(*) as c FROM users').get().c);

db.close();
console.log('\n✅ Database patch complete!');
