const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// Helper to get formatted date string (YYYY-MM-DD)
function formatDate(d = new Date()) {
  return d.toISOString().split('T')[0];
}

// POST /api/loans/issue (Issue book - Librarian/Admin)
router.post('/issue', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { book_id, barcode, student_id, student_roll, due_date, notes } = req.body;

    const rollQuery = student_roll || student_id;
    if (!rollQuery) {
      return res.status(400).json({ success: false, message: 'Student Roll Number is required.' });
    }

    // 1. Verify student
    const [students] = await db.query(
      `SELECT u.id, u.name, u.student_id, u.status, u.email 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE (u.student_id = ? OR u.email = ? OR u.id = ?)`,
      [rollQuery.trim().toUpperCase(), rollQuery.trim().toLowerCase(), parseInt(rollQuery, 10) || 0]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: `Student with roll number / ID "${rollQuery}" was not found.` });
    }

    const student = students[0];

    if (student.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Student account is ${student.status}. Only approved active students can borrow books.`
      });
    }

    // Check student loan limit
    const [settings] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'max_books_per_student'");
    const maxBooks = settings.length > 0 ? parseInt(settings[0].setting_value, 10) : 3;

    const [activeLoans] = await db.query(
      "SELECT count(*) as count FROM loans WHERE user_id = ? AND status IN ('active', 'overdue')",
      [student.id]
    );

    if (activeLoans[0].count >= maxBooks) {
      return res.status(400).json({
        success: false,
        message: `Student ${student.name} already has ${activeLoans[0].count} active books (maximum quota is ${maxBooks}).`
      });
    }

    // Check unpaid fines
    const [unpaidFines] = await db.query(
      "SELECT count(*) as count, COALESCE(SUM(amount), 0) as total FROM fines WHERE user_id = ? AND status = 'unpaid'",
      [student.id]
    );

    if (parseFloat(unpaidFines[0].total) > 50) {
      return res.status(400).json({
        success: false,
        message: `Student ${student.name} has unpaid fines of ₹${unpaidFines[0].total}. Outstanding fines above ₹50 must be cleared before new loans.`
      });
    }

    // 2. Identify Book and Available Copy
    let targetCopy = null;
    let targetBookId = parseInt(book_id, 10);

    if (barcode && barcode.trim() !== '') {
      const [copyRows] = await db.query('SELECT * FROM book_copies WHERE barcode = ?', [barcode.trim()]);
      if (copyRows.length === 0) {
        return res.status(404).json({ success: false, message: `Physical copy with barcode ${barcode} not found.` });
      }
      targetCopy = copyRows[0];
      targetBookId = targetCopy.book_id;
    } else {
      if (!targetBookId) {
        return res.status(400).json({ success: false, message: 'Either book ID or specific copy barcode must be provided.' });
      }

      // Find an available copy
      const [availableCopies] = await db.query(
        "SELECT * FROM book_copies WHERE book_id = ? AND status = 'available' ORDER BY copy_number ASC LIMIT 1",
        [targetBookId]
      );

      if (availableCopies.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No physical copies of this book are currently available on the shelf.'
        });
      }

      targetCopy = availableCopies[0];
    }

    if (targetCopy.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Selected copy (${targetCopy.barcode}) is currently ${targetCopy.status}.`
      });
    }

    // Fetch book title
    const [bookRows] = await db.query('SELECT title, available_copies FROM books WHERE id = ?', [targetBookId]);
    if (bookRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Book record not found.' });
    }
    const bookTitle = bookRows[0].title;

    // 3. Compute Dates
    const issueDateStr = formatDate(new Date());
    let dueDateStr = due_date;
    if (!dueDateStr) {
      const due = new Date();
      due.setDate(due.getDate() + 14); // 14 days default
      dueDateStr = formatDate(due);
    }

    // 4. Update Copy and Book availability
    await db.query("UPDATE book_copies SET status = 'issued' WHERE id = ?", [targetCopy.id]);
    await db.query("UPDATE books SET available_copies = CASE WHEN available_copies > 0 THEN available_copies - 1 ELSE 0 END WHERE id = ?", [targetBookId]);

    // 5. Create Loan Record
    const [loanResult] = await db.query(
      `INSERT INTO loans (book_id, copy_id, user_id, issued_by, issue_date, due_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      [targetBookId, targetCopy.id, student.id, req.user.id, issueDateStr, dueDateStr, notes || 'Issued by desk']
    );

    const loanId = loanResult.insertId;

    // 6. Notify Student
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, 'info', 0, '#tab-student')`,
      [
        student.id,
        'Book Issued Successfully',
        `"${bookTitle}" (Barcode: ${targetCopy.barcode}) has been checked out to you. Expected return date: ${dueDateStr}.`
      ]
    );

    await logActivity(
      req.user.id,
      'BOOK_ISSUE',
      'LOAN',
      loanId,
      `Issued "${bookTitle}" to ${student.name} (${student.student_id}) due on ${dueDateStr}`,
      req
    );

    return res.status(201).json({
      success: true,
      message: `Successfully issued "${bookTitle}" to ${student.name} (Roll: ${student.student_id})!`,
      loan: {
        id: loanId,
        book_id: targetBookId,
        title: bookTitle,
        student_name: student.name,
        student_roll: student.student_id,
        barcode: targetCopy.barcode,
        issue_date: issueDateStr,
        due_date: dueDateStr
      }
    });
  } catch (err) {
    console.error('[Book Issue Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to issue book: ' + err.message });
  }
});

// POST /api/loans/return (Return book - Librarian/Admin)
router.post('/return', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { loan_id, barcode, book_id, student_id } = req.body;

    let targetLoan = null;

    if (loan_id) {
      const [rows] = await db.query(
        `SELECT l.*, b.title AS book_title, u.name AS student_name, u.student_id AS student_roll, c.barcode
         FROM loans l
         JOIN books b ON l.book_id = b.id
         JOIN users u ON l.user_id = u.id
         JOIN book_copies c ON l.copy_id = c.id
         WHERE l.id = ?`,
        [parseInt(loan_id, 10)]
      );
      if (rows.length > 0) targetLoan = rows[0];
    } else if (barcode) {
      const [rows] = await db.query(
        `SELECT l.*, b.title AS book_title, u.name AS student_name, u.student_id AS student_roll, c.barcode
         FROM loans l
         JOIN books b ON l.book_id = b.id
         JOIN users u ON l.user_id = u.id
         JOIN book_copies c ON l.copy_id = c.id
         WHERE c.barcode = ? AND l.status IN ('active', 'overdue')
         ORDER BY l.id DESC LIMIT 1`,
        [barcode.trim()]
      );
      if (rows.length > 0) targetLoan = rows[0];
    } else if (book_id) {
      const [rows] = await db.query(
        `SELECT l.*, b.title AS book_title, u.name AS student_name, u.student_id AS student_roll, c.barcode
         FROM loans l
         JOIN books b ON l.book_id = b.id
         JOIN users u ON l.user_id = u.id
         JOIN book_copies c ON l.copy_id = c.id
         WHERE l.book_id = ? AND l.status IN ('active', 'overdue')
         ORDER BY l.id DESC LIMIT 1`,
        [parseInt(book_id, 10)]
      );
      if (rows.length > 0) targetLoan = rows[0];
    }

    if (!targetLoan) {
      return res.status(404).json({ success: false, message: 'Active or overdue loan record not found for the given criteria.' });
    }

    if (targetLoan.status === 'returned') {
      return res.status(400).json({ success: false, message: 'This book loan has already been marked as returned.' });
    }

    const returnDateStr = formatDate(new Date());

    // 1. Mark loan returned
    await db.query(
      `UPDATE loans 
       SET status = 'returned', return_date = ?, returned_to = ?
       WHERE id = ?`,
      [returnDateStr, req.user.id, targetLoan.id]
    );

    // 2. Mark copy available
    await db.query("UPDATE book_copies SET status = 'available' WHERE id = ?", [targetLoan.copy_id]);

    // 3. Increment available copies
    await db.query("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [targetLoan.book_id]);

    // 4. Check for overdue fine
    const returnDateObj = new Date(returnDateStr);
    const dueDateObj = new Date(targetLoan.due_date);
    let fineGenerated = null;

    if (returnDateObj > dueDateObj) {
      const diffMs = returnDateObj.getTime() - dueDateObj.getTime();
      const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (overdueDays > 0) {
        // Fetch daily fine rate
        const [rateRows] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'daily_fine_rate'");
        const dailyRate = rateRows.length > 0 ? parseFloat(rateRows[0].setting_value) : 2.00;
        const totalFine = (overdueDays * dailyRate).toFixed(2);

        // Check if fine record already exists
        const [existingFine] = await db.query('SELECT id FROM fines WHERE loan_id = ?', [targetLoan.id]);
        if (existingFine.length > 0) {
          await db.query(
            'UPDATE fines SET amount = ?, overdue_days = ?, status = ? WHERE id = ?',
            [totalFine, overdueDays, 'unpaid', existingFine[0].id]
          );
        } else {
          await db.query(
            `INSERT INTO fines (loan_id, user_id, amount, overdue_days, status, reason)
             VALUES (?, ?, ?, ?, 'unpaid', ?)`,
            [
              targetLoan.id,
              targetLoan.user_id,
              totalFine,
              overdueDays,
              `Overdue return of "${targetLoan.book_title}" (${overdueDays} days late at ₹${dailyRate}/day)`
            ]
          );
        }

        fineGenerated = { overdueDays, amount: totalFine };

        // Notify student about fine
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
           VALUES (?, ?, ?, 'warning', 0, '#tab-student')`,
          [
            targetLoan.user_id,
            'Overdue Fine Incurred',
            `"${targetLoan.book_title}" was returned ${overdueDays} days late. An overdue fine of ₹${totalFine} has been recorded to your account.`
          ]
        );
      }
    }

    // 5. Check if any student has a pending reservation for this book
    const [pendingRes] = await db.query(
      `SELECT r.id, r.user_id, u.name, u.email 
       FROM reservations r 
       JOIN users u ON r.user_id = u.id
       WHERE r.book_id = ? AND r.status = 'pending' 
       ORDER BY r.reservation_date ASC LIMIT 1`,
      [targetLoan.book_id]
    );

    if (pendingRes.length > 0) {
      const resv = pendingRes[0];
      await db.query("UPDATE reservations SET status = 'ready_for_pickup' WHERE id = ?", [resv.id]);
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
         VALUES (?, ?, ?, 'success', 0, '#tab-student')`,
        [
          resv.user_id,
          'Book Available for Pickup!',
          `Great news! Your reserved book "${targetLoan.book_title}" has just been returned and is waiting for you at the Central Library Circulation Counter.`
        ]
      );
    }

    await logActivity(
      req.user.id,
      'BOOK_RETURN',
      'LOAN',
      targetLoan.id,
      `Returned "${targetLoan.book_title}" from ${targetLoan.student_name} (${targetLoan.student_roll})${fineGenerated ? ` [Fine: ₹${fineGenerated.amount}]` : ''}`,
      req
    );

    return res.json({
      success: true,
      message: `"${targetLoan.book_title}" successfully returned to circulation shelf!`,
      fine: fineGenerated
    });
  } catch (err) {
    console.error('[Book Return Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to return book: ' + err.message });
  }
});

// POST /api/loans/renew/:id (Renew loan)
router.post('/renew/:id', requireAuth, async (req, res) => {
  try {
    const loanId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const isStaff = ['admin', 'librarian'].includes(req.user.role);

    const [loans] = await db.query(
      `SELECT l.*, b.title AS book_title 
       FROM loans l 
       JOIN books b ON l.book_id = b.id 
       WHERE l.id = ?`,
      [loanId]
    );

    if (loans.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan record not found.' });
    }

    const loan = loans[0];

    // If student, can only renew their own loan
    if (!isStaff && loan.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to renew this loan.' });
    }

    if (loan.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Cannot renew a book that has already been returned.' });
    }

    // Check if loan is overdue
    const today = new Date();
    const dueDate = new Date(loan.due_date);
    if (today > dueDate) {
      return res.status(400).json({
        success: false,
        message: 'This loan is overdue and cannot be renewed online. Please return the book at the circulation desk to settle any fines.'
      });
    }

    // Check renewal limits
    if (!isStaff && loan.renewal_count >= 1) {
      return res.status(400).json({
        success: false,
        message: 'Maximum online renewals (1 renewal) reached for this loan.'
      });
    }

    // Extend due date by 14 days
    dueDate.setDate(dueDate.getDate() + 14);
    const newDueDateStr = formatDate(dueDate);

    await db.query(
      'UPDATE loans SET due_date = ?, renewal_count = renewal_count + 1 WHERE id = ?',
      [newDueDateStr, loanId]
    );

    await logActivity(req.user.id, 'LOAN_RENEW', 'LOAN', loanId, `Renewed loan for "${loan.book_title}" to ${newDueDateStr}`, req);

    return res.json({
      success: true,
      message: `"${loan.book_title}" renewed successfully! New due date: ${newDueDateStr}`,
      new_due_date: newDueDateStr
    });
  } catch (err) {
    console.error('[Loan Renew Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to renew loan: ' + err.message });
  }
});

// GET /api/loans/my-loans (Current student's loans)
router.get('/my-loans', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT l.id, l.book_id, b.title, b.isbn, c.barcode, c.shelf_location,
              l.issue_date, l.due_date, l.return_date, l.status, l.renewal_count,
              f.amount AS fine_amount, f.status AS fine_status
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN book_copies c ON l.copy_id = c.id
       LEFT JOIN fines f ON l.id = f.loan_id
       WHERE l.user_id = ?
       ORDER BY l.id DESC`,
      [userId]
    );

    // Compute dynamic overdue days and flag for active loans
    const today = new Date();
    const processed = rows.map(loan => {
      let isOverdue = loan.status === 'overdue';
      let daysRemaining = 0;
      if (loan.status === 'active' || loan.status === 'overdue') {
        const due = new Date(loan.due_date);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays;
        if (diffDays < 0) {
          isOverdue = true;
        }
      }

      return {
        ...loan,
        is_overdue: isOverdue,
        days_remaining: daysRemaining
      };
    });

    return res.json({ success: true, loans: processed });
  } catch (err) {
    console.error('[My Loans Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve loans.' });
  }
});

// GET /api/loans/all (Librarian/Admin list all loans)
router.get('/all', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { status, search } = req.query;

    let sql = `
      SELECT l.id, l.book_id, b.title AS book_title, b.isbn,
             c.barcode, c.shelf_location,
             u.id AS user_id, u.name AS student_name, u.student_id AS student_roll, u.department,
             l.issue_date, l.due_date, l.return_date, l.status, l.renewal_count,
             f.amount AS fine_amount, f.status AS fine_status
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN book_copies c ON l.copy_id = c.id
      JOIN users u ON l.user_id = u.id
      LEFT JOIN fines f ON l.id = f.loan_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND l.status = ?';
      params.push(status);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(b.title) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.student_id) LIKE ? OR LOWER(c.barcode) LIKE ?)';
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY l.id DESC LIMIT 150';

    const [loans] = await db.query(sql, params);
    return res.json({ success: true, loans });
  } catch (err) {
    console.error('[All Loans Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve all loans.' });
  }
});

// GET /api/loans/overdue (Track overdue books)
router.get('/overdue', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const todayStr = formatDate(new Date());

    const [rows] = await db.query(
      `SELECT l.id, l.book_id, b.title AS book_title, c.barcode,
              u.id AS user_id, u.name AS student_name, u.student_id AS student_roll, u.department, u.phone, u.email,
              l.issue_date, l.due_date,
              f.amount AS fine_amount, f.status AS fine_status
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN book_copies c ON l.copy_id = c.id
       JOIN users u ON l.user_id = u.id
       LEFT JOIN fines f ON l.id = f.loan_id
       WHERE l.status IN ('active', 'overdue') AND l.due_date < ?
       ORDER BY l.due_date ASC`,
      [todayStr]
    );

    // Calculate dynamic fine
    const [rateRows] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = 'daily_fine_rate'");
    const dailyRate = rateRows.length > 0 ? parseFloat(rateRows[0].setting_value) : 2.00;

    const today = new Date();
    const enriched = rows.map(loan => {
      const due = new Date(loan.due_date);
      const overdueDays = Math.max(1, Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      const calculatedFine = (overdueDays * dailyRate).toFixed(2);
      return {
        ...loan,
        overdue_days: overdueDays,
        daily_rate: dailyRate,
        current_fine: loan.fine_amount ? loan.fine_amount : calculatedFine
      };
    });

    return res.json({ success: true, count: enriched.length, overdue: enriched });
  } catch (err) {
    console.error('[Overdue Loans Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to track overdue books.' });
  }
});

module.exports = router;
