const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// GET /api/notices
router.get('/', async (req, res) => {
  try {
    const [notices] = await db.query(
      `SELECT n.*, u.name AS author_name 
       FROM notices n 
       JOIN users u ON n.created_by = u.id 
       ORDER BY n.is_pinned DESC, n.id DESC`
    );
    return res.json({ success: true, notices });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notices (Create - Librarian/Admin)
router.post('/', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { title, content, category, is_pinned, target_role } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Notice title and content are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO notices (title, content, category, is_pinned, target_role, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        content.trim(),
        category || 'general',
        is_pinned ? 1 : 0,
        target_role || 'all',
        req.user.id
      ]
    );

    await logActivity(req.user.id, 'CREATE_NOTICE', 'NOTICE', result.insertId, `Published notice: "${title}"`, req);

    return res.status(201).json({ success: true, message: 'Notice published successfully!', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notices/:id (Delete - Librarian/Admin)
router.delete('/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM notices WHERE id = ?', [id]);
    await logActivity(req.user.id, 'DELETE_NOTICE', 'NOTICE', id, `Removed notice #${id}`, req);
    return res.json({ success: true, message: 'Notice deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
