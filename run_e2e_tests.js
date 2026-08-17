const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

let studentCookie = '';
let lecturerCookie = '';
let adminCookie = '';

async function request(method, endpoint, body = null, headers = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'];
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = {};
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = { raw: data };
        }
        resolve({ status: res.statusCode, data: json, cookies });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- E2E TEST RUNNER START ---');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, resObj) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.log(`[FAIL] ${testName} | Status: ${resObj?.status} | Data: ${JSON.stringify(resObj?.data)}`);
      failed++;
    }
  }

  // 1. Health Check
  const health = await request('GET', '/health');
  assert(health.status === 200 && health.data.status === 'online', 'Health Check API', health);

  // 2. Student Login
  const stuLogin = await request('POST', '/auth/login', {
    email: 'student@ndu.edu.ng',
    password: 'Password123!'
  });
  assert(stuLogin.status === 200 && stuLogin.data.success, 'Student Login', stuLogin);
  if (stuLogin.cookies) {
    studentCookie = stuLogin.cookies.map(c => c.split(';')[0]).join('; ');
  }

  // 3. Lecturer Login
  const lecLogin = await request('POST', '/auth/login', {
    email: 'lecturer@ndu.edu.ng',
    password: 'Password123!'
  });
  assert(lecLogin.status === 200 && lecLogin.data.success, 'Lecturer Login', lecLogin);
  if (lecLogin.cookies) {
    lecturerCookie = lecLogin.cookies.map(c => c.split(';')[0]).join('; ');
  }

  // 4. Admin Login
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@ndu.edu.ng',
    password: 'Password123!'
  });
  assert(adminLogin.status === 200 && adminLogin.data.success, 'Admin Login', adminLogin);
  if (adminLogin.cookies) {
    adminCookie = adminLogin.cookies.map(c => c.split(';')[0]).join('; ');
  }

  // 5. Auth Me Endpoint
  const meRes = await request('GET', '/auth/me', null, { Cookie: studentCookie });
  assert(meRes.status === 200 && meRes.data.user?.email === 'student@ndu.edu.ng', 'Get Current Auth User', meRes);

  // 6. Courses List
  const coursesRes = await request('GET', '/courses');
  assert(coursesRes.status === 200 && Array.isArray(coursesRes.data.data), 'Fetch All Courses', coursesRes);

  // 7. Materials List
  const materialsRes = await request('GET', '/materials');
  assert(materialsRes.status === 200 && Array.isArray(materialsRes.data.data), 'Fetch All Materials', materialsRes);

  // 8. Create Quiz (as Lecturer)
  let createdQuizId = null;
  const createQuizRes = await request('POST', '/quizzes', {
    title: 'E2E Test Quiz on Algorithms',
    description: 'Testing algorithm complexity and data structures',
    course_id: 'crs-csc111',
    duration_minutes: 20,
    total_marks: 20,
    pass_percentage: 50,
    max_attempts: 5
  }, { Cookie: lecturerCookie });

  assert(createQuizRes.status === 201 && createQuizRes.data.success, 'Create Quiz as Lecturer', createQuizRes);
  if (createQuizRes.data.data) {
    createdQuizId = createQuizRes.data.data.id;
  }

  // 9. Add Question to Quiz
  let questionId = null;
  if (createdQuizId) {
    const addQRes = await request('POST', `/quizzes/${createdQuizId}/questions`, {
      question_text: 'What is the time complexity of binary search?',
      question_type: 'mcq',
      marks: 10,
      options: [
        { option_text: 'O(N)', is_correct: false },
        { option_text: 'O(log N)', is_correct: true },
        { option_text: 'O(N^2)', is_correct: false },
        { option_text: 'O(1)', is_correct: false }
      ]
    }, { Cookie: lecturerCookie });

    assert(addQRes.status === 201 && addQRes.data.success, 'Add Question to Quiz', addQRes);
    if (addQRes.data.data) {
      questionId = addQRes.data.data.id;
    }
  }

  // 10. Quizzes List
  const quizzesRes = await request('GET', '/quizzes');
  assert(quizzesRes.status === 200 && Array.isArray(quizzesRes.data.data), 'Fetch Quizzes', quizzesRes);

  // 11. Student Starts Quiz Attempt
  let attemptId = null;
  if (createdQuizId) {
    const startRes = await request('POST', `/quizzes/${createdQuizId}/start`, null, { Cookie: studentCookie });
    assert(startRes.status === 201 && startRes.data.success, 'Start Quiz Attempt', startRes);
    if (startRes.data.attempt) {
      attemptId = startRes.data.attempt.id;
    }

    // 12. Student Get Quiz Questions for Attempt (/quizzes/:id/take)
    const quizDetail = await request('GET', `/quizzes/${createdQuizId}/take`, null, { Cookie: studentCookie });
    assert(quizDetail.status === 200 && quizDetail.data.quiz?.questions?.length > 0, 'Fetch Attempt Questions', quizDetail);

    let selectedOptId = null;
    if (quizDetail.data.quiz?.questions?.length > 0) {
      const q = quizDetail.data.quiz.questions[0];
      if (q.options?.length > 0) {
        selectedOptId = q.options[0].id;
      }
    }

    // 13. Student Submit Quiz Attempt
    if (attemptId) {
      const submitRes = await request('POST', `/quizzes/${createdQuizId}/submit`, {
        attempt_id: attemptId,
        answers: [
          {
            question_id: questionId,
            selected_option_id: selectedOptId
          }
        ]
      }, { Cookie: studentCookie });

      assert(submitRes.status === 200 && submitRes.data.success, 'Submit Quiz Attempt', submitRes);
    }

    // 14. Get Attempt Result (/quizzes/attempts/:attempt_id)
    if (attemptId) {
      const resultRes = await request('GET', `/quizzes/attempts/${attemptId}`, null, { Cookie: studentCookie });
      assert(resultRes.status === 200 && resultRes.data.success, 'Fetch Attempt Result', resultRes);
    }
  }

  // 15. Student Quiz History (/quizzes/history)
  const historyRes = await request('GET', '/quizzes/history', null, { Cookie: studentCookie });
  assert(historyRes.status === 200 && Array.isArray(historyRes.data.data), 'Fetch Student Quiz History', historyRes);

  // 16. Dashboard Stats (Student, Lecturer, Admin)
  const stuDash = await request('GET', '/dashboard/student', null, { Cookie: studentCookie });
  assert(stuDash.status === 200 && stuDash.data.success, 'Student Dashboard Overview', stuDash);

  const lecDash = await request('GET', '/dashboard/lecturer', null, { Cookie: lecturerCookie });
  assert(lecDash.status === 200 && lecDash.data.success, 'Lecturer Dashboard Overview', lecDash);

  const adminDash = await request('GET', '/dashboard/admin', null, { Cookie: adminCookie });
  assert(adminDash.status === 200 && adminDash.data.success, 'Admin Dashboard Overview', adminDash);

  // 17. Notifications Endpoint
  const notifRes = await request('GET', '/notifications', null, { Cookie: studentCookie });
  assert(notifRes.status === 200 && notifRes.data.success, 'Fetch Notifications', notifRes);

  console.log(`\n====================================================`);
  console.log(`📊 FINAL RESULTS: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests`);
  console.log(`====================================================`);
  console.log('--- E2E TEST RUNNER END ---');
}

runTests().catch(console.error);
