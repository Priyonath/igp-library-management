const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications (User's notifications)
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY id DESC LIMIT 50`,
      [req.user.id]
    );

    const unreadCount = rows.filter(n => !n.is_read).length;

    return res.json({
      success: true,
      unreadCount,
      notifications: rows
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/:id/read (Mark as read)
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, req.user.id]);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/mark-all-read (Mark all as read)
router.put('/mark-all-read', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
