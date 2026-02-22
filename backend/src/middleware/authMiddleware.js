/**
 * Authentication Middleware
 * JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { pool } = require('../config/database');

/**
 * Middleware to verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Extract token
        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, config.jwt.secret);

        // Get user from database
        const [users] = await pool.execute(
            'SELECT id, email, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found.'
            });
        }

        const user = users[0];

        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated.'
            });
        }

        // Attach user to request object
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }

        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed.'
        });
    }
}

module.exports = { authenticate };
