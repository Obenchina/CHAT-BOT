/**
 * Main Express Application
 * Entry point for the Medical Website Backend API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const { testConnection } = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const patientRoutes = require('./routes/patientRoutes');
const catalogueRoutes = require('./routes/catalogueRoutes');
const caseRoutes = require('./routes/caseRoutes');
const aiChatRoutes = require('./routes/aiChatRoutes');

// Initialize Express app
const app = express();

// Trust proxy for express-rate-limit on Render/Vercel
app.set('trust proxy', 1);

// ======================
// MIDDLEWARE CONFIGURATION
// ======================

// Enable CORS for frontend
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'https://ia-diagnostique.vercel.app'];

app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

// Security headers (CSP, X-Frame-Options, HSTS, etc.)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

// Force UTF-8 charset on all JSON responses
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return originalJson(body);
    };
    next();
});

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ======================
// INITIALIZE UPLOADS DIRECTORIES
// ======================
const fs = require('fs');
const uploadDirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/images'),
    path.join(__dirname, '../uploads/audio'),
    path.join(__dirname, '../uploads/chat-images'),
    path.join(__dirname, '../uploads/pdf'),
    path.join(__dirname, '../uploads/prescriptions'),
    path.join(__dirname, '../uploads/temp')
];

uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`ðŸ“ Created directory: ${dir}`);
    }
});

// Serve uploaded files with JWT authentication
// Supports both: Authorization header (API calls) and ?token= query param (img/audio/a tags)
const jwt = require('jsonwebtoken');
app.use('/uploads', (req, res, next) => {
    try {
        let token = null;

        // 1. Try cookie first (safest)
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // 2. Try Authorization header
        const authHeader = req.headers.authorization;
        if (!token && authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // 3. Fallback to query parameter (legacy for <img>, <audio>, <a> tags)
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'AccÃ¨s non autorisÃ©.' });
        }

        jwt.verify(token, config.jwt.secret);
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token invalide ou expirÃ©.' });
    }
}, express.static(path.join(__dirname, '../uploads')));

// ======================
// RATE LIMITING
// ======================

// General API rate limit
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000, // Increased for development
    message: {
        success: false,
        message: 'Trop de requetes, veuillez reessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limit for authentication
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000, // Increased for development
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

// AI Chat routes (doctor-AI conversation)
app.use('/api/ai-chat', aiChatRoutes);

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

const PORT = Number(config.server.port) || 5000;

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

function quoteIdentifier(identifier) {
    if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
        throw new Error(`Invalid identifier: ${identifier}`);
    }

    return `\`${identifier}\``;
}

async function ensureSetNullForeignKey(pool, tableName, columnName, referencedTableName, referencedColumnName) {
    const [rows] = await pool.execute(
        `SELECT kcu.CONSTRAINT_NAME, rc.DELETE_RULE, col.IS_NULLABLE
         FROM information_schema.KEY_COLUMN_USAGE kcu
         JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
           ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
          AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND rc.TABLE_NAME = kcu.TABLE_NAME
         JOIN information_schema.COLUMNS col
           ON col.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          AND col.TABLE_NAME = kcu.TABLE_NAME
          AND col.COLUMN_NAME = kcu.COLUMN_NAME
         WHERE kcu.TABLE_SCHEMA = DATABASE()
           AND kcu.TABLE_NAME = ?
           AND kcu.COLUMN_NAME = ?
           AND kcu.REFERENCED_TABLE_NAME = ?
           AND kcu.REFERENCED_COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName, referencedTableName, referencedColumnName]
    );

    const table = quoteIdentifier(tableName);
    const column = quoteIdentifier(columnName);
    const referencedTable = quoteIdentifier(referencedTableName);
    const referencedColumn = quoteIdentifier(referencedColumnName);
    const foreignKeyName = rows[0]?.CONSTRAINT_NAME || `${tableName}_${columnName}_fk`;

    const shouldRecreate = !rows[0]?.CONSTRAINT_NAME || rows[0].DELETE_RULE !== 'SET NULL' || rows[0].IS_NULLABLE !== 'YES';

    if (rows[0]?.CONSTRAINT_NAME && shouldRecreate) {
        await pool.execute(`ALTER TABLE ${table} DROP FOREIGN KEY ${quoteIdentifier(rows[0].CONSTRAINT_NAME)}`);
    }

    await pool.execute(`ALTER TABLE ${table} MODIFY COLUMN ${column} INT NULL`);

    if (shouldRecreate) {
        await pool.execute(
            `ALTER TABLE ${table}
             ADD CONSTRAINT ${quoteIdentifier(foreignKeyName)}
             FOREIGN KEY (${column}) REFERENCES ${referencedTable}(${referencedColumn}) ON DELETE SET NULL`
        );
    }
}

async function runMigrations(pool) {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS pending_registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            gender ENUM('male','female') DEFAULT 'male',
            phone VARCHAR(50),
            address TEXT,
            specialty VARCHAR(100),
            otp_code VARCHAR(10) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await ensureColumn(pool, 'catalogues', 'name', "VARCHAR(150) NOT NULL DEFAULT 'Catalogue'");
    await ensureColumn(pool, 'catalogues', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');
    await ensureColumn(pool, 'case_answers', 'question_text_snapshot', 'TEXT NULL');
    await ensureColumn(pool, 'case_answers', 'answer_type_snapshot', "ENUM('yes_no','voice','choices','text_short','text_long','number') NULL");
    await ensureColumn(pool, 'case_answers', 'text_answer', 'TEXT NULL');
    await ensureColumn(pool, 'case_answers', 'order_index_snapshot', 'INT NULL');

    await ensureSetNullForeignKey(pool, 'questions', 'catalogue_id', 'catalogues', 'id');
    await ensureSetNullForeignKey(pool, 'cases', 'catalogue_version_id', 'catalogues', 'id');
    await ensureSetNullForeignKey(pool, 'case_answers', 'question_id', 'questions', 'id');

    // Update ENUMs to allow new types
    try {
        await pool.execute("ALTER TABLE questions MODIFY COLUMN answer_type ENUM('yes_no', 'voice', 'choices', 'text_short', 'text_long', 'number') NOT NULL");
        await pool.execute("ALTER TABLE case_answers MODIFY COLUMN answer_type_snapshot ENUM('yes_no', 'voice', 'choices', 'text_short', 'text_long', 'number') NULL");
    } catch (err) {
        console.warn('Could not modify ENUMs:', err.message);
    }
    await ensureColumn(pool, 'doctors', 'prescription_logo_path', 'VARCHAR(500) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_primary_color', 'VARCHAR(20) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_accent_color', 'VARCHAR(20) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_specialty_text', 'VARCHAR(255) NULL');
    await ensureColumn(pool, 'doctors', 'prescription_services_text', 'TEXT NULL');
    await ensureColumn(pool, 'doctors', 'analyses_list', 'TEXT NULL');
    await ensureColumn(pool, 'doctors', 'letter_template', 'TEXT NULL');

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS doctor_medications (
            id INT PRIMARY KEY AUTO_INCREMENT,
            doctor_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            default_dosage VARCHAR(100),
            default_frequency VARCHAR(100),
            default_duration VARCHAR(100),
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
            INDEX idx_doctor_name (doctor_id, name)
        ) ENGINE=InnoDB;
    `);
    await ensureColumn(pool, 'doctor_medications', 'default_duration', 'VARCHAR(100) NULL');

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ai_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            doctor_id INT NOT NULL,
            provider VARCHAR(50) NOT NULL,
            api_key TEXT NOT NULL,
            model VARCHAR(120) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT FALSE,
            response_language ENUM('ar','fr') NOT NULL DEFAULT 'fr',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_doctor_provider (doctor_id, provider),
            INDEX idx_doctor_active (doctor_id, is_active),
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    `);
    await ensureColumn(pool, 'ai_config', 'response_language', "ENUM('ar','fr') NOT NULL DEFAULT 'fr'");

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ai_chat_messages (
            id INT PRIMARY KEY AUTO_INCREMENT,
            case_id INT NOT NULL,
            doctor_id INT NOT NULL,
            role ENUM('doctor', 'ai') NOT NULL,
            content TEXT NOT NULL,
            attachment_path VARCHAR(500) NULL,
            attachment_name VARCHAR(255) NULL,
            attachment_mime VARCHAR(120) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
            INDEX idx_case (case_id),
            INDEX idx_doctor (doctor_id)
        ) ENGINE=InnoDB;
    `);
    await ensureColumn(pool, 'ai_chat_messages', 'attachment_path', 'VARCHAR(500) NULL');
    await ensureColumn(pool, 'ai_chat_messages', 'attachment_name', 'VARCHAR(255) NULL');
    await ensureColumn(pool, 'ai_chat_messages', 'attachment_mime', 'VARCHAR(120) NULL');

    await pool.execute(`
        UPDATE catalogues
        SET
            name = COALESCE(NULLIF(TRIM(name), ''), 'Catalogue'),
            is_active = COALESCE(is_active, TRUE)
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

    // Migrations completed

    // Growth curves table â€” v2 schema with reference + extracted source types.
    // Old columns (file_path, template_config, is_calibrated) are kept nullable for
    // backward-compatible deploys; new uploads no longer write to them.
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS doctor_growth_curves (
            id INT PRIMARY KEY AUTO_INCREMENT,
            doctor_id INT NOT NULL,
            measure_key VARCHAR(50) NOT NULL,
            gender ENUM('male', 'female') NOT NULL DEFAULT 'male',
            source_type ENUM('reference', 'extracted', 'calibrated_overlay') NOT NULL DEFAULT 'reference',
            reference_id VARCHAR(100) NULL,
            curve_data JSON NULL,
            validation_status ENUM('auto_approved', 'pending_review', 'doctor_approved', 'rejected') NOT NULL DEFAULT 'auto_approved',
            original_image_path VARCHAR(255) NULL,
            label VARCHAR(255) NULL,
            chart_kind VARCHAR(40) NULL,
            calibration JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    `);

    // Online migration for databases that pre-date v2.
    await ensureColumn(pool, 'doctor_growth_curves', 'source_type', "ENUM('reference', 'extracted', 'calibrated_overlay') NOT NULL DEFAULT 'reference'");
    await ensureColumn(pool, 'doctor_growth_curves', 'reference_id', 'VARCHAR(100) NULL');
    await ensureColumn(pool, 'doctor_growth_curves', 'curve_data', 'JSON NULL');
    await ensureColumn(pool, 'doctor_growth_curves', 'validation_status', "ENUM('auto_approved', 'pending_review', 'doctor_approved', 'rejected') NOT NULL DEFAULT 'auto_approved'");
    await ensureColumn(pool, 'doctor_growth_curves', 'original_image_path', 'VARCHAR(255) NULL');
    await ensureColumn(pool, 'doctor_growth_curves', 'label', 'VARCHAR(255) NULL');
    await ensureColumn(pool, 'doctor_growth_curves', 'chart_kind', 'VARCHAR(40) NULL');
    await ensureColumn(pool, 'doctor_growth_curves', 'calibration', 'JSON NULL');
    await ensureColumn(pool, 'doctor_growth_curves', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    // Extend ENUMs in case an older deploy was created before the
    // calibrated_overlay variant was added.
    try {
        await pool.execute("ALTER TABLE doctor_growth_curves MODIFY COLUMN source_type ENUM('reference', 'extracted', 'calibrated_overlay') NOT NULL DEFAULT 'reference'");
    } catch (err) {
        console.warn('Could not extend doctor_growth_curves.source_type ENUM:', err.message);
    }
    // Make legacy required column optional so the new flow can omit it.
    try {
        await pool.execute('ALTER TABLE doctor_growth_curves MODIFY COLUMN file_path VARCHAR(255) NULL');
    } catch (err) {
        // Column may have been removed already.
    }

    console.log('Database migrations ready');
}

function listenWithFallback(preferredPort, maxAttempts = 10) {
    return new Promise((resolve, reject) => {
        const tryListen = (attempt) => {
            const portToTry = preferredPort + attempt;
            const server = app.listen(portToTry, () => resolve({ server, port: portToTry }));

            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE' && attempt < maxAttempts - 1) {
                    console.warn(`Port ${portToTry} already in use, trying ${portToTry + 1}...`);
                    tryListen(attempt + 1);
                    return;
                }
                reject(error);
            });
        };

        tryListen(0);
    });
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

    try {
        const { server, port } = await listenWithFallback(PORT, 20);
        console.log(`Server running on http://localhost:${port}`);
        console.log(`Environment: ${config.server.env}`);

        server.on('error', (error) => {
            console.error('Server error:', error);
            process.exit(1);
        });
    } catch (error) {
        if (error.code === 'EADDRINUSE') {
            console.error(`No available port found starting from ${PORT}.`);
        } else {
            console.error('Server error:', error);
        }
        process.exit(1);
    }
}

startServer();

module.exports = app;
