const express = require('express');
const router = express.Router();
const {
  createQuiz,
  addQuestion,
  getQuizzes,
  getQuizForAttempt,
  startQuizAttempt,
  submitQuizAttempt,
  getAttemptResult,
  getStudentQuizHistory
} = require('../controllers/quizController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public / Student Routes
router.get('/', getQuizzes);
router.get('/history', authenticateToken, getStudentQuizHistory);
router.get('/attempts/:attempt_id', authenticateToken, getAttemptResult);
router.get('/:id/take', authenticateToken, getQuizForAttempt);

// Quiz Execution
router.post('/:id/start', authenticateToken, startQuizAttempt);
router.post('/:id/submit', authenticateToken, submitQuizAttempt);

// Lecturer & Admin Quiz Creation & Question Builder
router.post('/', authenticateToken, authorizeRoles('lecturer', 'faculty_admin', 'super_admin'), createQuiz);
router.post('/:quiz_id/questions', authenticateToken, authorizeRoles('lecturer', 'faculty_admin', 'super_admin'), addQuestion);

module.exports = router;
