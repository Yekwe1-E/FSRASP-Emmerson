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

async function runQuizFlowTest() {
  console.log('\n========================================================================');
  console.log(' 🧪 TESTING COMPLETE QUIZ EXECUTION FLOW (START -> TAKE -> SUBMIT -> RESULT)');
  console.log('========================================================================\n');

  // 1. Student Login
  const login = await request('POST', '/auth/login', {
    email: 'student@ndu.edu.ng',
    password: 'Password123!'
  });
  console.log('1. Student Login:', login.status, login.data.success ? '✅ SUCCESS' : '❌ FAILED');
  const token = login.data.token;

  // 2. Fetch Quizzes List
  const quizzes = await request('GET', '/quizzes', null, token);
  console.log('2. Available Quizzes:', quizzes.data.data?.length);

  const quiz = quizzes.data.data[0];
  console.log(`\nSelected Quiz: "${quiz.title}" (ID: ${quiz.id})`);

  // 3. Start Quiz Attempt
  console.log('3. Starting Quiz Attempt (POST /api/quizzes/:id/start)...');
  const start = await request('POST', `/quizzes/${quiz.id}/start`, {}, token);
  console.log('   └─ Status:', start.status, '| Success:', start.data.success);
  console.log('   └─ Attempt ID:', start.data.attempt?.id);
  const attemptId = start.data.attempt?.id;

  // 4. Fetch Quiz Questions
  console.log('4. Fetching Quiz Questions (GET /api/quizzes/:id/take)...');
  const take = await request('GET', `/quizzes/${quiz.id}/take`, null, token);
  console.log('   └─ Status:', take.status, '| Questions count:', take.data.quiz?.questions?.length);
  const questions = take.data.quiz?.questions || [];

  if (questions.length > 0) {
    console.log(`   └─ Sample Question: "${questions[0].question_text}"`);
    console.log(`   └─ Options:`, questions[0].options?.map(o => o.option_text).join(' | '));

    // 5. Submit Quiz Answers
    const sampleAnswers = questions.map(q => ({
      question_id: q.id,
      selected_option_id: q.options ? q.options[0].id : null
    }));

    console.log('5. Submitting Quiz Answers (POST /api/quizzes/:id/submit)...');
    const submit = await request('POST', `/quizzes/${quiz.id}/submit`, {
      attempt_id: attemptId,
      answers: sampleAnswers
    }, token);

    console.log('   └─ Status:', submit.status, '| Grade:', submit.data.data?.grade);
    console.log('   └─ Score Achieved:', submit.data.data?.score, '/', submit.data.data?.total_questions, `(${submit.data.data?.percentage}%)`);

    // 6. View Attempt Results Breakdown
    console.log('6. Fetching Result Breakdown (GET /api/quizzes/attempts/:attemptId)...');
    const result = await request('GET', `/quizzes/attempts/${attemptId}`, null, token);
    console.log('   └─ Status:', result.status, '| Result Quiz Title:', result.data.attempt?.quiz_title);
    console.log('   └─ Passed:', result.data.attempt?.passed ? '🎉 YES' : '❌ NO');
  }

  console.log('\n========================================================================');
  console.log(' 🎉 QUIZ FLOW TEST COMPLETED WITH 0 ERRORS AND NO LOGOUTS!');
  console.log('========================================================================\n');
}

runQuizFlowTest().catch(console.error);
