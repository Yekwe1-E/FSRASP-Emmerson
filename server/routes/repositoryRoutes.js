const express = require('express');
const router = express.Router();
const {
  uploadMaterial,
  getMaterials,
  getMaterialById,
  downloadMaterial,
  toggleBookmark,
  getUserBookmarks,
  deleteMaterial,
  approveRejectMaterial
} = require('../controllers/repositoryController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public Material Routes (Supports optional authentication for bookmark status check)
router.get('/', (req, res, next) => {
  if (req.headers.authorization || (req.cookies && req.cookies.token)) {
    return authenticateToken(req, res, () => getMaterials(req, res, next));
  }
  getMaterials(req, res, next);
});

router.get('/bookmarks', authenticateToken, getUserBookmarks);

router.get('/:id', (req, res, next) => {
  if (req.headers.authorization || (req.cookies && req.cookies.token)) {
    return authenticateToken(req, res, () => getMaterialById(req, res, next));
  }
  getMaterialById(req, res, next);
});

// Upload Material (Lecturer, Faculty Admin, Super Admin)
router.post(
  '/upload',
  authenticateToken,
  authorizeRoles('lecturer', 'faculty_admin', 'super_admin'),
  upload.single('material_file'),
  uploadMaterial
);

// Material Actions
router.post('/:id/download', authenticateToken, downloadMaterial);
router.post('/:id/bookmark', authenticateToken, toggleBookmark);
router.delete('/:id', authenticateToken, deleteMaterial);
router.put('/:id/approval', authenticateToken, authorizeRoles('faculty_admin', 'super_admin'), approveRejectMaterial);

module.exports = router;
