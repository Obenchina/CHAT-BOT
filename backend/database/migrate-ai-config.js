/**
 * Migration: Create ai_config table
 * Run with: node database/migrate-ai-config.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medical_db'
    });

    console.log('Connected to database. Creating ai_config table...');

    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ai_config (
            id INT PRIMARY KEY AUTO_INCREMENT,
            doctor_id INT NOT NULL UNIQUE,
            provider ENUM('gemini', 'openai') NOT NULL DEFAULT 'gemini',
            api_key VARCHAR(500) NOT NULL DEFAULT '',
            model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash-lite',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    `);

    console.log('✅ ai_config table created successfully!');
    await connection.end();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
