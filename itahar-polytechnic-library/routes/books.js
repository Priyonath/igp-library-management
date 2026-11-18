const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../middleware/activityLogger');

// GET /api/books (Search and list books)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, category, status, limit, offset } = req.query;

    let sql = `
      SELECT b.id, b.title, b.isbn, b.edition, b.publication_year, b.call_number,
             b.total_copies, b.available_copies, b.description, b.cover_url,
             c.name AS category_name, c.code AS category_code,
             a.name AS author_name,
             p.name AS publisher_name
      FROM books b
      JOIN categories c ON b.category_id = c.id
      JOIN authors a ON b.author_id = a.id
      LEFT JOIN publishers p ON b.publisher_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(b.title) LIKE ? OR LOWER(b.isbn) LIKE ? OR LOWER(a.name) LIKE ? OR LOWER(c.name) LIKE ?)`;
      params.push(term, term, term, term);
    }

    if (category && category !== 'all') {
      sql += ` AND (c.name = ? OR c.code = ?)`;
      params.push(category, category);
    }

    if (status === 'available') {
      sql += ` AND b.available_copies > 0`;
    } else if (status === 'issued') {
      sql += ` AND b.available_copies < b.total_copies`;
    }

    sql += ` ORDER BY b.id DESC`;

    const maxLimit = parseInt(limit || '100', 10);
    const startOffset = parseInt(offset || '0', 10);
    sql += ` LIMIT ${maxLimit} OFFSET ${startOffset}`;

    const [books] = await db.query(sql, params);

    // Also get active loans preview if available
    const [activeLoans] = await db.query(
      `SELECT l.book_id, l.due_date, u.name AS student_name, u.student_id
       FROM loans l
       JOIN users u ON l.user_id = u.id
       WHERE l.status IN ('active', 'overdue')`
    );

    const loansMap = {};
    activeLoans.forEach(loan => {
      if (!loansMap[loan.book_id]) loansMap[loan.book_id] = [];
      loansMap[loan.book_id].push(loan);
    });

    const enriched = books.map(book => ({
      ...book,
      status: book.available_copies > 0 ? 'Available' : 'Issued',
      active_loans: loansMap[book.id] || []
    }));

    return res.json({
      success: true,
      count: enriched.length,
      books: enriched
    });
  } catch (err) {
    console.error('[Books List Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve books.'
    });
  }
});

// GET /api/books/:id (Book details with copy details)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    const [books] = await db.query(
      `SELECT b.*, c.name AS category_name, c.code AS category_code,
              a.name AS author_name, a.biography AS author_bio,
              p.name AS publisher_name, p.address AS publisher_address
       FROM books b
       JOIN categories c ON b.category_id = c.id
       JOIN authors a ON b.author_id = a.id
       LEFT JOIN publishers p ON b.publisher_id = p.id
       WHERE b.id = ?`,
      [bookId]
    );

    if (books.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const book = books[0];

    // Fetch physical copies
    const [copies] = await db.query(
      `SELECT c.id, c.barcode, c.copy_number, c.status, c.shelf_location, c.condition_status
       FROM book_copies c
       WHERE c.book_id = ?
       ORDER BY c.copy_number ASC`,
      [bookId]
    );

    return res.json({
      success: true,
      book: {
        ...book,
        status: book.available_copies > 0 ? 'Available' : 'Issued',
        copies
      }
    });
  } catch (err) {
    console.error('[Book Detail Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve book details.' });
  }
});

// POST /api/books (Add book - Librarian/Admin)
router.post('/', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const {
      title,
      isbn,
      author_name,
      category_name,
      publisher_name,
      edition,
      publication_year,
      call_number,
      total_copies,
      shelf_location,
      description
    } = req.body;

    if (!title || !isbn || !author_name || !category_name) {
      return res.status(400).json({
        success: false,
        message: 'Title, ISBN, Author Name, and Category are required.'
      });
    }

    // Check duplicate ISBN
    const [existingIsbn] = await db.query('SELECT id FROM books WHERE isbn = ?', [isbn.trim()]);
    if (existingIsbn.length > 0) {
      return res.status(409).json({
        success: false,
        message: `A book with ISBN ${isbn} already exists in the catalog.`
      });
    }

    // Resolve or create Author
    let authorId;
    const [existingAuthor] = await db.query('SELECT id FROM authors WHERE name = ?', [author_name.trim()]);
    if (existingAuthor.length > 0) {
      authorId = existingAuthor[0].id;
    } else {
      const [newAuthor] = await db.query('INSERT INTO authors (name) VALUES (?)', [author_name.trim()]);
      authorId = newAuthor.insertId;
    }

    // Resolve or create Category
    let categoryId;
    const [existingCat] = await db.query(
      'SELECT id FROM categories WHERE name = ? OR code = ?',
      [category_name.trim(), category_name.trim()]
    );
    if (existingCat.length > 0) {
      categoryId = existingCat[0].id;
    } else {
      const code = category_name.substring(0, 4).toUpperCase();
      const [newCat] = await db.query('INSERT INTO categories (name, code) VALUES (?, ?)', [category_name.trim(), code]);
      categoryId = newCat.insertId;
    }

    // Resolve or create Publisher
    let publisherId = null;
    if (publisher_name && publisher_name.trim() !== '') {
      const [existingPub] = await db.query('SELECT id FROM publishers WHERE name = ?', [publisher_name.trim()]);
      if (existingPub.length > 0) {
        publisherId = existingPub[0].id;
      } else {
        const [newPub] = await db.query('INSERT INTO publishers (name) VALUES (?)', [publisher_name.trim()]);
        publisherId = newPub.insertId;
      }
    }

    const numCopies = Math.max(1, parseInt(total_copies || '1', 10));

    // Insert book
    const [result] = await db.query(
      `INSERT INTO books (title, isbn, category_id, author_id, publisher_id, edition, publication_year, call_number, total_copies, available_copies, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        isbn.trim(),
        categoryId,
        authorId,
        publisherId,
        edition ? edition.trim() : null,
        publication_year ? parseInt(publication_year, 10) : new Date().getFullYear(),
        call_number ? call_number.trim() : `QA.${Math.floor(100 + Math.random() * 900)}`,
        numCopies,
        numCopies,
        description ? description.trim() : ''
      ]
    );

    const bookId = result.insertId;
    const defaultShelf = shelf_location ? shelf_location.trim() : 'Stack Main';

    // Auto-generate physical copy barcodes
    for (let i = 1; i <= numCopies; i++) {
      const cleanIsbnSuffix = isbn.replace(/[^0-9]/g, '').slice(-4) || String(bookId);
      const barcode = `ITP-${cleanIsbnSuffix}-${i.toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
      await db.query(
        `INSERT INTO book_copies (book_id, barcode, copy_number, status, shelf_location, condition_status)
         VALUES (?, ?, ?, 'available', ?, 'Good')`,
        [bookId, barcode, i, defaultShelf]
      );
    }

    await logActivity(req.user.id, 'ADD_BOOK', 'BOOK', bookId, `Added new book: ${title} (${numCopies} copies)`, req);

    return res.status(201).json({
      success: true,
      message: `Book "${title}" added to catalog successfully with ${numCopies} copies!`,
      bookId
    });
  } catch (err) {
    console.error('[Add Book Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to add book: ' + err.message });
  }
});

// PUT /api/books/:id (Update book - Librarian/Admin)
router.put('/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    const { title, isbn, edition, publication_year, call_number, description } = req.body;

    const [existing] = await db.query('SELECT * FROM books WHERE id = ?', [bookId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    await db.query(
      `UPDATE books 
       SET title = COALESCE(?, title),
           isbn = COALESCE(?, isbn),
           edition = COALESCE(?, edition),
           publication_year = COALESCE(?, publication_year),
           call_number = COALESCE(?, call_number),
           description = COALESCE(?, description)
       WHERE id = ?`,
      [
        title ? title.trim() : null,
        isbn ? isbn.trim() : null,
        edition ? edition.trim() : null,
        publication_year ? parseInt(publication_year, 10) : null,
        call_number ? call_number.trim() : null,
        description ? description.trim() : null,
        bookId
      ]
    );

    await logActivity(req.user.id, 'UPDATE_BOOK', 'BOOK', bookId, `Updated book ID ${bookId}`, req);

    return res.json({ success: true, message: 'Book details updated successfully.' });
  } catch (err) {
    console.error('[Update Book Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to update book: ' + err.message });
  }
});

// DELETE /api/books/:id (Delete book - Librarian/Admin)
router.delete('/:id', requireAuth, requireRole('librarian', 'admin'), async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    // Check if any copies are currently issued
    const [activeLoans] = await db.query(
      `SELECT count(*) as count FROM loans WHERE book_id = ? AND status IN ('active', 'overdue')`,
      [bookId]
    );

    if (activeLoans[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete book: Copies of this book are currently issued to students. Return all copies first.'
      });
    }

    // Delete copies and book
    await db.query('DELETE FROM book_copies WHERE book_id = ?', [bookId]);
    await db.query('DELETE FROM reservations WHERE book_id = ?', [bookId]);
    await db.query('DELETE FROM books WHERE id = ?', [bookId]);

    await logActivity(req.user.id, 'DELETE_BOOK', 'BOOK', bookId, `Deleted book ID ${bookId}`, req);

    return res.json({ success: true, message: 'Book and its physical copies removed from library catalog.' });
  } catch (err) {
    console.error('[Delete Book Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete book: ' + err.message });
  }
});

module.exports = router;
