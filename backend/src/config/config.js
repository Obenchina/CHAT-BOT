/**
 * Application Configuration
 * Central configuration file for environment variables
 */

require('dotenv').config();

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 5000,
        env: process.env.NODE_ENV || 'development'
    },

    // Database configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'medical_db'
    },

    // JWT configuration
    jwt: {
        secret: process.env.JWT_SECRET || (() => { console.warn('⚠️ WARNING: JWT_SECRET non défini dans .env — utilisation d\'une clé temporaire pour le développement.'); return 'dev_only_insecure_key_' + Date.now(); })(),
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },

    // AI configuration (Gemini)
    ai: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    },

    // File upload configuration
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
        path: process.env.UPLOAD_PATH || './uploads'
    },

    // Email SMTP configuration
    email: {
        smtpEmail: process.env.SMTP_EMAIL || '',
        smtpPassword: process.env.SMTP_PASSWORD || ''
    }
};

module.exports = config;
