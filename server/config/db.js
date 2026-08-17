const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let mode = 'sqlite';
let pool = null;
let sqliteDb = null;

// Path for offline SQLite database file
const dbFilePath = path.join(__dirname, '../../database/fsarap.sqlite');
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Use PostgreSQL only if DATABASE_URL is set to a real, non-placeholder value
const usePostgres = process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('your-supabase') &&
  !process.env.DATABASE_URL.includes('localhost:5432/fsarap') &&
  !process.env.DATABASE_URL.includes('[YOUR-PASSWORD]') &&
  !process.env.DATABASE_URL.includes('[YOUR_PASSWORD]');

// Always initialize SQLite database as instant standby fallback
console.log(`\n📁 Initializing Database Engine...\n   SQLite Database: ${dbFilePath}`);
sqliteDb = new Database(dbFilePath);
sqliteDb.pragma('foreign_keys = ON');
sqliteDb.pragma('journal_mode = WAL');
initOfflineSQLiteSchema(sqliteDb);

if (usePostgres) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 1500,
      statement_timeout: 2000
    });
    pool.on('error', (err) => {
      console.warn('⚠️ PostgreSQL Connection Notice (using local fallback):', err.message);
      mode = 'sqlite';
    });
    mode = 'postgres';
    console.log('🔗 Configured for Remote Supabase PostgreSQL Connection.');
  } catch (e) {
    console.warn('⚠️ Failed to initialize PostgreSQL pool. Using local database.');
    mode = 'sqlite';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID helper for SQLite
// ─────────────────────────────────────────────────────────────────────────────
function generateUUID() {
  const bytes = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  const b4 = () => `${bytes()}${bytes()}${bytes()}${bytes()}`;
  const b2 = () => `${bytes()}${bytes()}`;
  return `${b4()}-${b2()}-4${bytes().slice(1)}-${['8','9','a','b'][Math.floor(Math.random()*4)]}${bytes().slice(1)}-${b4()}${b2()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform PostgreSQL SQL to SQLite dialect
// ─────────────────────────────────────────────────────────────────────────────
function transformSQL(sql) {
  return sql
    .replace(/gen_random_uuid\(\)/gi, "'__UUID__'")       // placeholder, replaced at runtime
    .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
    .replace(/\$(\d+)/g, '?')
    .replace(/::[\w_]+/g, '')                              // strip postgres casts
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bTRUE\b/g, '1')                             // SQLite boolean
    .replace(/\bFALSE\b/g, '0')                            // SQLite boolean
    .replace(/RETURNING\s+[\s\S]+$/i, '');                 // strip RETURNING clause
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal query function
// ─────────────────────────────────────────────────────────────────────────────
const query = async (text, params = []) => {
  if (mode === 'postgres' && pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.warn(`⚠️ Remote database connection timeout/notice (${err.message}). Using local database standby.`);
      mode = 'sqlite';
    }
  }

  const hasReturning = /RETURNING/i.test(text);
  const isInsert = /^\s*INSERT/i.test(text);
  const isUpdate = /^\s*UPDATE/i.test(text);
  const isSelect = /^\s*(SELECT|PRAGMA|WITH)/i.test(text);
  const isDelete = /^\s*DELETE/i.test(text);

  // Replace gen_random_uuid() in SQL with a real UUID
  const newId = generateUUID();
  let transformedSQL = transformSQL(text).replace(/'__UUID__'/g, `'${newId}'`);

  // Replace params placeholders one by one and convert boolean values for SQLite compatibility
  let paramArray = params.map(val => typeof val === 'boolean' ? (val ? 1 : 0) : val);

  try {
    if (isSelect) {
      const rows = sqliteDb.prepare(transformedSQL).all(paramArray);
      const converted = rows.map(convertBooleans);
      return { rows: converted, rowCount: converted.length };
    }

    const stmt = sqliteDb.prepare(transformedSQL);
    const info = stmt.run(paramArray);

    if (!hasReturning) {
      return { rows: [], rowCount: info.changes };
    }

    // Emulate RETURNING: fetch inserted/updated row
    let returnedRows = [];
    if (isInsert) {
      // Try fetching by known id parameter, or use lastInsertRowid
      const tableName = getTableName(text);
      if (tableName) {
        // The inserted id was either in params or was the generated UUID
        const idToFetch = text.includes('gen_random_uuid()') ? newId : (paramArray[0] || null);
        if (idToFetch) {
          returnedRows = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).all(idToFetch);
        } else {
          returnedRows = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).all(info.lastInsertRowid);
        }
      }
    } else if (isUpdate || isDelete) {
      const tableName = getTableName(text);
      // For updates, last param is usually the id (WHERE id = $n)
      const idParam = paramArray[paramArray.length - 1];
      if (tableName && idParam) {
        returnedRows = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).all(idParam);
      }
    }

    return { rows: returnedRows.map(convertBooleans), rowCount: info.changes };

  } catch (error) {
    console.error('SQLite Query Error:', error.message);
    console.error('Original SQL:', text);
    console.error('Transformed SQL:', transformedSQL);
    console.error('Params:', paramArray);
    throw error;
  }
};

function getTableName(sql) {
  let m = sql.match(/INSERT\s+INTO\s+"?(\w+)"?/i);
  if (m) return m[1];
  m = sql.match(/UPDATE\s+"?(\w+)"?/i);
  if (m) return m[1];
  m = sql.match(/DELETE\s+FROM\s+"?(\w+)"?/i);
  if (m) return m[1];
  return null;
}

function convertBooleans(row) {
  const boolCols = ['is_approved', 'is_active', 'passed', 'is_bookmarked', 'is_correct',
                    'is_current', 'randomize_questions', 'randomize_options',
                    'show_explanation', 'is_active', 'is_read'];
  const out = { ...row };
  boolCols.forEach(k => {
    if (k in out) out[k] = Boolean(out[k]);
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline SQLite Schema + Seed
// ─────────────────────────────────────────────────────────────────────────────
function initOfflineSQLiteSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS academic_levels (
      id TEXT PRIMARY KEY,
      level_code TEXT UNIQUE NOT NULL,
      level_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      code TEXT
    );

    CREATE TABLE IF NOT EXISTS academic_sessions (
      id TEXT PRIMARY KEY,
      session_name TEXT UNIQUE NOT NULL,
      is_current INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      department_id TEXT,
      level_id TEXT,
      staff_id TEXT,
      matric_number TEXT,
      avatar_url TEXT,
      is_approved INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      course_code TEXT UNIQUE NOT NULL,
      course_title TEXT NOT NULL,
      credit_units INTEGER NOT NULL DEFAULT 3,
      department_id TEXT NOT NULL,
      level_id TEXT NOT NULL,
      semester_id TEXT NOT NULL,
      lecturer_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      course_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      level_id TEXT NOT NULL,
      semester_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Lecture Notes',
      file_url TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      download_count INTEGER DEFAULT 0,
      approval_status TEXT DEFAULT 'approved',
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS material_bookmarks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      material_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(material_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS material_downloads (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      material_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      downloaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      course_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 30,
      total_marks REAL DEFAULT 100,
      pass_percentage REAL DEFAULT 50.0,
      max_attempts INTEGER DEFAULT 3,
      randomize_questions INTEGER DEFAULT 1,
      randomize_options INTEGER DEFAULT 1,
      show_explanation INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT DEFAULT 'mcq',
      marks REAL DEFAULT 1.0,
      difficulty TEXT DEFAULT 'medium',
      explanation TEXT,
      correct_answer_text TEXT,
      order_index INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quiz_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      submitted_at TEXT,
      score_achieved REAL DEFAULT 0,
      percentage REAL DEFAULT 0,
      passed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'in_progress'
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      selected_option_id TEXT,
      text_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      marks_awarded REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  try {
    db.exec(`ALTER TABLE courses ADD COLUMN lecturer_id TEXT;`);
  } catch (e) {
    // Column already exists
  }

  // Only seed if departments table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM departments').get().c;
  if (count > 0) return;

  console.log('🌱 Seeding offline SQLite database with Faculty of Science data...');

  const u = (pre) => `${pre}-${generateUUID().slice(0, 8)}`;

  // Departments
  const depts = [
    ['11111111-1111-1111-1111-111111111111', 'Department of Computer Science', 'CSC', 'Computer Science, Cyber Security & Software Engineering'],
    ['22222222-2222-2222-2222-222222222222', 'Department of Microbiology', 'MCB', 'Microbiology, Environmental & Medical Microbiology'],
    ['33333333-3333-3333-3333-333333333333', 'Department of Biochemistry', 'BCH', 'Biochemistry & Molecular Biology'],
    ['44444444-4444-4444-4444-444444444444', 'Department of Pure and Applied Chemistry', 'CHM', 'Analytical & Organic Chemistry'],
    ['55555555-5555-5555-5555-555555555555', 'Department of Physics', 'PHY', 'Physics, Geophysics & Electronics'],
    ['66666666-6666-6666-6666-666666666666', 'Department of Geology', 'GLY', 'Geology & Petroleum Geosciences'],
    ['77777777-7777-7777-7777-777777777777', 'Department of Biological Sciences', 'BIO', 'Plant Science, Zoology & Marine Biology']
  ];
  const ins_dept = db.prepare('INSERT OR IGNORE INTO departments (id, name, code, description) VALUES (?, ?, ?, ?)');
  depts.forEach(d => ins_dept.run(d));

  // Academic Levels
  const levels = [
    ['10000000-0000-0000-0000-000000000100', '100', '100 Level'],
    ['20000000-0000-0000-0000-000000000200', '200', '200 Level'],
    ['30000000-0000-0000-0000-000000000300', '300', '300 Level'],
    ['40000000-0000-0000-0000-000000000400', '400', '400 Level'],
    ['50000000-0000-0000-0000-000000000500', '500', '500 Level']
  ];
  const ins_level = db.prepare('INSERT OR IGNORE INTO academic_levels (id, level_code, level_name) VALUES (?, ?, ?)');
  levels.forEach(l => ins_level.run(l));

  // Semesters
  db.prepare('INSERT OR IGNORE INTO semesters (id, name, code) VALUES (?, ?, ?)').run('e1111111-1111-1111-1111-111111111111', 'First Semester', 'SEM1');
  db.prepare('INSERT OR IGNORE INTO semesters (id, name, code) VALUES (?, ?, ?)').run('e2222222-2222-2222-2222-222222222222', 'Second Semester', 'SEM2');

  // Academic Sessions
  db.prepare('INSERT OR IGNORE INTO academic_sessions (id, session_name, is_current) VALUES (?, ?, ?)').run('a1111111-1111-1111-1111-111111111111', '2024/2025', 1);

  // Default Accounts (password: Password123!)
  const hash = bcrypt.hashSync('Password123!', 10);

  db.prepare(`INSERT OR IGNORE INTO users (id,email,password_hash,first_name,last_name,role,is_approved,is_active)
              VALUES (?,?,?,?,?,?,1,1)`)
    .run('u1111111-1111-1111-1111-111111111111', 'admin@ndu.edu.ng', hash, 'Super', 'Administrator', 'super_admin');

  db.prepare(`INSERT OR IGNORE INTO users (id,email,password_hash,first_name,last_name,role,department_id,staff_id,is_approved,is_active)
              VALUES (?,?,?,?,?,?,?,?,1,1)`)
    .run('u2222222-2222-2222-2222-222222222222', 'lecturer@ndu.edu.ng', hash, 'Dr. Ebimowei', 'Oboro', 'lecturer', '11111111-1111-1111-1111-111111111111', 'NDU/STAFF/CSC/042');

  db.prepare(`INSERT OR IGNORE INTO users (id,email,password_hash,first_name,last_name,role,department_id,level_id,matric_number,is_approved,is_active)
              VALUES (?,?,?,?,?,?,?,?,?,1,1)`)
    .run('u3333333-3333-3333-3333-333333333333', 'student@ndu.edu.ng', hash, 'Tari', 'Ebi', 'student', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000300', 'NDU/2022/CSC/015');

  // Courses (All 8 Departments)
  const addCourse = (id, code, title, units, dept, lvl, sem) => {
    db.prepare(`INSERT OR IGNORE INTO courses (id,course_code,course_title,credit_units,department_id,level_id,semester_id,lecturer_id)
                VALUES (?,?,?,?,?,?,?,?)`).run(id, code, title, units, dept, lvl, sem, 'usr-lec-1');
  };

  // Computer Science
  addCourse('crs-csc111', 'CSC 111', 'Introduction to Computer Science & Algorithms', 3, 'dept-1', 'lvl-100', 'sem-1');
  addCourse('crs-csc212', 'CSC 212', 'Object-Oriented Programming (C++ & Java)', 3, 'dept-1', 'lvl-200', 'sem-2');
  addCourse('crs-csc311', 'CSC 311', 'Data Structures and Algorithms II', 3, 'dept-1', 'lvl-300', 'sem-1');
  addCourse('crs-csc411', 'CSC 411', 'Operating Systems Architecture', 3, 'dept-1', 'lvl-400', 'sem-1');
  addCourse('crs-csc415', 'CSC 415', 'Computer Systems Performance & Evaluation', 3, 'dept-1', 'lvl-400', 'sem-1');

  // Microbiology
  addCourse('crs-mcb211', 'MCB 211', 'General Microbiology I', 3, 'dept-2', 'lvl-200', 'sem-1');
  addCourse('crs-mcb312', 'MCB 312', 'Environmental & Aquatic Microbiology', 3, 'dept-2', 'lvl-300', 'sem-2');
  addCourse('crs-mcb411', 'MCB 411', 'Medical Microbiology & Diagnostic Pathology', 3, 'dept-2', 'lvl-400', 'sem-1');

  // Biochemistry
  addCourse('crs-bch201', 'BCH 201', 'General Biochemistry & Biomolecules', 3, 'dept-3', 'lvl-200', 'sem-1');
  addCourse('crs-bch311', 'BCH 311', 'Enzymology & Intermediary Metabolism', 3, 'dept-3', 'lvl-300', 'sem-1');

  // Pure & Applied Chemistry
  addCourse('crs-chm101', 'CHM 101', 'General Chemistry I', 3, 'dept-4', 'lvl-100', 'sem-1');
  addCourse('crs-chm211', 'CHM 211', 'Organic Chemistry I & Mechanisms', 3, 'dept-4', 'lvl-200', 'sem-1');

  // Physics
  addCourse('crs-phy101', 'PHY 101', 'General Physics I - Mechanics & Hydrostatics', 3, 'dept-5', 'lvl-100', 'sem-1');
  addCourse('crs-phy211', 'PHY 211', 'Electromagnetism & Circuit Theory', 3, 'dept-5', 'lvl-200', 'sem-1');

  // Geology
  addCourse('crs-gly101', 'GLY 101', 'Introduction to Physical Geology', 3, 'dept-6', 'lvl-100', 'sem-1');
  addCourse('crs-gly315', 'GLY 315', 'Structural Geology & Tectonics', 3, 'dept-6', 'lvl-300', 'sem-1');

  // Mathematics & Statistics
  addCourse('crs-mth110', 'MTH 110', 'Elementary Mathematics I (Algebra & Trig)', 3, 'dept-7', 'lvl-100', 'sem-1');
  addCourse('crs-mth211', 'MTH 211', 'Mathematical Methods I', 3, 'dept-7', 'lvl-200', 'sem-1');

  // Biological Sciences
  addCourse('crs-bio101', 'BIO 101', 'General Biology I - Cell & Organisms', 3, 'dept-8', 'lvl-100', 'sem-1');
  addCourse('crs-bio211', 'BIO 211', 'Cell Biology & Genetics', 3, 'dept-8', 'lvl-200', 'sem-1');

  // Materials Seed (Across All Departments)
  const addMat = (id, title, desc, course, dept, lvl, sem, cat, fileUrl, filePath) => {
    db.prepare(`INSERT OR IGNORE INTO materials (id, title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, title, desc, course, dept, lvl, sem, 'sess-2024-2025', 'usr-lec-1', cat, fileUrl, filePath, 'pdf', 2450000, 'approved');
  };

  addMat('mat-1', 'CSC 111 Comprehensive Lecture Notes', 'Introduction to computer science fundamentals, boolean logic, and algorithms.', 'crs-csc111', 'dept-1', 'lvl-100', 'sem-1', 'Lecture Notes', '/uploads/CSC111_Notes.pdf', 'CSC/100L/CSC111_Notes.pdf');
  addMat('mat-2', 'MCB 211 General Microbiology Lab Manual', 'Practical guide for general microbiology techniques and microscopy.', 'crs-mcb211', 'dept-2', 'lvl-200', 'sem-1', 'Lab Guides', '/uploads/MCB211_Manual.pdf', 'MCB/200L/MCB211_Manual.pdf');
  addMat('mat-3', 'CSC 212 OOP in Java & C++ Guide', 'Object oriented principles, inheritance, polymorphism, and exception handling.', 'crs-csc212', 'dept-1', 'lvl-200', 'sem-2', 'Lecture Notes', '/uploads/CSC212_Notes.pdf', 'CSC/200L/CSC212_Notes.pdf');
  addMat('mat-4', 'CSC 311 Data Structures & Algorithms II Handbook', 'Advanced tree structures, graph traversal, sorting algorithms, and dynamic programming.', 'crs-csc311', 'dept-1', 'lvl-300', 'sem-1', 'Lecture Notes', '/uploads/CSC311_Notes.pdf', 'CSC/300L/CSC311_Notes.pdf');
  addMat('mat-5', 'CSC 411 Operating Systems Architecture Notes', 'Process management, thread synchronization, memory management, and file systems.', 'crs-csc411', 'dept-1', 'lvl-400', 'sem-1', 'Lecture Notes', '/uploads/CSC411_Notes.pdf', 'CSC/400L/CSC411_Notes.pdf');
  addMat('mat-6', 'CSC 415 Computer Performance Evaluation Past Questions', '2021-2024 Past Examination Questions with Worked Solutions.', 'crs-csc415', 'dept-1', 'lvl-400', 'sem-1', 'Past Questions', '/uploads/CSC415_Past_Questions.pdf', 'CSC/400L/CSC415_Past_Questions.pdf');
  addMat('mat-7', 'BCH 201 Biomolecules & Cell Biochemistry', 'Structure and function of proteins, nucleic acids, carbohydrates, and lipids.', 'crs-bch201', 'dept-3', 'lvl-200', 'sem-1', 'Lecture Notes', '/uploads/BCH201_Notes.pdf', 'BCH/200L/BCH201_Notes.pdf');
  addMat('mat-8', 'CHM 101 General Chemistry Module I', 'Atomic structure, stoichiometry, chemical equilibrium, and periodic table trends.', 'crs-chm101', 'dept-4', 'lvl-100', 'sem-1', 'Lecture Notes', '/uploads/CHM101_Module.pdf', 'CHM/100L/CHM101_Module.pdf');
  addMat('mat-9', 'PHY 101 Mechanics & Hydrostatics Lecture Notes', 'Vectors, Newton laws of motion, work-energy theorem, and fluid dynamics.', 'crs-phy101', 'dept-5', 'lvl-100', 'sem-1', 'Lecture Notes', '/uploads/PHY101_Notes.pdf', 'PHY/100L/PHY101_Notes.pdf');
  addMat('mat-10', 'GLY 101 Physical Geology Field Guide', 'Identification of igneous, sedimentary, metamorphic rocks, and plate tectonics.', 'crs-gly101', 'dept-6', 'lvl-100', 'sem-1', 'Lab Guides', '/uploads/GLY101_Guide.pdf', 'GLY/100L/GLY101_Guide.pdf');
  addMat('mat-11', 'MTH 110 Algebra & Trigonometry Handout', 'Polynomials, binomial theorem, complex numbers, and trigonometric identities.', 'crs-mth110', 'dept-7', 'lvl-100', 'sem-1', 'Lecture Notes', '/uploads/MTH110_Handout.pdf', 'MTH/100L/MTH110_Handout.pdf');
  addMat('mat-12', 'BIO 101 General Biology I Practical Manual', 'Microscopic observation of plant/animal tissues, cell division, and enzyme activity.', 'crs-bio101', 'dept-8', 'lvl-100', 'sem-1', 'Lab Guides', '/uploads/BIO101_Manual.pdf', 'BIO/100L/BIO101_Manual.pdf');

  // Sample Quiz
  db.prepare(`INSERT OR IGNORE INTO quizzes (id,title,description,course_id,creator_id,duration_minutes,total_marks,pass_percentage,max_attempts)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('q-1', 'CSC 111 Mid-Semester Self-Assessment',
         'Test your understanding of basic computer science concepts.',
         'crs-csc111', 'usr-lec-1', 15, 10, 50, 3);

  const q1 = generateUUID();
  db.prepare(`INSERT OR IGNORE INTO quiz_questions (id,quiz_id,question_text,question_type,marks,explanation,order_index)
              VALUES (?,?,?,?,?,?,?)`)
    .run(q1, 'q-1', 'Which component is known as the Brain of the computer?', 'mcq', 1.0,
         'The CPU (Central Processing Unit) processes all instructions.', 1);

  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q1}-a`, q1, 'Central Processing Unit (CPU)', 1, 1);
  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q1}-b`, q1, 'Random Access Memory (RAM)', 0, 2);
  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q1}-c`, q1, 'Hard Disk Drive (HDD)', 0, 3);
  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q1}-d`, q1, 'Graphics Processing Unit (GPU)', 0, 4);

  const q2 = generateUUID();
  db.prepare(`INSERT OR IGNORE INTO quiz_questions (id,quiz_id,question_text,question_type,marks,explanation,order_index)
              VALUES (?,?,?,?,?,?,?)`)
    .run(q2, 'q-1', 'What does RAM stand for?', 'mcq', 1.0, 'RAM = Random Access Memory — temporary storage.', 2);

  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q2}-a`, q2, 'Random Access Memory', 1, 1);
  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q2}-b`, q2, 'Read And Modify', 0, 2);
  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q2}-c`, q2, 'Random Arithmetic Module', 0, 3);
  db.prepare('INSERT OR IGNORE INTO quiz_options (id,question_id,option_text,is_correct,order_index) VALUES (?,?,?,?,?)')
    .run(`${q2}-d`, q2, 'Remote Access Module', 0, 4);

  console.log('✅ Offline SQLite database seeded successfully!');
  console.log('   📧 Admin:    admin@ndu.edu.ng    / Password123!');
  console.log('   📧 Lecturer: lecturer@ndu.edu.ng / Password123!');
  console.log('   📧 Student:  student@ndu.edu.ng  / Password123!');
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client Initialization
// ─────────────────────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');

let supabase;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('xyzplaceholder') && !supabaseKey.includes('placeholder')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('⚡ Connected to Supabase Cloud Client (URL: ' + supabaseUrl + ')');
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase client:', err.message);
  }
}

if (!supabase) {
  supabase = {
    storage: {
      from: () => ({
        upload: async () => ({ error: { message: 'Offline mode: Supabase Storage not available.' } }),
        getPublicUrl: (p) => ({ data: { publicUrl: `/uploads/${p}` } }),
        remove: async () => ({})
      })
    }
  };
}

module.exports = { pool, query, supabase };
