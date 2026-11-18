const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// GET /api/eresources
router.get('/', async (req, res) => {
  try {
    const { category, type, search } = req.query;

    let sql = `
      SELECT e.*, c.name AS category_name, c.code AS category_code, u.name AS uploaded_by_name
      FROM e_resources e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND (c.name = ? OR c.code = ?)';
      params.push(category, category);
    }

    if (type && type !== 'all') {
      sql += ' AND e.resource_type = ?';
      params.push(type);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(e.title) LIKE ? OR LOWER(e.author) LIKE ? OR LOWER(e.description) LIKE ?)';
      params.push(term, term, term);
    }

    sql += ' ORDER BY e.id DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, count: rows.length, resources: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/eresources (Add - Librarian/Admin)
router.post('/', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { title, resource_type, category_id, category_name, author, external_url, description } = req.body;

    if (!title || !external_url) {
      return res.status(400).json({ success: false, message: 'Resource title and external URL / Link are required.' });
    }

    let catId = parseInt(category_id, 10);
    if (!catId && category_name) {
      const [cats] = await db.query('SELECT id FROM categories WHERE name = ? OR code = ?', [category_name, category_name]);
      if (cats.length > 0) catId = cats[0].id;
    }
    if (!catId) catId = 1; // Default to Computer Science / general

    const [result] = await db.query(
      `INSERT INTO e_resources (title, resource_type, category_id, author, external_url, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        resource_type || 'ebook',
        catId,
        author ? author.trim() : null,
        external_url.trim(),
        description ? description.trim() : null,
        req.user.id
      ]
    );

    await logActivity(req.user.id, 'ADD_ERESOURCE', 'E_RESOURCE', result.insertId, `Added digital resource: ${title}`, req);

    return res.status(201).json({ success: true, message: 'Digital resource added successfully!', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/eresources/:id (Delete - Librarian/Admin)
router.delete('/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM e_resources WHERE id = ?', [id]);
    await logActivity(req.user.id, 'DELETE_ERESOURCE', 'E_RESOURCE', id, `Deleted digital resource #${id}`, req);
    return res.json({ success: true, message: 'Digital resource deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
