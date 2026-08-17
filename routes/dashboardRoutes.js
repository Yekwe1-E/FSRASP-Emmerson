const express = require('express');
const router = express.Router();
const {
  getAdminDashboardStats,
  getFacultyDashboardStats,
  getLecturerDashboardStats,
  getStudentDashboardStats,
  toggleUserApproval,
  toggleUserActive
} = require('../controllers/dashboardController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/admin', authenticateToken, authorizeRoles('super_admin'), getAdminDashboardStats);
router.get('/faculty', authenticateToken, authorizeRoles('faculty_admin', 'super_admin'), getFacultyDashboardStats);
router.get('/lecturer', authenticateToken, authorizeRoles('lecturer', 'faculty_admin', 'super_admin'), getLecturerDashboardStats);
router.get('/student', authenticateToken, authorizeRoles('student', 'lecturer', 'faculty_admin', 'super_admin'), getStudentDashboardStats);

// User Management Actions
router.put('/users/:userId/approval', authenticateToken, authorizeRoles('super_admin', 'faculty_admin'), toggleUserApproval);
router.put('/users/:userId/active', authenticateToken, authorizeRoles('super_admin'), toggleUserActive);

module.exports = router;
