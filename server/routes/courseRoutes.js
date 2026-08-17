const express = require('express');
const router = express.Router();
const { getCourses, createCourse } = require('../controllers/courseController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', getCourses);
router.post('/', authenticateToken, authorizeRoles('lecturer', 'faculty_admin', 'super_admin'), createCourse);

module.exports = router;
