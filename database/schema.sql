-- =============================================================================
-- FACULTY OF SCIENCE ACADEMIC REPOSITORY & ASSESSMENT PORTAL (FSARAP)
-- NIGER DELTA UNIVERSITY (NDU)
-- MASTER SUPABASE POSTGRESQL DATABASE SCHEMA
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'faculty_admin', 'lecturer', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'fill_blank', 'short_answer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attempt_status AS ENUM ('in_progress', 'completed', 'timed_out');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ACADEMIC STRUCTURE TABLES
-- -----------------------------------------------------------------------------

-- Faculties Table
CREATE TABLE IF NOT EXISTS faculties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Academic Levels Table
CREATE TABLE IF NOT EXISTS academic_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_code VARCHAR(20) NOT NULL UNIQUE, -- e.g., '100', '200', '300', '400', '500'
    level_name VARCHAR(100) NOT NULL,       -- e.g., '100 Level'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Semesters Table
CREATE TABLE IF NOT EXISTS semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, -- 'First Semester', 'Second Semester'
    code VARCHAR(20) NOT NULL UNIQUE, -- 'SEM1', 'SEM2'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Academic Sessions Table
CREATE TABLE IF NOT EXISTS academic_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_name VARCHAR(50) NOT NULL UNIQUE, -- e.g., '2024/2025'
    is_current BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    matric_number VARCHAR(100) UNIQUE, -- For students
    staff_id VARCHAR(100) UNIQUE,     -- For lecturers/admins
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    level_id UUID REFERENCES academic_levels(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT TRUE, -- Lecturers require admin approval
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. COURSES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code VARCHAR(50) NOT NULL, -- e.g. CSC 111, MTH 110
    course_title VARCHAR(255) NOT NULL,
    credit_units INTEGER DEFAULT 3,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES academic_levels(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    lecturer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_code, department_id)
);

-- -----------------------------------------------------------------------------
-- 5. MATERIALS TABLE & STORAGE AUDIT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES academic_levels(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL DEFAULT 'Lecture Notes', -- Notes, Lab Guides, Past Questions, Tutorials, Assignments
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Path in Supabase Storage bucket
    file_type VARCHAR(50) NOT NULL, -- pdf, docx, pptx, zip, png, jpg
    file_size INTEGER NOT NULL, -- In bytes
    download_count INTEGER DEFAULT 0,
    approval_status approval_status DEFAULT 'approved',
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Material Downloads Audit Log
CREATE TABLE IF NOT EXISTS material_downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Material Bookmarks
CREATE TABLE IF NOT EXISTS material_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 6. QUIZZES & ASSESSMENT ENGINE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    total_marks INTEGER NOT NULL DEFAULT 100,
    pass_percentage NUMERIC(5,2) DEFAULT 50.00,
    max_attempts INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    randomize_questions BOOLEAN DEFAULT TRUE,
    randomize_options BOOLEAN DEFAULT TRUE,
    show_explanation BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL DEFAULT 'mcq',
    marks INTEGER NOT NULL DEFAULT 1,
    difficulty question_difficulty DEFAULT 'medium',
    explanation TEXT,
    correct_answer_text TEXT, -- For fill_blank / short_answer
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Question Options (for MCQ & True/False)
CREATE TABLE IF NOT EXISTS quiz_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0
);

-- Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    score_achieved NUMERIC(6,2) DEFAULT 0,
    percentage NUMERIC(5,2) DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    status attempt_status DEFAULT 'in_progress',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Answers Audit
CREATE TABLE IF NOT EXISTS quiz_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES quiz_options(id) ON DELETE SET NULL,
    text_answer TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    marks_awarded NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. NOTIFICATIONS, ANNOUNCEMENTS & AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, success, warning, danger
    is_read BOOLEAN DEFAULT FALSE,
    link_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    faculty_id UUID REFERENCES faculties(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_role user_role, -- NULL means all roles
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 8. INDEXES FOR HIGH-PERFORMANCE SEARCH & QUERIES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_materials_course ON materials(course_id);
CREATE INDEX IF NOT EXISTS idx_materials_dept ON materials(department_id);
CREATE INDEX IF NOT EXISTS idx_materials_level ON materials(level_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(approval_status);
CREATE INDEX IF NOT EXISTS idx_materials_title ON materials USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- -----------------------------------------------------------------------------
-- 9. TRIGGERS & FUNCTIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_materials_updated_at ON materials;
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to increment download count automatically
CREATE OR REPLACE FUNCTION increment_material_download_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE materials 
    SET download_count = download_count + 1 
    WHERE id = NEW.material_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_increment_download_count ON material_downloads;
CREATE TRIGGER trigger_increment_download_count 
AFTER INSERT ON material_downloads 
FOR EACH ROW EXECUTE PROCEDURE increment_material_download_count();

-- -----------------------------------------------------------------------------
-- 10. INITIAL SEED DATA FOR NIGER DELTA UNIVERSITY (FACULTY OF SCIENCE)
-- -----------------------------------------------------------------------------

-- Faculty
INSERT INTO faculties (id, name, code, description)
VALUES ('11111111-1111-1111-1111-111111111111', 'Faculty of Science', 'FSC', 'Faculty of Science, Niger Delta University, Wilberforce Island, Bayelsa State')
ON CONFLICT (code) DO NOTHING;

-- Departments
INSERT INTO departments (name, code, faculty_id, description) VALUES
('Computer Science', 'CSC', '11111111-1111-1111-1111-111111111111', 'Department of Computer Science'),
('Microbiology', 'MCB', '11111111-1111-1111-1111-111111111111', 'Department of Microbiology'),
('Biochemistry', 'BCH', '11111111-1111-1111-1111-111111111111', 'Department of Biochemistry'),
('Pure & Applied Chemistry', 'CHM', '11111111-1111-1111-1111-111111111111', 'Department of Pure and Applied Chemistry'),
('Physics', 'PHY', '11111111-1111-1111-1111-111111111111', 'Department of Physics'),
('Geology', 'GLY', '11111111-1111-1111-1111-111111111111', 'Department of Geology'),
('Mathematics & Statistics', 'MTH', '11111111-1111-1111-1111-111111111111', 'Department of Mathematics and Statistics'),
('Biological Sciences', 'BIO', '11111111-1111-1111-1111-111111111111', 'Department of Biological Sciences')
ON CONFLICT (code) DO NOTHING;

-- Academic Levels
INSERT INTO academic_levels (level_code, level_name) VALUES
('100', '100 Level'),
('200', '200 Level'),
('300', '300 Level'),
('400', '400 Level'),
('500', '500 Level')
ON CONFLICT (level_code) DO NOTHING;

-- Semesters
INSERT INTO semesters (name, code) VALUES
('First Semester', 'SEM1'),
('Second Semester', 'SEM2')
ON CONFLICT (code) DO NOTHING;

-- Sessions
INSERT INTO academic_sessions (session_name, is_current) VALUES
('2023/2024', FALSE),
('2024/2025', TRUE),
('2025/2026', FALSE)
ON CONFLICT (session_name) DO NOTHING;

-- Super Admin User Seed (Password: AdminPass123! hashed via bcrypt)
INSERT INTO users (first_name, last_name, email, password_hash, role, staff_id, is_active, is_approved)
VALUES ('Super', 'Admin', 'admin@ndu.edu.ng', '$2a$10$5sL6TqQZ68i2l132K03PBeYQ94Zz5V1Y/JzY3H63M4K3X33.X2W6e', 'super_admin', 'NDU-FSC-001', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- -----------------------------------------------------------------------------
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read departments" ON departments;
CREATE POLICY "Allow public read departments" ON departments FOR SELECT USING (true);

ALTER TABLE academic_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read academic_levels" ON academic_levels;
CREATE POLICY "Allow public read academic_levels" ON academic_levels FOR SELECT USING (true);

ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read semesters" ON semesters;
CREATE POLICY "Allow public read semesters" ON semesters FOR SELECT USING (true);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read courses" ON courses;
CREATE POLICY "Allow public read courses" ON courses FOR SELECT USING (true);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read materials" ON materials;
CREATE POLICY "Allow public read materials" ON materials FOR SELECT USING (true);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read quizzes" ON quizzes;
CREATE POLICY "Allow public read quizzes" ON quizzes FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- SEED COURSES ACROSS ALL 8 DEPARTMENTS
-- -----------------------------------------------------------------------------
INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'CSC 111', 'Introduction to Computer Science & Algorithms', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'CSC' AND l.level_code = '100' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'CSC 212', 'Object-Oriented Programming (C++ & Java)', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'CSC' AND l.level_code = '200' AND s.code = 'SEM2'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'CSC 311', 'Data Structures and Algorithms II', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'CSC' AND l.level_code = '300' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'CSC 411', 'Operating Systems Architecture', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'CSC' AND l.level_code = '400' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'MCB 211', 'General Microbiology I', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'MCB' AND l.level_code = '200' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'BCH 201', 'General Biochemistry & Biomolecules', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'BCH' AND l.level_code = '200' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'CHM 101', 'General Chemistry I', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'CHM' AND l.level_code = '100' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'PHY 101', 'General Physics I - Mechanics & Hydrostatics', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'PHY' AND l.level_code = '100' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'GLY 101', 'Introduction to Physical Geology', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'GLY' AND l.level_code = '100' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'MTH 110', 'Elementary Mathematics I (Algebra & Trig)', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'MTH' AND l.level_code = '100' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id)
SELECT 'BIO 101', 'General Biology I - Cell & Organisms', 3, d.id, l.id, s.id
FROM departments d, academic_levels l, semesters s
WHERE d.code = 'BIO' AND l.level_code = '100' AND s.code = 'SEM1'
ON CONFLICT (course_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SEED LECTURE MATERIALS ACROSS ALL 8 DEPARTMENTS
-- -----------------------------------------------------------------------------
INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'CSC 111 Comprehensive Lecture Notes', 'Introduction to computer science fundamentals, boolean logic, and algorithms.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/CSC111_Notes.pdf', 'CSC111_Notes.pdf', 'pdf', 2450000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'CSC 111' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'MCB 211 General Microbiology Lab Manual', 'Practical guide for general microbiology techniques and microscopy.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lab Guides', '/uploads/MCB211_Manual.pdf', 'MCB211_Manual.pdf', 'pdf', 1850000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'MCB 211' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'CSC 212 OOP in Java & C++ Guide', 'Object oriented principles, inheritance, polymorphism, and exception handling.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/CSC212_Notes.pdf', 'CSC212_Notes.pdf', 'pdf', 2100000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'CSC 212' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'CSC 311 Data Structures & Algorithms II Handbook', 'Advanced tree structures, graph traversal, sorting algorithms, and dynamic programming.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/CSC311_Notes.pdf', 'CSC311_Notes.pdf', 'pdf', 3200000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'CSC 311' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'CSC 411 Operating Systems Architecture Notes', 'Process management, thread synchronization, memory management, and file systems.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/CSC411_Notes.pdf', 'CSC411_Notes.pdf', 'pdf', 2900000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'CSC 411' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'BCH 201 Biomolecules & Cell Biochemistry', 'Structure and function of proteins, nucleic acids, carbohydrates, and lipids.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/BCH201_Notes.pdf', 'BCH201_Notes.pdf', 'pdf', 2700000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'BCH 201' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'CHM 101 General Chemistry Module I', 'Atomic structure, stoichiometry, chemical equilibrium, and periodic table trends.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/CHM101_Module.pdf', 'CHM101_Module.pdf', 'pdf', 2300000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'CHM 101' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'PHY 101 Mechanics & Hydrostatics Lecture Notes', 'Vectors, Newton laws of motion, work-energy theorem, and fluid dynamics.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/PHY101_Notes.pdf', 'PHY101_Notes.pdf', 'pdf', 2800000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'PHY 101' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'GLY 101 Physical Geology Field Guide', 'Identification of igneous, sedimentary, metamorphic rocks, and plate tectonics.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lab Guides', '/uploads/GLY101_Guide.pdf', 'GLY101_Guide.pdf', 'pdf', 3100000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'GLY 101' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'MTH 110 Algebra & Trigonometry Handout', 'Polynomials, binomial theorem, complex numbers, and trigonometric identities.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lecture Notes', '/uploads/MTH110_Handout.pdf', 'MTH110_Handout.pdf', 'pdf', 2600000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'MTH 110' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

INSERT INTO materials (title, description, course_id, department_id, level_id, semester_id, session_id, uploader_id, category, file_url, file_path, file_type, file_size, approval_status)
SELECT 'BIO 101 General Biology I Practical Manual', 'Microscopic observation of plant/animal tissues, cell division, and enzyme activity.', c.id, c.department_id, c.level_id, c.semester_id, s.id, u.id, 'Lab Guides', '/uploads/BIO101_Manual.pdf', 'BIO101_Manual.pdf', 'pdf', 2400000, 'approved'
FROM courses c, academic_sessions s, users u
WHERE c.course_code = 'BIO 101' AND s.session_name = '2024/2025' AND u.email = 'admin@ndu.edu.ng';

