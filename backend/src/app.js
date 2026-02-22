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
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

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
        message: 'Trop de requêtes, veuillez réessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limit for authentication: 200 requests per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
        success: false,
        message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false,
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
app.use((req, res, next) => {
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

async function startServer() {
    // Test database connection
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.warn('⚠️  Starting server without database connection');
    }

    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📍 Environment: ${config.server.env}`);
    });
}

startServer();

module.exports = app;
