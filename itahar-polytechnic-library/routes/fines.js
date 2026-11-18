const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// GET /api/fines/my (Student's fines)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const [fines] = await db.query(
      `SELECT f.*, b.title AS book_title, b.isbn, l.due_date, l.return_date,
              p.payment_method, p.transaction_ref, p.paid_at
       FROM fines f
       JOIN loans l ON f.loan_id = l.id
       JOIN books b ON l.book_id = b.id
       LEFT JOIN payments p ON f.id = p.fine_id
       WHERE f.user_id = ?
       ORDER BY f.id DESC`,
      [req.user.id]
    );

    const totalUnpaid = fines
      .filter(f => f.status === 'unpaid')
      .reduce((sum, f) => sum + parseFloat(f.amount), 0);

    return res.json({
      success: true,
      fines,
      totalUnpaid: totalUnpaid.toFixed(2)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fines/all (Librarian/Admin)
router.get('/all', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `
      SELECT f.*, u.name AS student_name, u.student_id AS student_roll, u.department,
             b.title AS book_title,
             p.payment_method, p.transaction_ref, p.paid_at,
             rec.name AS received_by_name
      FROM fines f
      JOIN users u ON f.user_id = u.id
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      LEFT JOIN payments p ON f.id = p.fine_id
      LEFT JOIN users rec ON p.received_by = rec.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND f.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY f.id DESC LIMIT 150';

    const [fines] = await db.query(sql, params);

    return res.json({ success: true, fines });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fines/pay/:id (Pay Fine)
router.post('/pay/:id', requireAuth, async (req, res) => {
  try {
    const fineId = parseInt(req.params.id, 10);
    const { payment_method, transaction_ref } = req.body;
    const isStaff = ['admin', 'librarian'].includes(req.user.role);

    const [fines] = await db.query('SELECT * FROM fines WHERE id = ?', [fineId]);
    if (fines.length === 0) {
      return res.status(404).json({ success: false, message: 'Fine record not found.' });
    }

    const fine = fines[0];

    // If student, can only pay own fine
    if (!isStaff && fine.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (fine.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This fine has already been marked as paid.' });
    }

    if (fine.status === 'waived') {
      return res.status(400).json({ success: false, message: 'This fine was previously waived.' });
    }

    const method = payment_method || (isStaff ? 'cash' : 'online');
    const txRef = transaction_ref || `TXN-ITP-${Date.now().toString().slice(-6)}`;

    // Mark paid
    await db.query("UPDATE fines SET status = 'paid' WHERE id = ?", [fineId]);

    // Record payment
    await db.query(
      `INSERT INTO payments (fine_id, user_id, amount, payment_method, transaction_ref, received_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fineId, fine.user_id, fine.amount, method, txRef, isStaff ? req.user.id : null]
    );

    // Notify student
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, 'success', 0, '#tab-student')`,
      [
        fine.user_id,
        'Fine Payment Confirmed',
        `Payment of ₹${fine.amount} for fine #${fineId} has been successfully settled (Receipt Ref: ${txRef}).`
      ]
    );

    await logActivity(req.user.id, 'FINE_PAY', 'FINE', fineId, `Settled fine of ₹${fine.amount} via ${method}`, req);

    return res.json({
      success: true,
      message: `Fine of ₹${fine.amount} marked as paid successfully! Receipt: ${txRef}`,
      transaction_ref: txRef
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fines/waive/:id (Waive Fine - Admin/Librarian)
router.post('/waive/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const fineId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const [fines] = await db.query('SELECT * FROM fines WHERE id = ?', [fineId]);
    if (fines.length === 0) {
      return res.status(404).json({ success: false, message: 'Fine not found.' });
    }

    const fine = fines[0];
    if (fine.status !== 'unpaid') {
      return res.status(400).json({ success: false, message: `Cannot waive fine with status '${fine.status}'.` });
    }

    const waiveReason = reason ? reason.trim() : 'Waived by administrative concession';

    await db.query(
      "UPDATE fines SET status = 'waived', reason = CONCAT(reason, ' [Waived: ', ?, ']') WHERE id = ?",
      [waiveReason, fineId]
    );

    await db.query(
      `INSERT INTO payments (fine_id, user_id, amount, payment_method, transaction_ref, received_by)
       VALUES (?, ?, ?, 'system_waived', ?, ?)`,
      [fineId, fine.user_id, fine.amount, `WAIVE-${Date.now().toString().slice(-6)}`, req.user.id]
    );

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, 'info', 0, '#tab-student')`,
      [
        fine.user_id,
        'Fine Waived by Administration',
        `Your overdue fine of ₹${fine.amount} has been waived by the library administration. Reason: ${waiveReason}`
      ]
    );

    await logActivity(req.user.id, 'FINE_WAIVE', 'FINE', fineId, `Waived fine of ₹${fine.amount}: ${waiveReason}`, req);

    return res.json({ success: true, message: `Fine of ₹${fine.amount} has been waived.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
