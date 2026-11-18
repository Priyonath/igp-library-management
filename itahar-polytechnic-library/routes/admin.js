const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// All endpoints in this router require Admin role (or librarian for stats)
router.use(requireAuth);

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', requireRole('admin', 'librarian'), async (req, res) => {
  try {
    const [bookStats] = await db.query(
      `SELECT COUNT(*) AS total_books, 
              COALESCE(SUM(total_copies), 0) AS total_copies,
              COALESCE(SUM(available_copies), 0) AS available_copies
       FROM books`
    );

    const [loanStats] = await db.query(
      `SELECT 
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_loans,
         COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS overdue_loans,
         COUNT(CASE WHEN status = 'returned' THEN 1 END) AS returned_loans
       FROM loans`
    );

    const [userStats] = await db.query(
      `SELECT 
         COUNT(CASE WHEN r.name = 'student' THEN 1 END) AS total_students,
         COUNT(CASE WHEN r.name = 'student' AND u.status = 'active' THEN 1 END) AS active_students,
         COUNT(CASE WHEN u.status = 'pending' THEN 1 END) AS pending_approvals,
         COUNT(CASE WHEN r.name = 'librarian' THEN 1 END) AS total_librarians
       FROM users u
       JOIN roles r ON u.role_id = r.id`
    );

    const [fineStats] = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount END), 0) AS total_unpaid_fines,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) AS total_paid_fines
       FROM fines`
    );

    const [requestStats] = await db.query(
      `SELECT COUNT(*) AS pending_requests FROM book_requests WHERE status = 'pending'`
    );

    const [resvStats] = await db.query(
      `SELECT COUNT(*) AS active_reservations FROM reservations WHERE status IN ('pending', 'ready_for_pickup')`
    );

    return res.json({
      success: true,
      stats: {
        totalBooks: bookStats[0].total_books,
        totalCopies: bookStats[0].total_copies,
        availableCopies: bookStats[0].available_copies,
        issuedCopies: bookStats[0].total_copies - bookStats[0].available_copies,
        activeLoans: loanStats[0].active_loans,
        overdueLoans: loanStats[0].overdue_loans,
        returnedLoans: loanStats[0].returned_loans,
        totalStudents: userStats[0].total_students,
        activeStudents: userStats[0].active_students,
        pendingApprovals: userStats[0].pending_approvals,
        totalLibrarians: userStats[0].total_librarians,
        unpaidFines: parseFloat(fineStats[0].total_unpaid_fines) || 0,
        paidFines: parseFloat(fineStats[0].total_paid_fines) || 0,
        pendingRequests: requestStats[0].pending_requests,
        activeReservations: resvStats[0].active_reservations,
        databaseAdapter: db.getAdapter().toUpperCase()
      }
    });
  } catch (err) {
    console.error('[Admin Stats Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve live database statistics.' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', requireRole('admin', 'librarian'), async (req, res) => {
  try {
    // 1. Borrowing Share by Department
    const [deptRows] = await db.query(
      `SELECT u.department, COUNT(l.id) AS borrow_count
       FROM loans l
       JOIN users u ON l.user_id = u.id
       WHERE u.department IS NOT NULL
       GROUP BY u.department
       ORDER BY borrow_count DESC`
    );

    const totalLoans = deptRows.reduce((sum, r) => sum + r.borrow_count, 0) || 1;
    const departmentShare = deptRows.map(r => ({
      department: r.department,
      count: r.borrow_count,
      percentage: Math.round((r.borrow_count / totalLoans) * 100)
    }));

    // 2. Top 5 Most Borrowed Books
    const [topBooks] = await db.query(
      `SELECT b.id, b.title, b.isbn, a.name AS author, c.name AS category, COUNT(l.id) AS total_borrows
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       JOIN categories c ON b.category_id = c.id
       GROUP BY b.id, b.title, b.isbn, a.name, c.name
       ORDER BY total_borrows DESC
       LIMIT 5`
    );

    return res.json({
      success: true,
      analytics: {
        departmentShare,
        topBooks
      }
    });
  } catch (err) {
    console.error('[Analytics Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate analytics.' });
  }
});

// GET /api/admin/activity-logs
router.get('/activity-logs', requireRole('admin'), async (req, res) => {
  try {
    const { action, limit, offset } = req.query;

    let sql = `
      SELECT a.*, u.name AS user_name, u.email AS user_email, r.name AS user_role
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (action && action !== 'all') {
      sql += ' AND a.action = ?';
      params.push(action);
    }

    sql += ' ORDER BY a.id DESC';

    const maxLimit = parseInt(limit || '50', 10);
    const startOffset = parseInt(offset || '0', 10);
    sql += ` LIMIT ${maxLimit} OFFSET ${startOffset}`;

    const [logs] = await db.query(sql, params);

    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/settings
router.get('/settings', requireRole('admin', 'librarian'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM system_settings ORDER BY id ASC');
    return res.json({ success: true, settings: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/settings (Update system settings)
router.put('/settings', requireRole('admin'), async (req, res) => {
  try {
    const { settings } = req.body; // e.g. { max_loan_days: '14', daily_fine_rate: '2.50' }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
    }

    for (const [key, val] of Object.entries(settings)) {
      await db.query(
        'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
        [String(val), req.user.id, key]
      );
    }

    await logActivity(req.user.id, 'SETTINGS_UPDATE', 'SETTINGS', 1, 'Updated system circulation settings', req);

    return res.json({ success: true, message: 'System settings updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/staff (List librarians & admins)
router.get('/staff', requireRole('admin'), async (req, res) => {
  try {
    const [staff] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.department, u.status, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('admin', 'librarian')
       ORDER BY u.id ASC`
    );
    return res.json({ success: true, staff });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/staff (Create librarian or admin)
router.post('/staff', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone, department } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const [roleRows] = await db.query('SELECT id FROM roles WHERE name = ?', [role.trim().toLowerCase()]);
    if (roleRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      `INSERT INTO users (role_id, name, email, password_hash, phone, department, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [roleRows[0].id, name.trim(), email.trim().toLowerCase(), passwordHash, phone || null, department || 'Central Library']
    );

    await logActivity(req.user.id, 'CREATE_STAFF', 'USER', result.insertId, `Created ${role} account for ${name}`, req);

    return res.status(201).json({ success: true, message: `${role} account created successfully!`, id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
