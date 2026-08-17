const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

async function request(method, endpoint, body = null, token = null) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = {};
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = { raw: data };
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runComprehensiveRoleTests() {
  console.log('\n========================================================================');
  console.log(' 🧪 FULL SYSTEM AUDIT: STUDENT, LECTURER, AND ADMIN END-TO-END TESTS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, label, details = '') {
    if (condition) {
      console.log(` ✅ [PASS] ${label}`);
      passed++;
    } else {
      console.log(` ❌ [FAIL] ${label} | ${details}`);
      failed++;
    }
  }

  const randStr = () => Math.floor(1000 + Math.random() * 9000);

  // ---------------------------------------------------------------------------
  // 1. GET METADATA
  // ---------------------------------------------------------------------------
  console.log('--- 1. ACADEMIC METADATA ---');
  const meta = await request('GET', '/auth/metadata');
  assert(meta.status === 200 && meta.data.success, 'Fetch Metadata (Departments & Levels)', JSON.stringify(meta.data));
  const deptId = meta.data?.data?.departments[0]?.id;
  const levelId = meta.data?.data?.levels[0]?.id;

  // ---------------------------------------------------------------------------
  // 2. STUDENT FLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. STUDENT FLOW ---');
  const stuEmail = `student_${Date.now()}@ndu.edu.ng`;
  const stuPassword = 'StudentPass123!';

  // Student Registration
  const stuReg = await request('POST', '/auth/register', {
    first_name: 'Blessing',
    last_name: 'Tarila',
    email: stuEmail,
    password: stuPassword,
    role: 'student',
    department_id: deptId,
    level_id: levelId,
    matric_number: `NDU/2023/CSC/${randStr()}`
  });
  assert(stuReg.status === 201 && stuReg.data.success, 'Student Registration', JSON.stringify(stuReg.data));
  const stuToken = stuReg.data?.token;

  // Student Login
  const stuLogin = await request('POST', '/auth/login', {
    email: stuEmail,
    password: stuPassword
  });
  assert(stuLogin.status === 200 && stuLogin.data.success, 'Student Login', JSON.stringify(stuLogin.data));

  // Student Dashboard Access
  const stuDash = await request('GET', '/dashboard/student', null, stuToken);
  assert(stuDash.status === 200 && stuDash.data.success, 'Access Student Dashboard', JSON.stringify(stuDash.data));

  // Student Repository Access
  const stuRepo = await request('GET', '/materials', null, stuToken);
  assert(stuRepo.status === 200 && stuRepo.data.success, 'Access Academic Repository Materials', JSON.stringify(stuRepo.data));

  // ---------------------------------------------------------------------------
  // 3. LECTURER FLOW (WITH ADMIN APPROVAL)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. LECTURER FLOW ---');
  const lecEmail = `lecturer_${Date.now()}@ndu.edu.ng`;
  const lecPassword = 'LecturerPass123!';

  // Lecturer Registration
  const lecReg = await request('POST', '/auth/register', {
    first_name: 'Dr. Pereware',
    last_name: 'Keme',
    email: lecEmail,
    password: lecPassword,
    role: 'lecturer',
    department_id: deptId,
    staff_id: `NDU/STAFF/MCB/${randStr()}`
  });
  assert(lecReg.status === 201 && lecReg.data.success, 'Lecturer Registration', JSON.stringify(lecReg.data));
  const newLecId = lecReg.data?.user?.id;

  // Lecturer Login BEFORE Admin Approval (Should fail with HTTP 403 Pending Approval)
  const lecLoginPre = await request('POST', '/auth/login', {
    email: lecEmail,
    password: lecPassword
  });
  assert(
    lecLoginPre.status === 403 && lecLoginPre.data.message.toLowerCase().includes('pending'),
    'Enforce Lecturer Pending Approval Barrier (HTTP 403)',
    JSON.stringify(lecLoginPre.data)
  );

  // ---------------------------------------------------------------------------
  // 4. SUPER ADMIN FLOW & APPROVAL
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. SUPER ADMIN FLOW ---');
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@ndu.edu.ng',
    password: 'Password123!'
  });
  assert(adminLogin.status === 200 && adminLogin.data.success, 'Super Admin Login', JSON.stringify(adminLogin.data));
  const adminToken = adminLogin.data?.token;

  // Admin Dashboard Access
  const adminDash = await request('GET', '/dashboard/admin', null, adminToken);
  assert(adminDash.status === 200 && adminDash.data.success, 'Access Admin Dashboard Overview', JSON.stringify(adminDash.data));

  // Admin Approves Pending Lecturer
  if (newLecId) {
    const approveRes = await request('PUT', `/dashboard/users/${newLecId}/approval`, { is_approved: true }, adminToken);
    assert(approveRes.status === 200 && approveRes.data.success, 'Admin Approve Pending Lecturer Account', JSON.stringify(approveRes.data));
  }

  // ---------------------------------------------------------------------------
  // 5. LECTURER LOGIN AFTER APPROVAL
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. LECTURER POST-APPROVAL ACCESS ---');
  const lecLoginPost = await request('POST', '/auth/login', {
    email: lecEmail,
    password: lecPassword
  });
  assert(lecLoginPost.status === 200 && lecLoginPost.data.success, 'Lecturer Login After Admin Approval', JSON.stringify(lecLoginPost.data));
  const lecToken = lecLoginPost.data?.token;

  // Lecturer Dashboard Access
  const lecDash = await request('GET', '/dashboard/lecturer', null, lecToken);
  assert(lecDash.status === 200 && lecDash.data.success, 'Access Lecturer Dashboard', JSON.stringify(lecDash.data));

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(` 📊 SYSTEM AUDIT RESULT: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');
}

runComprehensiveRoleTests().catch(console.error);
