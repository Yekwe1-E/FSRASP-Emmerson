const { verifyToken } = require('../config/jwt');
const { query } = require('../config/db');

/**
 * Authentication Middleware: Validates JWT token in request header or cookies
 */
const authenticateToken = async (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Fetch user details from database to ensure user is active & approved
    const userRes = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.is_approved, u.department_id, u.level_id, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session. User no longer exists.'
      });
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact administration.'
      });
    }

    if (user.role === 'lecturer' && !user.is_approved) {
      return res.status(403).json({
        success: false,
        message: 'Your lecturer account is pending admin approval.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or corrupted authentication token.'
    });
  }
};

/**
 * Authorization Middleware: Checks if user possesses one of the allowed roles
 * @param {...string} allowedRoles - List of authorized user roles
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
