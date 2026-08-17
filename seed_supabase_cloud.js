const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://thfpqbwefkvhageytpgu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedSupabaseCloud() {
  console.log('🚀 Seeding Supabase Cloud Database & Storage Bucket...');

  // 1. Departments
  const depts = [
    { name: 'Computer Science', code: 'CSC', description: 'Department of Computer Science' },
    { name: 'Microbiology', code: 'MCB', description: 'Department of Microbiology' },
    { name: 'Biochemistry', code: 'BCH', description: 'Department of Biochemistry' },
    { name: 'Pure & Applied Chemistry', code: 'CHM', description: 'Department of Pure and Applied Chemistry' },
    { name: 'Physics', code: 'PHY', description: 'Department of Physics' },
    { name: 'Geology', code: 'GLY', description: 'Department of Geology' },
    { name: 'Mathematics & Statistics', code: 'MTH', description: 'Department of Mathematics and Statistics' },
    { name: 'Biological Sciences', code: 'BIO', description: 'Department of Biological Sciences' }
  ];

  for (const d of depts) {
    await supabase.from('departments').upsert(d, { onConflict: 'code' });
  }
  const { data: dbDepts } = await supabase.from('departments').select('id, code');
  const getDept = (code) => dbDepts.find(d => d.code === code)?.id;

  // 2. Academic Levels
  const levels = [
    { level_code: '100', level_name: '100 Level' },
    { level_code: '200', level_name: '200 Level' },
    { level_code: '300', level_name: '300 Level' },
    { level_code: '400', level_name: '400 Level' },
    { level_code: '500', level_name: '500 Level' }
  ];
  for (const l of levels) {
    await supabase.from('academic_levels').upsert(l, { onConflict: 'level_code' });
  }
  const { data: dbLvls } = await supabase.from('academic_levels').select('id, level_code');
  const getLvl = (code) => dbLvls.find(l => l.level_code === code)?.id;

  // 3. Semesters
  const sems = [
    { name: 'First Semester', code: 'SEM1' },
    { name: 'Second Semester', code: 'SEM2' }
  ];
  for (const sm of sems) {
    await supabase.from('semesters').upsert(sm, { onConflict: 'code' });
  }
  const { data: dbSems } = await supabase.from('semesters').select('id, code');
  const getSem = (code) => dbSems.find(sm => sm.code === code)?.id;

  // 4. Academic Sessions
  const sess = [{ session_name: '2024/2025', is_current: true }];
  for (const ss of sess) {
    await supabase.from('academic_sessions').upsert(ss, { onConflict: 'session_name' });
  }
  const { data: dbSess } = await supabase.from('academic_sessions').select('id, session_name');
  const sessId = dbSess[0]?.id;

  // 5. Users (Get Admin)
  const { data: users } = await supabase.from('users').select('id, email');
  const adminId = users?.find(u => u.email === 'admin@ndu.edu.ng')?.id || users?.[0]?.id;

  // 6. Courses
  const courses = [
    { course_code: 'CSC 111', course_title: 'Introduction to Computer Science & Algorithms', credit_units: 3, department_id: getDept('CSC'), level_id: getLvl('100'), semester_id: getSem('SEM1') },
    { course_code: 'CSC 212', course_title: 'Object-Oriented Programming (C++ & Java)', credit_units: 3, department_id: getDept('CSC'), level_id: getLvl('200'), semester_id: getSem('SEM2') },
    { course_code: 'CSC 311', course_title: 'Data Structures and Algorithms II', credit_units: 3, department_id: getDept('CSC'), level_id: getLvl('300'), semester_id: getSem('SEM1') },
    { course_code: 'CSC 411', course_title: 'Operating Systems Architecture', credit_units: 3, department_id: getDept('CSC'), level_id: getLvl('400'), semester_id: getSem('SEM1') },
    { course_code: 'MCB 211', course_title: 'General Microbiology I', credit_units: 3, department_id: getDept('MCB'), level_id: getLvl('200'), semester_id: getSem('SEM1') },
    { course_code: 'BCH 201', course_title: 'General Biochemistry & Biomolecules', credit_units: 3, department_id: getDept('BCH'), level_id: getLvl('200'), semester_id: getSem('SEM1') },
    { course_code: 'CHM 101', course_title: 'General Chemistry I', credit_units: 3, department_id: getDept('CHM'), level_id: getLvl('100'), semester_id: getSem('SEM1') },
    { course_code: 'PHY 101', course_title: 'General Physics I - Mechanics & Hydrostatics', credit_units: 3, department_id: getDept('PHY'), level_id: getLvl('100'), semester_id: getSem('SEM1') },
    { course_code: 'GLY 101', course_title: 'Introduction to Physical Geology', credit_units: 3, department_id: getDept('GLY'), level_id: getLvl('100'), semester_id: getSem('SEM1') },
    { course_code: 'MTH 110', course_title: 'Elementary Mathematics I (Algebra & Trig)', credit_units: 3, department_id: getDept('MTH'), level_id: getLvl('100'), semester_id: getSem('SEM1') },
    { course_code: 'BIO 101', course_title: 'General Biology I - Cell & Organisms', credit_units: 3, department_id: getDept('BIO'), level_id: getLvl('100'), semester_id: getSem('SEM1') }
  ];

  for (const c of courses) {
    if (c.department_id) {
      await supabase.from('courses').upsert(c, { onConflict: 'course_code' });
    }
  }

  const { data: dbCourses } = await supabase.from('courses').select('id, course_code');
  const getCrs = (code) => dbCourses.find(c => c.course_code === code)?.id;
  console.log('✅ Supabase Courses Count:', dbCourses?.length);

  // 7. Materials
  const materials = [
    { title: 'CSC 111 Comprehensive Lecture Notes', description: 'Introduction to computer science fundamentals, boolean logic, and algorithms.', course_id: getCrs('CSC 111'), department_id: getDept('CSC'), level_id: getLvl('100'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/CSC111_Notes.pdf`, file_path: 'CSC111_Notes.pdf', file_type: 'pdf', file_size: 2450000, approval_status: 'approved' },
    { title: 'MCB 211 General Microbiology Lab Manual', description: 'Practical guide for general microbiology techniques and microscopy.', course_id: getCrs('MCB 211'), department_id: getDept('MCB'), level_id: getLvl('200'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lab Guides', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/MCB211_Manual.pdf`, file_path: 'MCB211_Manual.pdf', file_type: 'pdf', file_size: 1850000, approval_status: 'approved' },
    { title: 'CSC 212 OOP in Java & C++ Guide', description: 'Object oriented principles, inheritance, polymorphism, and exception handling.', course_id: getCrs('CSC 212'), department_id: getDept('CSC'), level_id: getLvl('200'), semester_id: getSem('SEM2'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/CSC212_Notes.pdf`, file_path: 'CSC212_Notes.pdf', file_type: 'pdf', file_size: 2100000, approval_status: 'approved' },
    { title: 'CSC 311 Data Structures & Algorithms II Handbook', description: 'Advanced tree structures, graph traversal, sorting algorithms, and dynamic programming.', course_id: getCrs('CSC 311'), department_id: getDept('CSC'), level_id: getLvl('300'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/CSC311_Notes.pdf`, file_path: 'CSC311_Notes.pdf', file_type: 'pdf', file_size: 3200000, approval_status: 'approved' },
    { title: 'CSC 411 Operating Systems Architecture Notes', description: 'Process management, thread synchronization, memory management, and file systems.', course_id: getCrs('CSC 411'), department_id: getDept('CSC'), level_id: getLvl('400'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/CSC411_Notes.pdf`, file_path: 'CSC411_Notes.pdf', file_type: 'pdf', file_size: 2900000, approval_status: 'approved' },
    { title: 'BCH 201 Biomolecules & Cell Biochemistry', description: 'Structure and function of proteins, nucleic acids, carbohydrates, and lipids.', course_id: getCrs('BCH 201'), department_id: getDept('BCH'), level_id: getLvl('200'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/BCH201_Notes.pdf`, file_path: 'BCH201_Notes.pdf', file_type: 'pdf', file_size: 2700000, approval_status: 'approved' },
    { title: 'CHM 101 General Chemistry Module I', description: 'Atomic structure, stoichiometry, chemical equilibrium, and periodic table trends.', course_id: getCrs('CHM 101'), department_id: getDept('CHM'), level_id: getLvl('100'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/CHM101_Module.pdf`, file_path: 'CHM101_Module.pdf', file_type: 'pdf', file_size: 2300000, approval_status: 'approved' },
    { title: 'PHY 101 Mechanics & Hydrostatics Lecture Notes', description: 'Vectors, Newton laws of motion, work-energy theorem, and fluid dynamics.', course_id: getCrs('PHY 101'), department_id: getDept('PHY'), level_id: getLvl('100'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/PHY101_Notes.pdf`, file_path: 'PHY101_Notes.pdf', file_type: 'pdf', file_size: 2800000, approval_status: 'approved' },
    { title: 'GLY 101 Physical Geology Field Guide', description: 'Identification of igneous, sedimentary, metamorphic rocks, and plate tectonics.', course_id: getCrs('GLY 101'), department_id: getDept('GLY'), level_id: getLvl('100'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lab Guides', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/GLY101_Guide.pdf`, file_path: 'GLY101_Guide.pdf', file_type: 'pdf', file_size: 3100000, approval_status: 'approved' },
    { title: 'MTH 110 Algebra & Trigonometry Handout', description: 'Polynomials, binomial theorem, complex numbers, and trigonometric identities.', course_id: getCrs('MTH 110'), department_id: getDept('MTH'), level_id: getLvl('100'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lecture Notes', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/MTH110_Handout.pdf`, file_path: 'MTH110_Handout.pdf', file_type: 'pdf', file_size: 2600000, approval_status: 'approved' },
    { title: 'BIO 101 General Biology I Practical Manual', description: 'Microscopic observation of plant/animal tissues, cell division, and enzyme activity.', course_id: getCrs('BIO 101'), department_id: getDept('BIO'), level_id: getLvl('100'), semester_id: getSem('SEM1'), session_id: sessId, uploader_id: adminId, category: 'Lab Guides', file_url: `${supabaseUrl}/storage/v1/object/public/lecture-materials/BIO101_Manual.pdf`, file_path: 'BIO101_Manual.pdf', file_type: 'pdf', file_size: 2400000, approval_status: 'approved' }
  ];

  for (const m of materials) {
    if (m.course_id) {
      await supabase.from('materials').insert(m);
    }
  }

  const { data: dbMats } = await supabase.from('materials').select('id, title');
  console.log('✅ Supabase Materials Count:', dbMats?.length);

  // 8. Upload PDF files to Supabase Storage
  const uploadDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadDir)) {
    const localFiles = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));
    for (const file of localFiles) {
      const fileBuf = fs.readFileSync(path.join(uploadDir, file));
      const { error: stErr } = await supabase.storage
        .from('lecture-materials')
        .upload(file, fileBuf, { contentType: 'application/pdf', upsert: true });

      if (stErr) {
        console.warn('Storage upload note:', file, stErr.message);
      } else {
        console.log('☁️ Uploaded to Supabase Storage:', file);
      }
    }
  }

  console.log('\n🎉 ALL COURSES, MATERIALS & PDF FILES ARE LIVE IN SUPABASE CLOUD!');
}

seedSupabaseCloud().catch(console.error);
