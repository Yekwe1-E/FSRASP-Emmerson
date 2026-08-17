/**
 * FSARAP ASSESSMENT ENGINE & QUIZ EXECUTION CONTROLLER
 * Handles interactive countdown timer, question navigation, response aggregation, auto-submission, and score breakdown
 */

let quizState = {
  quizId: null,
  attemptId: null,
  questions: [],
  userAnswers: {}, // { question_id: { selected_option_id, text_answer } }
  currentQuestionIndex: 0,
  timerInterval: null,
  timeRemainingSeconds: 0
};

document.addEventListener('DOMContentLoaded', () => {
  loadQuizzesList();
  initTakeQuizPortal();
  initQuizResultPage();
  initCreateQuizForm();
});

// Load Available Quizzes List
const loadQuizzesList = async () => {
  const container = document.getElementById('quizzes-list-container');
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0;">
      <div style="font-size: 2.5rem; animation: spin 1s linear infinite;">⏳</div>
      <p class="text-muted mt-2">Loading active quizzes from assessment portal...</p>
    </div>
  `;

  try {
    const res = await apiCall('/quizzes');

    if (res.success) {
      if (res.data.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;" class="card">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
            <h3>No Active Quizzes Available</h3>
            <p class="text-muted mt-1">Check back later or contact your course lecturer.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = res.data.map(q => `
        <div class="card card-hoverable flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="badge badge-primary">${q.course_code}</span>
              <span class="badge badge-secondary">⏱️ ${q.duration_minutes} Mins</span>
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${escapeHtml(q.title)}</h3>
            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 1rem;">${escapeHtml(q.course_title)} (${q.department_name})</p>
          </div>

          <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
            <div class="flex justify-between items-center text-muted" style="font-size: 0.8rem; margin-bottom: 0.75rem;">
              <span>❓ ${q.question_count || 0} Questions</span>
              <span>🎯 Pass Mark: ${q.pass_percentage}%</span>
            </div>
            <a href="take-quiz.html?id=${q.id}" class="btn btn-accent btn-sm" style="width: 100%;">Take Quiz &rarr;</a>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;" class="card">
        <p style="color: var(--danger);">Failed to load quizzes: ${error.message}</p>
      </div>
    `;
  }
};

// Initialize Interactive Quiz Execution Portal
const initTakeQuizPortal = async () => {
  const quizPortalContainer = document.getElementById('take-quiz-container');
  if (!quizPortalContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get('id');

  if (!quizId) {
    showToast('Invalid Quiz ID.', 'danger');
    setTimeout(() => window.location.href = 'quizzes.html', 1500);
    return;
  }

  const session = getUserSession();
  if (!session) {
    showToast('Please login to take self-assessment quizzes.', 'warning');
    setTimeout(() => window.location.href = 'auth.html', 1500);
    return;
  }

  quizState.quizId = quizId;

  try {
    // Start attempt in DB
    const startRes = await apiCall(`/quizzes/${quizId}/start`, 'POST');
    if (!startRes.success) throw new Error(startRes.message);
    quizState.attemptId = startRes.attempt.id;

    // Fetch Quiz Questions
    const quizRes = await apiCall(`/quizzes/${quizId}/take`);
    if (!quizRes.success) throw new Error(quizRes.message);

    const { quiz } = quizRes;
    quizState.questions = quiz.questions;
    quizState.timeRemainingSeconds = quiz.duration_minutes * 60;

    if (quizState.questions.length === 0) {
      quizPortalContainer.innerHTML = `
        <div class="card text-center" style="padding: 3rem;">
          <h3>No questions configured for this quiz yet.</h3>
          <a href="quizzes.html" class="btn btn-primary mt-2">Back to Quizzes</a>
        </div>
      `;
      return;
    }

    renderQuizInterface(quiz);
    startCountdownTimer();
  } catch (err) {
    quizPortalContainer.innerHTML = `
      <div class="card text-center" style="padding: 3rem;">
        <h3 style="color: var(--danger);">${err.message}</h3>
        <a href="quizzes.html" class="btn btn-outline mt-2">Back to Quizzes</a>
      </div>
    `;
  }
};

// Render Quiz Interface Container
const renderQuizInterface = (quiz) => {
  const container = document.getElementById('take-quiz-container');
  
  container.innerHTML = `
    <!-- Quiz Header Bar -->
    <div class="card mb-3" style="padding: 1.25rem;">
      <div class="flex justify-between items-center">
        <div>
          <span class="badge badge-primary">${quiz.course_code}</span>
          <h2 style="font-size: 1.3rem; margin-top: 0.25rem;">${escapeHtml(quiz.title)}</h2>
        </div>
        <div class="text-right">
          <span class="text-muted" style="font-size: 0.8rem; display: block;">TIME REMAINING</span>
          <div id="quiz-timer-display" style="font-size: 1.5rem; font-weight: 800; color: var(--danger); font-family: monospace;">
            00:00
          </div>
        </div>
      </div>
    </div>

    <!-- Question Container -->
    <div class="card mb-3" style="padding: 2rem;">
      <div class="flex justify-between items-center mb-3">
        <span id="question-progress" style="font-weight: 600; color: var(--primary);">Question 1 of ${quizState.questions.length}</span>
        <span id="question-marks" class="badge badge-secondary">1 Mark</span>
      </div>

      <h3 id="question-text-heading" style="font-size: 1.15rem; margin-bottom: 1.5rem; line-height: 1.4;"></h3>

      <div id="options-container" class="flex flex-col gap-2 mb-4">
        <!-- Render Options -->
      </div>

      <div class="flex justify-between items-center pt-3" style="border-top: 1px solid var(--border-color);">
        <button id="btn-prev-question" onclick="navigateQuestion(-1)" class="btn btn-outline" disabled>&larr; Previous</button>
        <div id="question-bubbles" class="flex gap-1" style="flex-wrap: wrap;"></div>
        <button id="btn-next-question" onclick="navigateQuestion(1)" class="btn btn-primary">Next &rarr;</button>
      </div>
    </div>

    <div class="text-right">
      <button onclick="confirmSubmitQuiz()" class="btn btn-accent btn-lg">Submit Assessment Now</button>
    </div>
  `;

  renderQuestionIndex(0);
};

// Render Individual Question Index
const renderQuestionIndex = (index) => {
  quizState.currentQuestionIndex = index;
  const q = quizState.questions[index];

  document.getElementById('question-progress').innerText = `Question ${index + 1} of ${quizState.questions.length}`;
  document.getElementById('question-marks').innerText = `${q.marks} Mark${q.marks > 1 ? 's' : ''}`;
  document.getElementById('question-text-heading').innerText = q.question_text;

  const optionsContainer = document.getElementById('options-container');
  const existingAns = quizState.userAnswers[q.id] || {};

  if (['mcq', 'true_false'].includes(q.question_type)) {
    optionsContainer.innerHTML = q.options.map((opt, i) => {
      const checked = existingAns.selected_option_id === opt.id ? 'checked' : '';
      return `
        <label class="card" style="padding: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; border-color: ${checked ? 'var(--primary)' : 'var(--border-color)'}; background-color: ${checked ? 'var(--primary-light)' : 'var(--bg-card)'};">
          <input type="radio" name="question_option" value="${opt.id}" ${checked} onchange="selectOption('${q.id}', '${opt.id}')" style="width: 18px; height: 18px; accent-color: var(--primary);">
          <span style="font-weight: 500;">${escapeHtml(opt.option_text)}</span>
        </label>
      `;
    }).join('');
  } else {
    optionsContainer.innerHTML = `
      <div class="form-group">
        <input type="text" class="form-control" placeholder="Type your answer here..." value="${existingAns.text_answer || ''}" onchange="selectTextAnswer('${q.id}', this.value)" style="padding: 1rem;">
      </div>
    `;
  }

  // Update Nav Buttons
  document.getElementById('btn-prev-question').disabled = index === 0;
  const nextBtn = document.getElementById('btn-next-question');
  if (index === quizState.questions.length - 1) {
    nextBtn.innerText = 'Review & Submit';
    nextBtn.onclick = () => confirmSubmitQuiz();
  } else {
    nextBtn.innerText = 'Next \u2192';
    nextBtn.onclick = () => navigateQuestion(1);
  }

  renderQuestionBubbles();
};

const selectOption = (qId, optionId) => {
  quizState.userAnswers[qId] = { question_id: qId, selected_option_id: optionId };
  renderQuestionIndex(quizState.currentQuestionIndex);
};

const selectTextAnswer = (qId, text) => {
  quizState.userAnswers[qId] = { question_id: qId, text_answer: text };
  renderQuestionBubbles();
};

const navigateQuestion = (direction) => {
  const newIndex = quizState.currentQuestionIndex + direction;
  if (newIndex >= 0 && newIndex < quizState.questions.length) {
    renderQuestionIndex(newIndex);
  }
};

const renderQuestionBubbles = () => {
  const container = document.getElementById('question-bubbles');
  if (!container) return;

  container.innerHTML = quizState.questions.map((q, idx) => {
    const isAnswered = quizState.userAnswers[q.id] ? true : false;
    const isCurrent = idx === quizState.currentQuestionIndex;
    
    let bg = 'var(--bg-main)';
    let color = 'var(--text-main)';
    if (isAnswered) { bg = 'var(--accent)'; color = '#fff'; }
    if (isCurrent) { bg = 'var(--primary)'; color = '#fff'; }

    return `
      <button onclick="renderQuestionIndex(${idx})" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color); background: ${bg}; color: ${color}; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
        ${idx + 1}
      </button>
    `;
  }).join('');
};

// Countdown Timer Controller
const startCountdownTimer = () => {
  const display = document.getElementById('quiz-timer-display');
  
  quizState.timerInterval = setInterval(() => {
    quizState.timeRemainingSeconds--;

    const minutes = Math.floor(quizState.timeRemainingSeconds / 60);
    const seconds = quizState.timeRemainingSeconds % 60;
    
    if (display) {
      display.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (quizState.timeRemainingSeconds <= 0) {
      clearInterval(quizState.timerInterval);
      showToast('Time expired! Submitting your answers automatically...', 'warning');
      submitQuizPayload();
    }
  }, 1000);
};

const confirmSubmitQuiz = () => {
  const answeredCount = Object.keys(quizState.userAnswers).length;
  const totalCount = quizState.questions.length;
  
  if (confirm(`You have answered ${answeredCount} of ${totalCount} questions. Submit assessment now?`)) {
    clearInterval(quizState.timerInterval);
    submitQuizPayload();
  }
};

const submitQuizPayload = async () => {
  const formattedAnswers = Object.values(quizState.userAnswers);

  try {
    showToast('Grading quiz submission...', 'info');
    const res = await apiCall(`/quizzes/${quizState.quizId}/submit`, 'POST', {
      attempt_id: quizState.attemptId,
      answers: formattedAnswers
    });

    if (res.success) {
      showToast('Quiz submitted & graded!', 'success');
      setTimeout(() => {
        window.location.href = `quiz-result.html?attempt_id=${quizState.attemptId}`;
      }, 1000);
    }
  } catch (error) {
    showToast(error.message || 'Submission failed.', 'danger');
  }
};

// Render Quiz Result Breakdown Page
const initQuizResultPage = async () => {
  const container = document.getElementById('quiz-result-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get('attempt_id');

  if (!attemptId) {
    container.innerHTML = `<div class="card text-center"><h3>Invalid Result Attempt ID.</h3></div>`;
    return;
  }

  try {
    const res = await apiCall(`/quizzes/attempts/${attemptId}`);

    if (res.success) {
      const { attempt, answers } = res;
      const statusBadge = attempt.passed 
        ? `<span class="badge badge-accent" style="font-size: 1rem; padding: 0.5rem 1rem;">🎉 PASSED (${attempt.percentage}%)</span>` 
        : `<span class="badge badge-danger" style="font-size: 1rem; padding: 0.5rem 1rem;">❌ FAILED (${attempt.percentage}%)</span>`;

      container.innerHTML = `
        <div class="card mb-4 text-center" style="padding: 2.5rem; background: linear-gradient(135deg, var(--bg-card), var(--primary-light));">
          <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">${attempt.passed ? '🏆' : '📊'}</div>
          <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">${attempt.quiz_title}</h1>
          <p class="text-muted mb-3">${attempt.course_code} - ${attempt.course_title}</p>
          <div class="mb-3">${statusBadge}</div>
          
          <div class="grid grid-cols-3 gap-2 mt-3" style="background-color: var(--bg-card); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div>
              <span class="text-muted" style="font-size: 0.8rem; display: block;">Score Achieved</span>
              <strong style="font-size: 1.25rem; color: var(--primary);">${attempt.score_achieved} Marks</strong>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.8rem; display: block;">Percentage</span>
              <strong style="font-size: 1.25rem; color: var(--secondary);">${attempt.percentage}%</strong>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.8rem; display: block;">Submission Date</span>
              <strong style="font-size: 0.95rem;">${formatDate(attempt.submitted_at)}</strong>
            </div>
          </div>
        </div>

        <h3 class="mb-3">Question Feedback & Correct Explanations</h3>

        <div class="flex flex-col gap-3 mb-4">
          ${answers.map((ans, idx) => `
            <div class="card" style="border-left: 5px solid ${ans.is_correct ? 'var(--accent)' : 'var(--danger)'};">
              <div class="flex justify-between items-center mb-2">
                <strong>Question ${idx + 1}</strong>
                <span class="badge ${ans.is_correct ? 'badge-accent' : 'badge-danger'}">
                  ${ans.is_correct ? `+${ans.marks_awarded} Marks` : '0 Marks'}
                </span>
              </div>
              <p style="font-weight: 600; font-size: 1.05rem; margin-bottom: 1rem;">${escapeHtml(ans.question_text)}</p>
              
              <div style="font-size: 0.9rem;" class="mb-2">
                <span class="text-muted">Your Answer:</span> 
                <strong style="color: ${ans.is_correct ? 'var(--accent)' : 'var(--danger)'};">${escapeHtml(ans.selected_option_text || ans.text_answer || 'No Answer Provided')}</strong>
              </div>

              ${!ans.is_correct ? `
                <div style="font-size: 0.9rem;" class="mb-2">
                  <span class="text-muted">Correct Answer:</span> 
                  <strong style="color: var(--accent);">${escapeHtml(ans.correct_option_text || ans.correct_answer_text || 'N/A')}</strong>
                </div>
              ` : ''}

              ${ans.explanation ? `
                <div style="background-color: var(--bg-main); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-muted);" class="mt-2">
                  <strong>💡 Explanation:</strong> ${escapeHtml(ans.explanation)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="flex justify-between">
          <a href="quizzes.html" class="btn btn-outline">&larr; Back to Quizzes</a>
          <a href="dashboard-student.html" class="btn btn-primary">Go to Student Dashboard &rarr;</a>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p style="color: var(--danger);">${err.message}</p></div>`;
  }
};

// Lecturer Quiz & Question Builder Handler
const initCreateQuizForm = async () => {
  const form = document.getElementById('create-quiz-form');
  const courseSelect = document.getElementById('quiz-course');

  if (!form) return;

  try {
    const coursesRes = await apiCall('/courses');
    if (coursesRes.success && coursesRes.data) {
      courseSelect.innerHTML = '<option value="">-- Select Course Code --</option>';
      coursesRes.data.forEach(c => courseSelect.innerHTML += `<option value="${c.id}">${c.course_code} - ${c.course_title}</option>`);
    }
  } catch (e) {}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('quiz-title').value.trim();
    const course_id = document.getElementById('quiz-course').value;
    const duration_minutes = document.getElementById('quiz-duration').value;
    const pass_percentage = document.getElementById('quiz-passmark').value;
    const max_attempts = document.getElementById('quiz-maxattempts').value;

    try {
      const res = await apiCall('/quizzes', 'POST', {
        title, course_id, duration_minutes, pass_percentage, max_attempts
      });

      if (res.success) {
        showToast('Quiz created! Now add questions below.', 'success');
        document.getElementById('quiz-builder-step2').style.display = 'block';
        window.createdQuizId = res.data.id;
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

const handleAddQuestionSubmit = async () => {
  const quizId = window.createdQuizId;
  if (!quizId) return showToast('Please create quiz header first.', 'warning');

  const question_text = document.getElementById('q-text').value.trim();
  const optionA = document.getElementById('q-opt-a').value.trim();
  const optionB = document.getElementById('q-opt-b').value.trim();
  const optionC = document.getElementById('q-opt-c').value.trim();
  const optionD = document.getElementById('q-opt-d').value.trim();
  const correctIdx = document.querySelector('input[name="correct-option"]:checked').value;

  const options = [
    { option_text: optionA, is_correct: correctIdx === 'A' },
    { option_text: optionB, is_correct: correctIdx === 'B' },
    { option_text: optionC, is_correct: correctIdx === 'C' },
    { option_text: optionD, is_correct: correctIdx === 'D' }
  ];

  try {
    const res = await apiCall(`/quizzes/${quizId}/questions`, 'POST', {
      question_text,
      question_type: 'mcq',
      marks: 1,
      options
    });

    if (res.success) {
      showToast('Question added to quiz!', 'success');
      document.getElementById('q-text').value = '';
      document.getElementById('q-opt-a').value = '';
      document.getElementById('q-opt-b').value = '';
      document.getElementById('q-opt-c').value = '';
      document.getElementById('q-opt-d').value = '';
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
};
