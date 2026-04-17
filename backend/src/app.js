/**
 * Main Express Application
 * Entry point for the Medical Website Backend API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');
const { testConnection } = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const patientRoutes = require('./routes/patientRoutes');
const catalogueRoutes = require('./routes/catalogueRoutes');
const caseRoutes = require('./routes/caseRoutes');

// Initialize Express app
const app = express();

// ======================
// MIDDLEWARE CONFIGURATION
// ======================

// Enable CORS for frontend
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ======================
// INITIALIZE UPLOADS DIRECTORIES
// ======================
const fs = require('fs');
const uploadDirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/images'),
    path.join(__dirname, '../uploads/audio'),
    path.join(__dirname, '../uploads/pdf'),
    path.join(__dirname, '../uploads/prescriptions'),
    path.join(__dirname, '../uploads/temp')
];

uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ======================
// RATE LIMITING
// ======================

// General API rate limit: 1000 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        message: 'Trop de requetes, veuillez reessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limit for authentication: 200 requests per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
        success: false,
        message: 'Trop de tentatives de connexion, veuillez reessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// ======================
// API ROUTES
// ======================

// Authentication routes (login, register, forgot password)
app.use('/api/auth', authLimiter, authRoutes);

// Doctor routes (profile, dashboard)
app.use('/api/doctor', doctorRoutes);

// Assistant routes (profile)
app.use('/api/assistant', assistantRoutes);

// Patient routes (CRUD operations)
app.use('/api/patients', patientRoutes);

// Catalogue routes (questions management)
app.use('/api/catalogue', catalogueRoutes);

// Case routes (medical cases workflow)
app.use('/api/cases', caseRoutes);

// ======================
// HEALTH CHECK ENDPOINT
// ======================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Medical Website API is running',
        timestamp: new Date().toISOString()
    });
});

// ======================
// ERROR HANDLING
// ======================

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ======================
// SERVER STARTUP
// ======================

const PORT = config.server.port;

async function ensureColumn(pool, tableName, columnName, definition) {
    const [rows] = await pool.execute(
        `SELECT COUNT(*) as count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );

    if (!rows[0].count) {
        await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        console.log(`Added column ${tableName}.${columnName}`);
    }
}

async function runMigrations(pool) {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS pending_registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            gender ENUM('male','female') DEFAULT 'male',
            phone VARCHAR(50),
            address TEXT,
            specialty VARCHAR(100),
            otp_code VARCHAR(10) NOT NULL,
            otp_expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await ensureColumn(pool, 'catalogues', 'name', "VARCHAR(150) NOT NULL DEFAULT 'Catalogue'");
    await ensureColumn(pool, 'catalogues', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');
    await ensureColumn(pool, 'case_answers', 'question_text_snapshot', 'TEXT NULL');
    await ensureColumn(pool, 'case_answers', 'answer_type_snapshot', "ENUM('yes_no','voice','choices') NULL");
    await ensureColumn(pool, 'case_answers', 'order_index_snapshot', 'INT NULL');
    await ensureColumn(pool, 'doctors', 'prescription_logo_path', 'VARCHAR(500) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_primary_color', 'VARCHAR(20) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_accent_color', 'VARCHAR(20) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_specialty_text', 'VARCHAR(255) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_services_text', 'TEXT NULL');
    await ensureColumn(pool, 'doctors', 'analyses_list', 'TEXT NULL');
    await ensureColumn(pool, 'doctors', 'letter_template', 'TEXT NULL');

    await pool.execute(`
        UPDATE catalogues
        SET
            name = CASE
                WHEN name IS NULL OR TRIM(name) = '' OR name = 'Catalogue' THEN CONCAT('Catalogue ', version)
                ELSE name
            END,
            is_active = COALESCE(is_active, is_published, TRUE),
            is_published = COALESCE(is_active, is_published, TRUE)
    `);

    await pool.execute(`
        UPDATE case_answers ca
        LEFT JOIN questions q ON q.id = ca.question_id
        SET
            ca.question_text_snapshot = COALESCE(ca.question_text_snapshot, q.question_text),
            ca.answer_type_snapshot = COALESCE(ca.answer_type_snapshot, q.answer_type),
            ca.order_index_snapshot = COALESCE(ca.order_index_snapshot, q.order_index)
        WHERE
            ca.question_text_snapshot IS NULL
            OR ca.answer_type_snapshot IS NULL
            OR ca.order_index_snapshot IS NULL
    `);
    console.log('Database migrations ready');
}

async function startServer() {
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.warn('Starting server without database connection');
    } else {
        try {
            const { pool } = require('./config/database');
            await runMigrations(pool);
        } catch (err) {
            console.warn('Could not run startup migrations:', err.message);
        }
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Environment: ${config.server.env}`);
    });
}

startServer();

module.exports = app;
