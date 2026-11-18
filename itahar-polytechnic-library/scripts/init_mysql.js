require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runInit() {
  console.log('--- ITAHAR GOVERNMENT POLYTECHNIC LIBRARY SYSTEM ---');
  console.log('[MySQL Init] Initializing MySQL Database Schema...');

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'itahar_library';

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`[MySQL Init] Connected to MySQL server at ${host}:${port}`);

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`[MySQL Init] Executing schema script from ${schemaPath}...`);
    await connection.query(sql);

    console.log(`[MySQL Init] Schema created successfully in database '${database}'!`);
    await connection.end();
  } catch (err) {
    console.error('[MySQL Init Error]', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runInit();
}

module.exports = runInit;
