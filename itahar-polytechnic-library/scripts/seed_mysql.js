require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runSeed() {
  console.log('--- ITAHAR GOVERNMENT POLYTECHNIC LIBRARY SYSTEM ---');
  console.log('[MySQL Seed] Populating MySQL Database with Seed Data...');

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
      database,
      multipleStatements: true
    });

    console.log(`[MySQL Seed] Connected to database '${database}'`);

    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    console.log(`[MySQL Seed] Executing seed script from ${seedPath}...`);
    await connection.query(sql);

    console.log('[MySQL Seed] Seed data inserted successfully!');
    await connection.end();
  } catch (err) {
    console.error('[MySQL Seed Error]', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
