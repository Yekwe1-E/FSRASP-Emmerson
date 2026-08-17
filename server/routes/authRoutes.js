const express = require('express');
const router = express.Router();
const {
  getAcademicMetadata,
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const {
  validate,
  registerValidationRules,
  loginValidationRules,
  changePasswordValidationRules
} = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');

// Public metadata route for registration dropdowns
router.get('/metadata', getAcademicMetadata);

// Authentication Endpoints
router.post('/register', authLimiter, registerValidationRules(), validate, register);
router.post('/login', authLimiter, loginValidationRules(), validate, login);
router.post('/logout', logout);

// Protected Endpoints
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePasswordValidationRules(), validate, changePassword);

module.exports = router;
