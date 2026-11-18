const { verifyToken } = require('../config/jwt');
const db = require('../config/db');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please log in again.'
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.role_id, r.name AS role, u.student_id, u.name, u.email, 
              u.phone, u.department, u.semester, u.status 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const user = rows[0];

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Account pending admin verification. Please wait for the librarian/admin to approve your registration.'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your library account has been suspended. Please contact the Central Library Desk.'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your registration was rejected by the library administration.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error verifying authentication.'
    });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    req.user = null;
    return next();
  }

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.role_id, r.name AS role, u.student_id, u.name, u.email, 
              u.phone, u.department, u.semester, u.status 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND u.status = 'active'`,
      [decoded.id]
    );

    req.user = rows.length > 0 ? rows[0] : null;
  } catch (err) {
    req.user = null;
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
