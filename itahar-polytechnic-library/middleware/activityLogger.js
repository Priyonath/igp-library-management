const db = require('../config/db');

async function logActivity(userId, action, entityType, entityId, details, req = null) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType, entityId || null, details || '', ip]
    );
  } catch (err) {
    console.error('[Activity Log Error]', err.message);
  }
}

module.exports = {
  logActivity
};
