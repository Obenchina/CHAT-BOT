/**
 * Authentication Controller
 * Handles user registration, login, and password reset
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');
const config = require('../config/config');

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
}

/**
 * Register new doctor
 * POST /api/auth/register
 */
async function register(req, res) {
    try {
        const { email, password, firstName, lastName, gender, phone, address, specialty } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName || !phone || !specialty) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if email already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user account
        const user = await User.create({
            email,
            password,
            role: 'doctor'
        });

        // Create doctor profile
        const doctor = await Doctor.create({
            userId: user.id,
            firstName,
            lastName,
            gender,
            phone,
            email,
            address,
            specialty
        });

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                doctor: {
                    id: doctor.id,
                    firstName,
                    lastName,
                    specialty
                },
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
}

/**
 * Login user (doctor or assistant)
 * POST /api/auth/login
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Verify password
        const isValidPassword = await User.verifyPassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Get profile based on role
        let profile = null;
        if (user.role === 'doctor') {
            profile = await Doctor.findByUserId(user.id);
        } else if (user.role === 'assistant') {
            profile = await Assistant.findByUserId(user.id);
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                profile,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
}

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find user
        const user = await User.findByEmail(email);

        // Always return success to prevent email enumeration
        res.json({
            success: true,
            message: 'If account exists, reset instructions will be sent'
        });

        // In production: Send reset email here
        if (user) {
            // TODO: Implement email sending
            console.log(`Password reset requested for: ${email}`);
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Request failed'
        });
    }
}

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        // TODO: Verify reset token and update password
        // This requires implementing a password reset token system

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Password reset failed'
        });
    }
}

/**
 * Get current user info
 * GET /api/auth/me
 */
/**
 * Change password
 * POST /api/auth/change-password
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new password are required'
            });
        }

        const user = await User.findByIdWithPassword(req.user.id);

        // Verify current password
        const isValidPassword = await User.verifyPassword(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid current password'
            });
        }

        // Update password
        await User.updatePassword(user.id, newPassword);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
}

async function getCurrentUser(req, res) {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get profile based on role
        let profile = null;
        if (user.role === 'doctor') {
            profile = await Doctor.findByUserId(user.id);
        } else if (user.role === 'assistant') {
            profile = await Assistant.findByUserId(user.id);
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                profile
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user info'
        });
    }
}

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
    changePassword,
    getCurrentUser
};
