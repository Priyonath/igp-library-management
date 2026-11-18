const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// GET /api/students (List students with filters)
router.get('/', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { search, department, status, limit, offset } = req.query;

    let sql = `
      SELECT u.id, u.student_id, u.name, u.email, u.phone, u.department, u.semester, u.status, u.created_at,
             (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status IN ('active', 'overdue')) AS active_loans_count,
             (SELECT COALESCE(SUM(amount), 0) FROM fines f WHERE f.user_id = u.id AND f.status = 'unpaid') AS unpaid_fines
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'student'
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    if (department && department !== 'all') {
      sql += ' AND u.department = ?';
      params.push(department);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(u.name) LIKE ? OR LOWER(u.student_id) LIKE ? OR LOWER(u.email) LIKE ?)';
      params.push(term, term, term);
    }

    sql += ' ORDER BY u.id DESC';

    const maxLimit = parseInt(limit || '100', 10);
    const startOffset = parseInt(offset || '0', 10);
    sql += ` LIMIT ${maxLimit} OFFSET ${startOffset}`;

    const [students] = await db.query(sql, params);

    return res.json({ success: true, count: students.length, students });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/students/:id (Full student file)
router.get('/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);

    const [users] = await db.query(
      `SELECT u.id, u.student_id, u.name, u.email, u.phone, u.department, u.semester, u.status, u.created_at
       FROM users u
       WHERE u.id = ?`,
      [studentId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const student = users[0];

    // Active loans
    const [loans] = await db.query(
      `SELECT l.*, b.title AS book_title, c.barcode, c.shelf_location
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN book_copies c ON l.copy_id = c.id
       WHERE l.user_id = ?
       ORDER BY l.id DESC`,
      [studentId]
    );

    // Reservations
    const [reservations] = await db.query(
      `SELECT r.*, b.title AS book_title 
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       WHERE r.user_id = ?
       ORDER BY r.id DESC`,
      [studentId]
    );

    // Fines
    const [fines] = await db.query(
      `SELECT f.*, b.title AS book_title 
       FROM fines f
       JOIN loans l ON f.loan_id = l.id
       JOIN books b ON l.book_id = b.id
       WHERE f.user_id = ?
       ORDER BY f.id DESC`,
      [studentId]
    );

    return res.json({
      success: true,
      student,
      loans,
      reservations,
      fines
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id/status (Approve, activate, suspend, or reject student)
router.put('/:id/status', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const { status, remarks } = req.body;

    const validStatuses = ['active', 'pending', 'suspended', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid student account status.' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [studentId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const student = users[0];

    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, studentId]);

    let notifTitle = 'Account Status Update';
    let notifMsg = `Your library account status has been changed to ${status.toUpperCase()}.`;

    if (status === 'active') {
      notifTitle = 'Registration Approved! Welcome to Library';
      notifMsg = 'Congratulations! Your student library registration has been verified and approved by the college administration. You may now borrow textbooks, reserve holding copies, and access e-resources.';
    } else if (status === 'suspended') {
      notifTitle = 'Account Suspended Notice';
      notifMsg = `Your library borrowing privileges have been temporarily suspended.${remarks ? ` Reason: ${remarks}` : ' Please report to the Chief Librarian.'}`;
    }

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, ?, 0, '#tab-student')`,
      [studentId, notifTitle, notifMsg, status === 'active' ? 'success' : 'warning']
    );

    await logActivity(req.user.id, 'STUDENT_STATUS_UPDATE', 'USER', studentId, `Updated ${student.name} (${student.student_id}) status to ${status}`, req);

    return res.json({
      success: true,
      message: `Student account for ${student.name} (${student.student_id || 'ID ' + studentId}) is now ${status}.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
