const { query } = require('../config/db');

/**
 * Super Admin Dashboard Analytics & Overview
 */
const getAdminDashboardStats = async (req, res, next) => {
  try {
    // User role breakdown
    const userCountsRes = await query(`
      SELECT 
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as student_count,
        SUM(CASE WHEN role = 'lecturer' THEN 1 ELSE 0 END) as lecturer_count,
        SUM(CASE WHEN role = 'lecturer' AND is_approved = 0 THEN 1 ELSE 0 END) as pending_lecturers_count,
        SUM(CASE WHEN role = 'faculty_admin' THEN 1 ELSE 0 END) as faculty_admin_count,
        COUNT(*) as total_users
      FROM users
    `);

    // Repository metrics
    const materialsRes = await query(`
      SELECT 
        COUNT(*) as total_materials,
        COALESCE(SUM(download_count), 0) as total_downloads,
        SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) as pending_materials_count
      FROM materials
    `);

    // Quiz & Assessment metrics
    const quizzesRes = await query(`
      SELECT 
        COUNT(*) as total_quizzes,
        (SELECT COUNT(*) FROM quiz_attempts) as total_attempts,
        (SELECT COALESCE(AVG(percentage), 0) FROM quiz_attempts WHERE status = 'completed') as average_score
      FROM quizzes
    `);

    // Pending Lecturers list
    const pendingLecturersRes = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.staff_id, u.created_at, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'lecturer' AND u.is_approved = 0
      ORDER BY u.created_at DESC
    `);

    // System Users List for Management
    const usersListRes = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.is_approved, u.created_at, u.last_login, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);

    // Recent Audit Logs
    const auditLogsRes = await query(`
      SELECT a.*, u.first_name, u.last_name, u.email, u.role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      data: {
        users: userCountsRes.rows[0],
        repository: materialsRes.rows[0],
        quizzes: quizzesRes.rows[0],
        pending_lecturers: pendingLecturersRes.rows,
        users_list: usersListRes.rows,
        audit_logs: auditLogsRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Faculty Administrator Dashboard Overview
 */
const getFacultyDashboardStats = async (req, res, next) => {
  try {
    const deptStatsRes = await query(`
      SELECT d.id, d.name, d.code,
             COUNT(DISTINCT CASE WHEN u.role = 'lecturer' THEN u.id END) as lecturer_count,
             COUNT(DISTINCT m.id) as material_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      LEFT JOIN materials m ON m.department_id = d.id
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `);

    const pendingLecturersRes = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.staff_id, u.created_at, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'lecturer' AND u.is_approved = 0
    `);

    return res.status(200).json({
      success: true,
      data: {
        departments: deptStatsRes.rows,
        pending_lecturers: pendingLecturersRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lecturer Dashboard Analytics & Upload History
 */
const getLecturerDashboardStats = async (req, res, next) => {
  try {
    const lecturerId = req.user.id;

    // Lecturer material metrics
    const matStatsRes = await query(`
      SELECT 
        COUNT(*) as total_uploaded,
        COALESCE(SUM(download_count), 0) as total_downloads,
        SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) as pending_count
      FROM materials
      WHERE uploader_id = $1
    `, [lecturerId]);

    // Lecturer materials list
    const materialsRes = await query(`
      SELECT m.*, c.course_code, c.course_title, d.code as department_code, l.level_code
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      JOIN departments d ON m.department_id = d.id
      JOIN academic_levels l ON m.level_id = l.id
      WHERE m.uploader_id = $1
      ORDER BY m.created_at DESC
    `, [lecturerId]);

    // Lecturer created quizzes
    const quizzesRes = await query(`
      SELECT q.*, c.course_code, c.course_title,
             (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id) as total_attempts,
             (SELECT COALESCE(AVG(percentage), 0) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND status = 'completed') as average_percentage
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      WHERE q.creator_id = $1
      ORDER BY q.created_at DESC
    `, [lecturerId]);

    return res.status(200).json({
      success: true,
      data: {
        stats: matStatsRes.rows[0],
        materials: materialsRes.rows,
        quizzes: quizzesRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Student Dashboard Stats & Bookmarks
 */
const getStudentDashboardStats = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    // Student quiz performance stats
    const quizStatsRes = await query(`
      SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_count,
        COALESCE(AVG(percentage), 0) as average_score
      FROM quiz_attempts
      WHERE student_id = $1 AND status = 'completed'
    `, [studentId]);

    // Bookmarked materials count
    const bookmarksCountRes = await query(`
      SELECT COUNT(*) as count FROM material_bookmarks WHERE user_id = $1
    `, [studentId]);


    // Recent Downloads Audit
    const downloadsRes = await query(`
      SELECT md.downloaded_at, m.id as material_id, m.title, m.file_type, c.course_code, d.code as department_code
      FROM material_downloads md
      JOIN materials m ON md.material_id = m.id
      JOIN courses c ON m.course_id = c.id
      JOIN departments d ON m.department_id = d.id
      WHERE md.user_id = $1
      ORDER BY md.downloaded_at DESC
      LIMIT 5
    `, [studentId]);

    // Recommended Materials based on student level / department
    const studentDeptId = req.user.department_id;
    const studentLevelId = req.user.level_id;

    let recSql = `
      SELECT m.*, c.course_code, c.course_title, d.code as department_code, l.level_code,
             EXISTS(SELECT 1 FROM material_bookmarks mb WHERE mb.material_id = m.id AND mb.user_id = $1) as is_bookmarked
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      JOIN departments d ON m.department_id = d.id
      JOIN academic_levels l ON m.level_id = l.id
      WHERE m.approval_status = 'approved'
    `;
    const recParams = [studentId];

    if (studentDeptId) {
      recParams.push(studentDeptId);
      recSql += ` AND m.department_id = $${recParams.length}`;
    }

    if (studentLevelId) {
      recParams.push(studentLevelId);
      recSql += ` AND m.level_id = $${recParams.length}`;
    }

    recSql += ` ORDER BY m.download_count DESC LIMIT 6`;

    const recommendedRes = await query(recSql, recParams);

    return res.status(200).json({
      success: true,
      data: {
        quiz_stats: {
          total_attempts: parseInt(quizStatsRes.rows[0].total_attempts),
          passed_count: parseInt(quizStatsRes.rows[0].passed_count),
          average_score: parseFloat(parseFloat(quizStatsRes.rows[0].average_score).toFixed(2))
        },
        bookmarked_count: parseInt(bookmarksCountRes.rows[0].count),
        recent_downloads: downloadsRes.rows,
        recommended_materials: recommendedRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle User Approval (Admins)
 */
const toggleUserApproval = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { is_approved } = req.body;

    const updateRes = await query(
      `UPDATE users SET is_approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, role, is_approved`,
      [is_approved, userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `User approval status updated to ${is_approved ? 'APPROVED' : 'PENDING'}.`,
      user: updateRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle User Active Status (Admins)
 */
const toggleUserActive = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    const updateRes = await query(
      `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, is_active`,
      [is_active, userId]
    );

    return res.status(200).json({
      success: true,
      message: `User account has been ${is_active ? 'activated' : 'deactivated'}.`,
      user: updateRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboardStats,
  getFacultyDashboardStats,
  getLecturerDashboardStats,
  getStudentDashboardStats,
  toggleUserApproval,
  toggleUserActive
};
