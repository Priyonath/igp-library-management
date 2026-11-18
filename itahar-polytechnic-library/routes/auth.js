const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../config/jwt');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLogger');

// POST /api/auth/register (Student Registration)
router.post('/register', async (req, res) => {
  try {
    const { student_id, name, email, password, phone, department, semester } = req.body;

    if (!student_id || !name || !email || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Student Roll Number, Full Name, Email, Password, and Department are required.'
      });
    }

    // Check duplicate student_id or email
    const [existing] = await db.query(
      'SELECT id, student_id, email FROM users WHERE student_id = ? OR email = ?',
      [student_id.trim(), email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
      const match = existing[0];
      const field = match.email.toLowerCase() === email.trim().toLowerCase() ? 'Email' : 'Student Roll Number';
      return res.status(409).json({
        success: false,
        message: `${field} is already registered. Please check or log in.`
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get student role id
    const [roles] = await db.query('SELECT id FROM roles WHERE name = ?', ['student']);
    const roleId = roles.length > 0 ? roles[0].id : 3;

    // By requirement: student registration requires admin approval (status = 'pending')
    const [result] = await db.query(
      `INSERT INTO users (role_id, student_id, name, email, password_hash, phone, department, semester, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        roleId,
        student_id.trim().toUpperCase(),
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        phone ? phone.trim() : null,
        department.trim(),
        semester ? semester.trim() : 'Semester 1'
      ]
    );

    const userId = result.insertId;

    // Welcome Notification for Student
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, action_url)
       VALUES (?, ?, ?, 'approval', 0, '#')`,
      [
        userId,
        'Registration Under Review',
        'Your registration with ITAHAR GOVERNMENT POLYTECHNIC Library Portal has been submitted. The college administration or librarian will verify your student ID and approve your account shortly.'
      ]
    );

    await logActivity(userId, 'STUDENT_REGISTER', 'USER', userId, `New student registered: ${name} (${student_id})`, req);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is currently pending verification by the librarian or admin.',
      status: 'pending'
    });
  } catch (err) {
    console.error('[Registration Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete student registration. ' + err.message
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide roll number / email and password.'
      });
    }

    const trimmedLogin = login.trim();

    // Query user by email or student_id
    const [rows] = await db.query(
      `SELECT u.id, u.role_id, r.name AS role, u.student_id, u.name, u.email, 
              u.password_hash, u.phone, u.department, u.semester, u.status 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ? OR u.student_id = ?`,
      [trimmedLogin.toLowerCase(), trimmedLogin.toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    // Check account status
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        status: 'pending',
        message: 'Your registration is still pending approval by the college librarian or administrator. Please check back later.'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        status: 'suspended',
        message: 'Your library account has been suspended. Please contact the Central Library Desk.'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        status: 'rejected',
        message: 'Your registration was rejected by the library administrator.'
      });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      name: user.name,
      student_id: user.student_id,
      email: user.email
    });

    await logActivity(user.id, 'USER_LOGIN', 'USER', user.id, `User logged in: ${user.name} (${user.role})`, req);

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user.id,
        role: user.role,
        student_id: user.student_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        department: user.department,
        semester: user.semester,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
});

// GET /api/auth/me (Get profile and quick stats)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active loans count
    const [loans] = await db.query(
      `SELECT count(*) as count FROM loans WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    // Get overdue loans count
    const [overdue] = await db.query(
      `SELECT count(*) as count FROM loans WHERE user_id = ? AND status = 'overdue'`,
      [userId]
    );

    // Get unpaid fines sum
    const [fines] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fines WHERE user_id = ? AND status = 'unpaid'`,
      [userId]
    );

    // Get unread notifications count
    const [notifs] = await db.query(
      `SELECT count(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.json({
      success: true,
      user: req.user,
      stats: {
        activeLoans: loans[0].count,
        overdueLoans: overdue[0].count,
        unpaidFines: parseFloat(fines[0].total) || 0,
        unreadNotifications: notifs[0].count
      }
    });
  } catch (err) {
    console.error('[Profile Fetch Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile details.'
    });
  }
});

// PUT /api/auth/profile (Update contact info or change password)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, semester, currentPassword, newPassword } = req.body;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to set a new password.'
        });
      }

      const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
      const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password does not match.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
    }

    if (phone !== undefined || semester !== undefined) {
      await db.query(
        'UPDATE users SET phone = COALESCE(?, phone), semester = COALESCE(?, semester) WHERE id = ?',
        [phone || null, semester || null, userId]
      );
    }

    await logActivity(userId, 'PROFILE_UPDATE', 'USER', userId, 'User updated profile details', req);

    return res.json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (err) {
    console.error('[Profile Update Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
});

module.exports = router;
