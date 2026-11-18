const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// POST /api/reservations (Student reserve book)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { book_id } = req.body;
    const userId = req.user.id;

    if (!book_id) {
      return res.status(400).json({ success: false, message: 'Book ID is required.' });
    }

    const [books] = await db.query('SELECT id, title, available_copies FROM books WHERE id = ?', [parseInt(book_id, 10)]);
    if (books.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    const book = books[0];

    // Check if user already has an active reservation for this book
    const [existing] = await db.query(
      "SELECT id FROM reservations WHERE book_id = ? AND user_id = ? AND status IN ('pending', 'ready_for_pickup')",
      [book.id, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active hold or reservation for this book.'
      });
    }

    // Determine initial status: if copies are available, ready for pickup immediately; otherwise pending
    const initialStatus = book.available_copies > 0 ? 'ready_for_pickup' : 'pending';

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = expiry.toISOString().split('T')[0];

    const [result] = await db.query(
      `INSERT INTO reservations (book_id, user_id, expiry_date, status)
       VALUES (?, ?, ?, ?)`,
      [book.id, userId, expiryStr, initialStatus]
    );

    const message = initialStatus === 'ready_for_pickup'
      ? `"${book.title}" is reserved and ready for you to pick up at the Central Library Circulation Counter!`
      : `"${book.title}" is currently checked out. Your reservation has been queued and you will be notified as soon as a copy is returned.`;

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, 'info', 0, '#tab-student')`,
      [userId, 'Book Reservation Confirmed', message]
    );

    await logActivity(userId, 'BOOK_RESERVE', 'RESERVATION', result.insertId, `Reserved "${book.title}"`, req);

    return res.status(201).json({
      success: true,
      message,
      reservationId: result.insertId,
      status: initialStatus
    });
  } catch (err) {
    console.error('[Reservation Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to reserve book: ' + err.message });
  }
});

// GET /api/reservations/my (Student's reservations)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, b.title AS book_title, b.isbn, b.available_copies,
              a.name AS author_name, c.name AS category_name
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       JOIN categories c ON b.category_id = c.id
       WHERE r.user_id = ?
       ORDER BY r.id DESC`,
      [req.user.id]
    );

    return res.json({ success: true, reservations: rows });
  } catch (err) {
    console.error('[My Reservations Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reservations.' });
  }
});

// GET /api/reservations/all (Librarian/Admin)
router.get('/all', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, b.title AS book_title, b.isbn, b.available_copies,
              u.name AS student_name, u.student_id AS student_roll, u.department, u.phone
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN users u ON r.user_id = u.id
       ORDER BY r.id DESC`
    );

    return res.json({ success: true, reservations: rows });
  } catch (err) {
    console.error('[All Reservations Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve all reservations.' });
  }
});

// PUT /api/reservations/:id/status (Update reservation status)
router.put('/:id/status', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const resId = parseInt(req.params.id, 10);

    const validStatuses = ['pending', 'ready_for_pickup', 'fulfilled', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation status.' });
    }

    const [resRows] = await db.query(
      `SELECT r.*, b.title AS book_title 
       FROM reservations r 
       JOIN books b ON r.book_id = b.id 
       WHERE r.id = ?`,
      [resId]
    );

    if (resRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    const r = resRows[0];
    await db.query('UPDATE reservations SET status = ? WHERE id = ?', [status, resId]);

    // Notify user if marked ready
    if (status === 'ready_for_pickup') {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
         VALUES (?, ?, ?, 'success', 0, '#tab-student')`,
        [
          r.user_id,
          'Reservation Ready for Pickup',
          `Your reservation for "${r.book_title}" is ready! Please collect your copy from the Library Circulation Desk within 3 business days.`
        ]
      );
    }

    await logActivity(req.user.id, 'RESERVATION_UPDATE', 'RESERVATION', resId, `Updated reservation #${resId} status to ${status}`, req);

    return res.json({ success: true, message: `Reservation status updated to ${status}.` });
  } catch (err) {
    console.error('[Update Reservation Status Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to update reservation status.' });
  }
});

// DELETE /api/reservations/:id (Cancel reservation)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const resId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const isStaff = ['librarian', 'admin'].includes(req.user.role);

    const [rows] = await db.query('SELECT * FROM reservations WHERE id = ?', [resId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    const r = rows[0];
    if (!isStaff && r.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this reservation.' });
    }

    await db.query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [resId]);

    await logActivity(req.user.id, 'RESERVATION_CANCEL', 'RESERVATION', resId, `Cancelled reservation #${resId}`, req);

    return res.json({ success: true, message: 'Reservation cancelled successfully.' });
  } catch (err) {
    console.error('[Cancel Reservation Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel reservation.' });
  }
});

module.exports = router;
