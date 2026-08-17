const { query } = require('../config/db');

/**
 * Get List of Courses filtered by department, level, or semester
 */
const getCourses = async (req, res, next) => {
  try {
    const { department_id, level_id, semester_id, search } = req.query;

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code, 
             l.level_name, s.name as semester_name,
             u.first_name as lecturer_first_name, u.last_name as lecturer_last_name
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      JOIN academic_levels l ON c.level_id = l.id
      JOIN semesters s ON c.semester_id = s.id
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (department_id) {
      params.push(department_id);
      sql += ` AND c.department_id = $${params.length}`;
    }

    if (level_id) {
      params.push(level_id);
      sql += ` AND c.level_id = $${params.length}`;
    }

    if (semester_id) {
      params.push(semester_id);
      sql += ` AND c.semester_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.course_code ILIKE $${params.length} OR c.course_title ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.course_code ASC`;

    const coursesRes = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: coursesRes.rows.length,
      data: coursesRes.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a New Course (Lecturers and Admins)
 */
const createCourse = async (req, res, next) => {
  try {
    const { course_code, course_title, credit_units, department_id, level_id, semester_id } = req.body;

    // Check if course code already exists in department
    const existing = await query('SELECT id FROM courses WHERE LOWER(course_code) = LOWER($1) AND department_id = $2', [course_code, department_id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Course '${course_code}' already exists in this department.`
      });
    }

    const lecturer_id = req.user.role === 'lecturer' ? req.user.id : null;

    const insertRes = await query(
      `INSERT INTO courses (course_code, course_title, credit_units, department_id, level_id, semester_id, lecturer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [course_code.toUpperCase(), course_title, credit_units || 3, department_id, level_id, semester_id, lecturer_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Course added successfully!',
      data: insertRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourses,
  createCourse
};
