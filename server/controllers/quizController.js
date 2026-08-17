const { query } = require('../config/db');
const { randomUUID } = require('crypto');

/**
 * Create a New Quiz (Lecturers & Admins)
 */
const createQuiz = async (req, res, next) => {
  try {
    const {
      title,
      description,
      course_id,
      duration_minutes = 30,
      total_marks = 100,
      pass_percentage = 50,
      max_attempts = 3,
      randomize_questions = true,
      randomize_options = true,
      show_explanation = true,
      start_time,
      end_time
    } = req.body;

    if (!title || !course_id) {
      return res.status(400).json({ success: false, message: 'Quiz title and course ID are required.' });
    }

    const creator_id = req.user.id;

    const quizId = randomUUID();
    const insertRes = await query(
      `INSERT INTO quizzes (
        id, title, description, course_id, creator_id, duration_minutes,
        total_marks, pass_percentage, max_attempts, randomize_questions,
        randomize_options, show_explanation, start_time, end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        quizId,
        title,
        description || '',
        course_id,
        creator_id,
        duration_minutes,
        total_marks,
        pass_percentage,
        max_attempts,
        randomize_questions,
        randomize_options,
        show_explanation,
        start_time || null,
        end_time || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Quiz created successfully! You can now add questions.',
      data: insertRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add Question to Quiz (with options for MCQ/True-False)
 */
const addQuestion = async (req, res, next) => {
  try {
    const { quiz_id } = req.params;
    const {
      question_text,
      question_type = 'mcq',
      marks = 1,
      difficulty = 'medium',
      explanation,
      correct_answer_text,
      options = []
    } = req.body;

    if (!question_text) {
      return res.status(400).json({ success: false, message: 'Question text is required.' });
    }

    // Insert Question Record
    const questionId = randomUUID();
    const questionRes = await query(
      `INSERT INTO quiz_questions (
        id, quiz_id, question_text, question_type, marks, difficulty, explanation, correct_answer_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [questionId, quiz_id, question_text, question_type, marks, difficulty, explanation || '', correct_answer_text || null]
    );

    const newQuestion = questionRes.rows[0];

    // If MCQ or True/False, insert options
    if (['mcq', 'true_false'].includes(question_type) && options.length > 0) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        await query(
          `INSERT INTO quiz_options (id, question_id, option_text, is_correct, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), newQuestion.id, opt.option_text, opt.is_correct ? 1 : 0, i + 1]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Question added successfully!',
      data: newQuestion
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Available Active Quizzes (Filtered by course, department, level)
 */
const getQuizzes = async (req, res, next) => {
  try {
    const { course_id, department_id, level_id, search } = req.query;

    let sql = `
      SELECT q.*, 
             c.course_code, c.course_title,
             d.name as department_name, d.code as department_code,
             l.level_name,
             u.first_name as creator_first_name, u.last_name as creator_last_name,
             (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as question_count
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      JOIN academic_levels l ON c.level_id = l.id
      JOIN users u ON q.creator_id = u.id
      WHERE q.is_active = TRUE
    `;

    const params = [];

    if (course_id) {
      params.push(course_id);
      sql += ` AND q.course_id = $${params.length}`;
    }

    if (department_id) {
      params.push(department_id);
      sql += ` AND c.department_id = $${params.length}`;
    }

    if (level_id) {
      params.push(level_id);
      sql += ` AND c.level_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (q.title ILIKE $${params.length} OR c.course_code ILIKE $${params.length} OR c.course_title ILIKE $${params.length})`;
    }

    sql += ` ORDER BY q.created_at DESC`;

    const quizzesRes = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: quizzesRes.rows.length,
      data: quizzesRes.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Quiz Details & Questions for Quiz Execution (OMITS is_correct FOR SECURITY)
 */
const getQuizForAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    // Fetch quiz info
    const quizRes = await query(
      `SELECT q.*, c.course_code, c.course_title, d.name as department_name
       FROM quizzes q
       JOIN courses c ON q.course_id = c.id
       JOIN departments d ON c.department_id = d.id
       WHERE q.id = $1 AND q.is_active = TRUE`,
      [id]
    );

    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found or inactive.' });
    }

    const quiz = quizRes.rows[0];

    // Check student attempt count
    const attemptCountRes = await query(
      `SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2 AND status = 'completed'`,
      [id, studentId]
    );
    const completedAttempts = parseInt(attemptCountRes.rows[0].count);

    if (completedAttempts >= quiz.max_attempts) {
      return res.status(403).json({
        success: false,
        message: `You have reached the maximum allowed attempts (${quiz.max_attempts}) for this quiz.`
      });
    }

    // Fetch Questions
    let questionOrder = quiz.randomize_questions ? 'RANDOM()' : 'order_index ASC, created_at ASC';
    const questionsRes = await query(
      `SELECT id, quiz_id, question_text, question_type, marks, difficulty 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY ${questionOrder}`,
      [id]
    );

    const questions = questionsRes.rows;

    // Fetch Options for each question (Excluding `is_correct`!)
    for (let q of questions) {
      let optionOrder = quiz.randomize_options ? 'RANDOM()' : 'order_index ASC';
      const optionsRes = await query(
        `SELECT id, question_id, option_text 
         FROM quiz_options 
         WHERE question_id = $1 
         ORDER BY ${optionOrder}`,
        [q.id]
      );
      q.options = optionsRes.rows;
    }

    return res.status(200).json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        course_code: quiz.course_code,
        course_title: quiz.course_title,
        duration_minutes: quiz.duration_minutes,
        total_marks: quiz.total_marks,
        pass_percentage: quiz.pass_percentage,
        max_attempts: quiz.max_attempts,
        attempts_used: completedAttempts,
        questions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start Quiz Attempt
 */
const startQuizAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    // Check attempts limit
    const attemptCountRes = await query(
      `SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2`,
      [id, studentId]
    );
    const attemptNum = parseInt(attemptCountRes.rows[0].count) + 1;

    // Insert attempt record
    const attemptId = randomUUID();
    const attemptRes = await query(
      `INSERT INTO quiz_attempts (id, quiz_id, student_id, attempt_number, started_at, status)
       VALUES ($1, $2, $3, $4, datetime('now'), 'in_progress')
       RETURNING *`,
      [attemptId, id, studentId, attemptNum]
    );

    return res.status(201).json({
      success: true,
      message: 'Quiz attempt started!',
      attempt: attemptRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit & Automatically Grade Quiz Attempt
 */
const submitQuizAttempt = async (req, res, next) => {
  try {
    const { id } = req.params; // quiz_id
    const { attempt_id, answers } = req.body; // answers = [{ question_id, selected_option_id, text_answer }]
    const studentId = req.user.id;

    // Retrieve quiz and question correct options
    const quizRes = await query('SELECT total_marks, pass_percentage FROM quizzes WHERE id = $1', [id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const quiz = quizRes.rows[0];

    // Fetch all questions and correct option IDs for this quiz
    const questionsRes = await query(
      `SELECT qq.id, qq.marks, qq.question_type, qq.correct_answer_text,
              qo.id as correct_option_id
       FROM quiz_questions qq
       LEFT JOIN quiz_options qo ON qq.id = qo.question_id AND qo.is_correct = TRUE
       WHERE qq.quiz_id = $1`,
      [id]
    );

    const questionMap = {};
    let maxPossibleScore = 0;

    questionsRes.rows.forEach(row => {
      if (!questionMap[row.id]) {
        questionMap[row.id] = {
          marks: row.marks,
          question_type: row.question_type,
          correct_answer_text: row.correct_answer_text,
          correct_option_ids: []
        };
        maxPossibleScore += row.marks;
      }
      if (row.correct_option_id) {
        questionMap[row.id].correct_option_ids.push(row.correct_option_id);
      }
    });

    let totalScoreAchieved = 0;

    // Grade each submitted answer
    if (Array.isArray(answers)) {
      for (const ans of answers) {
        const qInfo = questionMap[ans.question_id];
        if (!qInfo) continue;

        let isCorrect = false;
        let marksAwarded = 0;

        if (['mcq', 'true_false'].includes(qInfo.question_type)) {
          if (ans.selected_option_id && qInfo.correct_option_ids.includes(ans.selected_option_id)) {
            isCorrect = true;
            marksAwarded = qInfo.marks;
          }
        } else if (['fill_blank', 'short_answer'].includes(qInfo.question_type)) {
          if (ans.text_answer && qInfo.correct_answer_text && 
              ans.text_answer.trim().toLowerCase() === qInfo.correct_answer_text.trim().toLowerCase()) {
            isCorrect = true;
            marksAwarded = qInfo.marks;
          }
        }

        totalScoreAchieved += marksAwarded;

        // Save answer detail in DB
        await query(
          `INSERT INTO quiz_answers (id, attempt_id, question_id, selected_option_id, text_answer, is_correct, marks_awarded)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), attempt_id, ans.question_id, ans.selected_option_id || null, ans.text_answer || null, isCorrect ? 1 : 0, marksAwarded]
        );
      }
    }

    // Compute percentage & pass/fail status
    const percentage = maxPossibleScore > 0 ? (totalScoreAchieved / maxPossibleScore) * 100 : 0;
    const passed = percentage >= parseFloat(quiz.pass_percentage);

    // Update Attempt Record
    const updateRes = await query(
      `UPDATE quiz_attempts
       SET submitted_at = CURRENT_TIMESTAMP,
           score_achieved = $1,
           percentage = $2,
           passed = $3,
           status = 'completed'
       WHERE id = $4 AND student_id = $5
       RETURNING *`,
      [totalScoreAchieved, percentage.toFixed(2), passed, attempt_id, studentId]
    );

    // Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [studentId, 'QUIZ_SUBMITTED', JSON.stringify({ quiz_id: id, attempt_id, percentage, passed })]
    );

    return res.status(200).json({
      success: true,
      message: passed ? 'Congratulations! You passed the quiz.' : 'Quiz completed.',
      result: {
        attempt_id,
        score_achieved: totalScoreAchieved,
        max_possible_score: maxPossibleScore,
        percentage: parseFloat(percentage.toFixed(2)),
        passed,
        pass_percentage: quiz.pass_percentage
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Quiz Attempt Detailed Score Breakdown & Feedback
 */
const getAttemptResult = async (req, res, next) => {
  try {
    const { attempt_id } = req.params;

    const attemptRes = await query(
      `SELECT qa.*, q.title as quiz_title, q.show_explanation, c.course_code, c.course_title
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN courses c ON q.course_id = c.id
       WHERE qa.id = $1`,
      [attempt_id]
    );

    if (attemptRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attempt record not found.' });
    }

    const attempt = attemptRes.rows[0];

    // Fetch answers breakdown
    const answersRes = await query(
      `SELECT ans.*, 
              qq.question_text, qq.question_type, qq.marks as question_marks, qq.explanation, qq.correct_answer_text,
              qo.option_text as selected_option_text,
              (SELECT option_text FROM quiz_options WHERE question_id = qq.id AND is_correct = TRUE LIMIT 1) as correct_option_text
       FROM quiz_answers ans
       JOIN quiz_questions qq ON ans.question_id = qq.id
       LEFT JOIN quiz_options qo ON ans.selected_option_id = qo.id
       WHERE ans.attempt_id = $1`,
      [attempt_id]
    );

    return res.status(200).json({
      success: true,
      attempt,
      answers: answersRes.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student Quiz Attempts History
 */
const getStudentQuizHistory = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const historyRes = await query(
      `SELECT qa.*, q.title as quiz_title, c.course_code, c.course_title
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN courses c ON q.course_id = c.id
       WHERE qa.student_id = $1
       ORDER BY qa.started_at DESC`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      count: historyRes.rows.length,
      data: historyRes.rows
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuiz,
  addQuestion,
  getQuizzes,
  getQuizForAttempt,
  startQuizAttempt,
  submitQuizAttempt,
  getAttemptResult,
  getStudentQuizHistory
};
