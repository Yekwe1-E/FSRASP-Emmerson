const { query } = require('../config/db');

/**
 * Get User In-App Notifications
 */
const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const notifRes = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );

    const unreadCountRes = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      unread_count: parseInt(unreadCountRes.rows[0].count),
      data: notifRes.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark Single Notification as Read
 */
const markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark All Notifications as Read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead
};
