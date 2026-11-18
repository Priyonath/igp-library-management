const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// POST /api/requests (Student request new book for library)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, author, publisher, isbn, reason } = req.body;
    const userId = req.user.id;

    if (!title || !author) {
      return res.status(400).json({ success: false, message: 'Book title and author are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO book_requests (user_id, title, author, publisher, isbn, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, title.trim(), author.trim(), publisher ? publisher.trim() : null, isbn ? isbn.trim() : null, reason ? reason.trim() : null]
    );

    const requestId = result.insertId;

    await logActivity(userId, 'BOOK_REQUEST_SUBMIT', 'BOOK_REQUEST', requestId, `Requested book: "${title}" by ${author}`, req);

    return res.status(201).json({
      success: true,
      message: 'Book acquisition request submitted to library committee for review.',
      requestId
    });
  } catch (err) {
    console.error('[Book Request Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to submit book request: ' + err.message });
  }
});

// GET /api/requests/my (Student's requests)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS reviewed_by_name 
       FROM book_requests r 
       LEFT JOIN users u ON r.reviewed_by = u.id 
       WHERE r.user_id = ? 
       ORDER BY r.id DESC`,
      [req.user.id]
    );
    return res.json({ success: true, requests: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/requests/all (Librarian/Admin)
router.get('/all', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS student_name, u.student_id AS student_roll, u.department,
              rev.name AS reviewed_by_name
       FROM book_requests r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users rev ON r.reviewed_by = rev.id
       ORDER BY r.id DESC`
    );
    return res.json({ success: true, requests: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/requests/:id (Approve/Reject - Librarian/Admin)
router.put('/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const reqId = parseInt(req.params.id, 10);
    const { status, admin_remarks } = req.body;

    const validStatuses = ['approved', 'rejected', 'procured', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const [rows] = await db.query('SELECT * FROM book_requests WHERE id = ?', [reqId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const reqItem = rows[0];

    await db.query(
      `UPDATE book_requests 
       SET status = ?, admin_remarks = ?, reviewed_by = ? 
       WHERE id = ?`,
      [status, admin_remarks ? admin_remarks.trim() : null, req.user.id, reqId]
    );

    // Notify the student
    const notifTitle = status === 'approved' ? 'Book Request Approved!' : `Book Request ${status.toUpperCase()}`;
    const notifMsg = `Your acquisition request for "${reqItem.title}" has been ${status}.${admin_remarks ? ` Admin remarks: ${admin_remarks}` : ''}`;

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, ?, 0, '#tab-student')`,
      [reqItem.user_id, notifTitle, notifMsg, status === 'approved' ? 'success' : 'info']
    );

    await logActivity(req.user.id, 'BOOK_REQUEST_REVIEW', 'BOOK_REQUEST', reqId, `Set request #${reqId} to ${status}`, req);

    return res.json({ success: true, message: `Request has been marked as ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
