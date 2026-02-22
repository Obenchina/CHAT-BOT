/**
 * Database Configuration
 * MySQL connection setup using mysql2 with promise support
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medical_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

module.exports = { pool, testConnection };
