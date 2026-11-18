const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// ---------------- CATEGORIES ----------------
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, (SELECT COUNT(*) FROM books b WHERE b.category_id = c.id) AS book_count 
       FROM categories c ORDER BY c.name ASC`
    );
    return res.json({ success: true, categories: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/categories', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

    const generatedCode = code ? code.trim().toUpperCase() : name.trim().slice(0, 4).toUpperCase();
    const [result] = await db.query(
      'INSERT INTO categories (name, code, description) VALUES (?, ?, ?)',
      [name.trim(), generatedCode, description ? description.trim() : '']
    );

    return res.status(201).json({ success: true, message: 'Category created', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/categories/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    await db.query(
      'UPDATE categories SET name = COALESCE(?, name), code = COALESCE(?, code), description = COALESCE(?, description) WHERE id = ?',
      [name, code, description, req.params.id]
    );
    return res.json({ success: true, message: 'Category updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/categories/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const [books] = await db.query('SELECT count(*) as count FROM books WHERE category_id = ?', [req.params.id]);
    if (books[0].count > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete category: Books are associated with it.' });
    }
    await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- AUTHORS ----------------
router.get('/authors', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, (SELECT COUNT(*) FROM books b WHERE b.author_id = a.id) AS book_count 
       FROM authors a ORDER BY a.name ASC`
    );
    return res.json({ success: true, authors: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/authors', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { name, biography } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Author name is required.' });

    const [result] = await db.query(
      'INSERT INTO authors (name, biography) VALUES (?, ?)',
      [name.trim(), biography ? biography.trim() : '']
    );

    return res.status(201).json({ success: true, message: 'Author added', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- PUBLISHERS ----------------
router.get('/publishers', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM publishers ORDER BY name ASC');
    return res.json({ success: true, publishers: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/publishers', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const { name, address, contact_email } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Publisher name is required.' });

    const [result] = await db.query(
      'INSERT INTO publishers (name, address, contact_email) VALUES (?, ?, ?)',
      [name.trim(), address ? address.trim() : '', contact_email ? contact_email.trim() : '']
    );

    return res.status(201).json({ success: true, message: 'Publisher added', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
