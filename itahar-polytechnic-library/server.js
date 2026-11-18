require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

// Import Route Handlers
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const metadataRoutes = require('./routes/metadata');
const loansRoutes = require('./routes/loans');
const reservationsRoutes = require('./routes/reservations');
const requestsRoutes = require('./routes/requests');
const finesRoutes = require('./routes/fines');
const studentsRoutes = require('./routes/students');
const eresourcesRoutes = require('./routes/eresources');
const noticesRoutes = require('./routes/notices');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middlewares
// ALLOWED_ORIGINS env var: comma-separated list of frontend URLs.
// Example: https://itahar-library.netlify.app,http://localhost:3000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // In development allow everything
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // In production check against whitelist
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed.`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// In production the frontend is on Netlify — do NOT serve static files from here.
// In local dev we still serve from /public for convenience.
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'ITAHAR GOVERNMENT POLYTECHNIC - Library Portal',
    database_adapter: db.getAdapter().toUpperCase(),
    timestamp: new Date().toISOString()
  });
});

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/fines', finesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/eresources', eresourcesRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

// Favicon silent handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Catch-all for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Single Page Application Fallback for client routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    return res.sendFile(indexPath, (err) => {
      if (err) next();
    });
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server if executed directly
if (require.main === module) {
  (async () => {
    try {
      await db.initDatabase();
      app.listen(PORT, () => {
        console.log(`================================================================`);
        console.log(` ITAHAR GOVERNMENT POLYTECHNIC - Library Portal`);
        console.log(` Server running on http://localhost:${PORT}`);
        console.log(` Active Database Adapter: ${db.getAdapter().toUpperCase()}`);
        console.log(`================================================================`);
      });
    } catch (err) {
      console.error('[Startup Error]', err);
      process.exit(1);
    }
  })();
}

module.exports = app;
