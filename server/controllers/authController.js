const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken } = require('../config/jwt');

// Portable UUID generator (works in both PostgreSQL and SQLite mode)
const { randomUUID } = require('crypto');

/**
 * Get Public Academic Metadata (Departments, Levels, Semesters, Sessions) for registration & filters
 */
const getAcademicMetadata = async (req, res, next) => {
  try {
    const departmentsRes = await query('SELECT id, name, code FROM departments ORDER BY name ASC');
    const levelsRes = await query('SELECT id, level_code, level_name FROM academic_levels ORDER BY level_code ASC');
    const semestersRes = await query('SELECT id, name, code FROM semesters ORDER BY code ASC');
    const sessionsRes = await query('SELECT id, session_name, is_current FROM academic_sessions ORDER BY session_name DESC');

    return res.status(200).json({
      success: true,
      data: {
        departments: departmentsRes.rows,
        levels: levelsRes.rows,
        semesters: semestersRes.rows,
        sessions: sessionsRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User Registration Controller
 */
const register = async (req, res, next) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      role,
      department_id,
      level_id,
      matric_number,
      staff_id
    } = req.body;

    // Check if user with given email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    // Check matric number / staff ID uniqueness if provided
    if (role === 'student' && matric_number) {
      const existingMatric = await query('SELECT id FROM users WHERE matric_number = $1', [matric_number]);
      if (existingMatric.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Matriculation number already registered.'
        });
      }
    }

    if (role === 'lecturer' && staff_id) {
      const existingStaff = await query('SELECT id FROM users WHERE staff_id = $1', [staff_id]);
      if (existingStaff.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID number already registered.'
        });
      }
    }

    // Hash password with Bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Lecturers require admin approval; students are automatically approved
    const is_approved = role === 'lecturer' ? false : true;

    // Insert user (id supplied explicitly for SQLite/PostgreSQL compatibility)
    const newId = randomUUID();
    const insertRes = await query(
      `INSERT INTO users (
        id, first_name, last_name, email, password_hash, role,
        department_id, level_id, matric_number, staff_id, is_approved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, first_name, last_name, email, role, is_approved, created_at`,
      [
        newId,
        first_name,
        last_name,
        email.toLowerCase(),
        password_hash,
        role,
        department_id || null,
        level_id || null,
        role === 'student' ? matric_number || null : null,
        role === 'lecturer' ? staff_id || null : null,
        is_approved
      ]
    );

    const newUser = insertRes.rows[0];

    // Log audit action
    await query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) 
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, 'USER_REGISTERED', JSON.stringify({ email: newUser.email, role: newUser.role }), req.ip]
    );

    // If lecturer, notify that approval is pending
    if (role === 'lecturer') {
      return res.status(201).json({
        success: true,
        message: 'Lecturer account created successfully! Your account is pending admin approval before login.',
        user: {
          id: newUser.id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          email: newUser.email,
          role: newUser.role,
          is_approved: false
        }
      });
    }

    // Generate JWT token for student
    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to FSARAP NDU.',
      token,
      user: {
        id: newUser.id,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        role: newUser.role,
        is_approved: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User Login Controller
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Retrieve user record
    const userRes = await query(
      `SELECT u.*, d.name as department_name, l.level_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       LEFT JOIN academic_levels l ON u.level_id = l.id 
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.'
      });
    }

    const user = userRes.rows[0];

    // Compare Bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.'
      });
    }

    // Account status checks
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact the administrator.'
      });
    }

    if (user.role === 'lecturer' && !user.is_approved) {
      return res.status(403).json({
        success: false,
        message: 'Your lecturer account is pending administrator approval.'
      });
    }

    // Update last_login timestamp
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address) VALUES ($1, $2, $3)`,
      [user.id, 'USER_LOGIN', req.ip]
    );

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        level_id: user.level_id,
        level_name: user.level_name,
        matric_number: user.matric_number,
        staff_id: user.staff_id,
        avatar_url: user.avatar_url,
        is_approved: user.is_approved
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Logged-in User Profile
 */
const getMe = async (req, res, next) => {
  try {
    const userRes = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.department_id, u.level_id, 
              u.matric_number, u.staff_id, u.avatar_url, u.is_active, u.is_approved, u.created_at, u.last_login,
              d.name as department_name, d.code as department_code, l.level_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN academic_levels l ON u.level_id = l.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    return res.status(200).json({
      success: true,
      user: userRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Profile Information
 */
const updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, department_id, level_id, matric_number, staff_id } = req.body;

    const updateRes = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           department_id = COALESCE($3, department_id),
           level_id = COALESCE($4, level_id),
           matric_number = COALESCE($5, matric_number),
           staff_id = COALESCE($6, staff_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, first_name, last_name, email, role, department_id, level_id, matric_number, staff_id`,
      [first_name, last_name, department_id, level_id, matric_number, staff_id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: updateRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password Controller
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.user.id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address) VALUES ($1, $2, $3)`,
      [req.user.id, 'PASSWORD_CHANGED', req.ip]
    );

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully!'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout Controller
 */
const logout = async (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

module.exports = {
  getAcademicMetadata,
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
};
