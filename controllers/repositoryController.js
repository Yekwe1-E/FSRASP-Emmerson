const { query } = require('../config/db');
const { uploadFileToStorage, deleteFileFromStorage } = require('../config/storage');
const path = require('path');
const { randomUUID } = require('crypto');

/**
 * Upload Lecture Material (Lecturer & Admin)
 */
const uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach a lecture material file to upload.' });
    }

    const {
      title,
      description,
      course_id,
      department_id,
      level_id,
      semester_id,
      session_id,
      category
    } = req.body;

    if (!title || !course_id || !department_id || !level_id || !semester_id || !session_id) {
      return res.status(400).json({ success: false, message: 'Missing required metadata fields.' });
    }

    // Fetch department code and level code to organize storage paths
    const deptRes = await query('SELECT code FROM departments WHERE id = $1', [department_id]);
    const levelRes = await query('SELECT level_code FROM academic_levels WHERE id = $1', [level_id]);

    const deptCode = deptRes.rows[0]?.code || 'FSC';
    const levelCode = levelRes.rows[0]?.level_code || '100';
    const destinationFolder = `${deptCode}/${levelCode}L`;

    // Upload to Supabase Storage Bucket
    const { file_url, file_path } = await uploadFileToStorage(req.file, destinationFolder);

    const file_type = path.extname(req.file.originalname).replace('.', '').toLowerCase();
    const file_size = req.file.size;
    const uploader_id = req.user.id;

    // Materials uploaded by approved Lecturers or Admins default to approved
    const approval_status = (req.user.role === 'super_admin' || req.user.role === 'faculty_admin' || req.user.is_approved) 
      ? 'approved' 
      : 'pending';

    const materialId = randomUUID();
    const insertRes = await query(
      `INSERT INTO materials (
        id, title, description, course_id, department_id, level_id, semester_id, session_id,
        uploader_id, category, file_url, file_path, file_type, file_size, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        materialId,
        title,
        description || '',
        course_id,
        department_id,
        level_id,
        semester_id,
        session_id,
        uploader_id,
        category || 'Lecture Notes',
        file_url,
        file_path,
        file_type,
        file_size,
        approval_status
      ]
    );

    const newMaterial = insertRes.rows[0];

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [uploader_id, 'MATERIAL_UPLOADED', JSON.stringify({ material_id: newMaterial.id, title })]
    );

    return res.status(201).json({
      success: true,
      message: 'Lecture material uploaded successfully!',
      data: newMaterial
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Advanced Search & Filter Repository Engine
 */
const getMaterials = async (req, res, next) => {
  try {
    const {
      search,
      department_id,
      department_code,
      level_id,
      level_code,
      semester_id,
      session_id,
      category,
      file_type,
      uploader_id,
      approval_status = 'approved',
      page = 1,
      limit = 12
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user ? req.user.id : null;

    let sql = `
      SELECT m.*, 
             c.course_code, c.course_title, 
             d.name as department_name, d.code as department_code,
             l.level_name, l.level_code,
             s.name as semester_name,
             sess.session_name,
             u.first_name as uploader_first_name, u.last_name as uploader_last_name, u.role as uploader_role,
             ${userId ? `EXISTS(SELECT 1 FROM material_bookmarks mb WHERE mb.material_id = m.id AND mb.user_id = $1) as is_bookmarked` : 'FALSE as is_bookmarked'}
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      JOIN departments d ON m.department_id = d.id
      JOIN academic_levels l ON m.level_id = l.id
      JOIN semesters s ON m.semester_id = s.id
      JOIN academic_sessions sess ON m.session_id = sess.id
      JOIN users u ON m.uploader_id = u.id
      WHERE 1=1
    `;

    const params = [];
    if (userId) params.push(userId);

    // Filter by approval status unless user is viewing their own uploads or is admin
    if (req.user && (req.user.role === 'super_admin' || req.user.role === 'faculty_admin')) {
      if (approval_status && approval_status !== 'all') {
        params.push(approval_status);
        sql += ` AND m.approval_status = $${params.length}`;
      }
    } else if (uploader_id && userId === uploader_id) {
      // User viewing their own uploads can see pending
    } else {
      params.push('approved');
      sql += ` AND m.approval_status = $${params.length}`;

    }

    if (department_id) {
      params.push(department_id);
      sql += ` AND m.department_id = $${params.length}`;
    }

    if (department_code) {
      params.push(department_code.toUpperCase());
      sql += ` AND UPPER(d.code) = $${params.length}`;
    }

    if (level_id) {
      params.push(level_id);
      sql += ` AND m.level_id = $${params.length}`;
    }

    if (level_code) {
      params.push(level_code);
      sql += ` AND l.level_code = $${params.length}`;
    }

    if (semester_id) {
      params.push(semester_id);
      sql += ` AND m.semester_id = $${params.length}`;
    }

    if (session_id) {
      params.push(session_id);
      sql += ` AND m.session_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      sql += ` AND m.category = $${params.length}`;
    }

    if (file_type) {
      params.push(file_type.toLowerCase());
      sql += ` AND LOWER(m.file_type) = $${params.length}`;
    }

    if (uploader_id) {
      params.push(uploader_id);
      sql += ` AND m.uploader_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const searchIdx = params.length;
      sql += ` AND (
        m.title ILIKE $${searchIdx} OR 
        m.description ILIKE $${searchIdx} OR 
        c.course_code ILIKE $${searchIdx} OR 
        c.course_title ILIKE $${searchIdx} OR 
        u.first_name ILIKE $${searchIdx} OR 
        u.last_name ILIKE $${searchIdx}
      )`;
    }

    // Count Total Results
    const countSql = `SELECT COUNT(*) as count FROM (${sql}) AS count_query`;
    const countRes = await query(countSql, params);
    const totalMaterials = parseInt(countRes.rows[0].count || 0);

    // Apply Pagination & Sorting
    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const materialsRes = await query(sql, params);

    return res.status(200).json({
      success: true,
      total: totalMaterials,
      page: parseInt(page),
      totalPages: Math.ceil(totalMaterials / parseInt(limit)),
      data: materialsRes.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Material Details by ID
 */
const getMaterialById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    const sql = `
      SELECT m.*, 
             c.course_code, c.course_title, c.credit_units,
             d.name as department_name, d.code as department_code,
             l.level_name, l.level_code,
             s.name as semester_name,
             sess.session_name,
             u.first_name as uploader_first_name, u.last_name as uploader_last_name, u.email as uploader_email,
             ${userId ? `EXISTS(SELECT 1 FROM material_bookmarks mb WHERE mb.material_id = m.id AND mb.user_id = $1) as is_bookmarked` : 'FALSE as is_bookmarked'}
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      JOIN departments d ON m.department_id = d.id
      JOIN academic_levels l ON m.level_id = l.id
      JOIN semesters s ON m.semester_id = s.id
      JOIN academic_sessions sess ON m.session_id = sess.id
      JOIN users u ON m.uploader_id = u.id
      WHERE m.id = $${userId ? 2 : 1}
    `;

    const params = userId ? [userId, id] : [id];
    const materialRes = await query(sql, params);

    if (materialRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lecture material not found.' });
    }

    return res.status(200).json({
      success: true,
      data: materialRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Audit & Serve Material Download URL
 */
const downloadMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const matRes = await query('SELECT file_url, title FROM materials WHERE id = $1', [id]);
    if (matRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    // Log download & increment counter
    await query(
      `INSERT INTO material_downloads (material_id, user_id) VALUES ($1, $2)`,
      [id, userId]
    );
    await query(
      `UPDATE materials SET download_count = download_count + 1 WHERE id = $1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Download logged successfully.',
      file_url: matRes.rows[0].file_url
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Material Bookmark
 */
const toggleBookmark = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if already bookmarked
    const existing = await query('SELECT id FROM material_bookmarks WHERE material_id = $1 AND user_id = $2', [id, userId]);

    if (existing.rows.length > 0) {
      // Remove bookmark
      await query('DELETE FROM material_bookmarks WHERE material_id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({
        success: true,
        is_bookmarked: false,
        message: 'Material removed from bookmarks.'
      });
    } else {
      // Add bookmark
      await query('INSERT INTO material_bookmarks (material_id, user_id) VALUES ($1, $2)', [id, userId]);
      return res.status(200).json({
        success: true,
        is_bookmarked: true,
        message: 'Material saved to bookmarks!'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student Bookmarked Materials
 */
const getUserBookmarks = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT m.*, 
             c.course_code, c.course_title, 
             d.name as department_name, d.code as department_code,
             l.level_name, s.name as semester_name,
             u.first_name as uploader_first_name, u.last_name as uploader_last_name,
             1 as is_bookmarked
      FROM material_bookmarks mb
      JOIN materials m ON mb.material_id = m.id
      JOIN courses c ON m.course_id = c.id
      JOIN departments d ON m.department_id = d.id
      JOIN academic_levels l ON m.level_id = l.id
      JOIN semesters s ON m.semester_id = s.id
      JOIN users u ON m.uploader_id = u.id
      WHERE mb.user_id = $1
      ORDER BY mb.created_at DESC
    `;

    const bookmarksRes = await query(sql, [userId]);

    return res.status(200).json({
      success: true,
      count: bookmarksRes.rows.length,
      data: bookmarksRes.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Material (Lecturer owner or Admin)
 */
const deleteMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;

    const matRes = await query('SELECT uploader_id, file_path FROM materials WHERE id = $1', [id]);
    if (matRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const material = matRes.rows[0];

    // Check authorization: Owner or Admin
    if (material.uploader_id !== req.user.id && req.user.role !== 'super_admin' && req.user.role !== 'faculty_admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. You cannot delete this material.' });
    }

    // Delete file from storage
    if (material.file_path) {
      await deleteFileFromStorage(material.file_path);
    }

    // Delete record from DB
    await query('DELETE FROM materials WHERE id = $1', [id]);

    return res.status(200).json({
      success: true,
      message: 'Lecture material deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve / Reject Material (Admins)
 */
const approveRejectMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value. Must be approved or rejected.' });
    }

    const updateRes = await query(
      `UPDATE materials 
       SET approval_status = $1, 
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *`,
      [status, rejection_reason || null, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Material status updated to '${status}'.`,
      data: updateRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadMaterial,
  getMaterials,
  getMaterialById,
  downloadMaterial,
  toggleBookmark,
  getUserBookmarks,
  deleteMaterial,
  approveRejectMaterial
};
