const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead
} = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getUserNotifications);
router.put('/:id/read', authenticateToken, markNotificationAsRead);
router.put('/read-all', authenticateToken, markAllAsRead);

module.exports = router;
