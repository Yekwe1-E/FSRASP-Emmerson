const { body, validationResult } = require('express-validator');

/**
 * Handle express-validator results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ field: err.path, message: err.msg }));

  return res.status(400).json({
    success: false,
    message: 'Validation failed. Please correct the highlighted errors.',
    errors: extractedErrors
  });
};

/**
 * User Registration Validation Schema
 */
const registerValidationRules = () => [
  body('first_name')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('last_name')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['student', 'lecturer']).withMessage('Role must be either student or lecturer'),
  body('department_id')
    .optional({ checkFalsy: true })
    .trim(),
  body('level_id')
    .optional({ checkFalsy: true })
    .trim(),
  body('matric_number')
    .optional({ checkFalsy: true })
    .trim(),
  body('staff_id')
    .optional({ checkFalsy: true })
    .trim()
];

/**
 * User Login Validation Schema
 */
const loginValidationRules = () => [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address'),
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Password Reset / Change Validation Schema
 */
const changePasswordValidationRules = () => [
  body('current_password')
    .notEmpty().withMessage('Current password is required'),
  body('new_password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
];

module.exports = {
  validate,
  registerValidationRules,
  loginValidationRules,
  changePasswordValidationRules
};
