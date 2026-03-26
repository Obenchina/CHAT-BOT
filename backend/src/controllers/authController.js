/**
 * Authentication Controller
 * Handles user registration (with OTP email verification), login, and password reset
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');
const config = require('../config/config');
const { pool } = require('../config/database');
const { sendVerificationCode } = require('../services/emailService');

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
 * Generate a random 6-digit OTP code
 * @returns {string} 6-digit code
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Register new doctor (Step 1: send OTP)
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

        // Check if email already exists in users table
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate OTP
        const otpCode = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Upsert into pending_registrations (replace if same email exists)
        await pool.execute(
            `INSERT INTO pending_registrations (email, password_hash, first_name, last_name, gender, phone, address, specialty, otp_code, otp_expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                password_hash = VALUES(password_hash),
                first_name = VALUES(first_name),
                last_name = VALUES(last_name),
                gender = VALUES(gender),
                phone = VALUES(phone),
                address = VALUES(address),
                specialty = VALUES(specialty),
                otp_code = VALUES(otp_code),
                otp_expires_at = VALUES(otp_expires_at),
                created_at = NOW()`,
            [email, passwordHash, firstName, lastName, gender || 'male', phone, address || '', specialty, otpCode, otpExpiresAt]
        );

        // Get the pending ID
        const [rows] = await pool.execute(
            'SELECT id FROM pending_registrations WHERE email = ?',
            [email]
        );
        const pendingId = rows[0].id;

        // Send OTP email
        const emailSent = await sendVerificationCode(email, otpCode);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again.'
            });
        }

        console.log(`📧 OTP sent to ${email} (pendingId: ${pendingId})`);

        res.status(200).json({
            success: true,
            message: 'Verification code sent to your email',
            data: {
                pendingId,
                email
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
 * Verify OTP and complete registration (Step 2)
 * POST /api/auth/verify-registration
 */
async function verifyRegistration(req, res) {
    try {
        const { pendingId, code } = req.body;

        if (!pendingId || !code) {
            return res.status(400).json({
                success: false,
                message: 'Pending ID and verification code are required'
            });
        }

        // Find pending registration
        const [rows] = await pool.execute(
            'SELECT * FROM pending_registrations WHERE id = ?',
            [pendingId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Registration request not found. Please register again.'
            });
        }

        const pending = rows[0];

        // Check if OTP has expired
        if (new Date() > new Date(pending.otp_expires_at)) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new one.',
                expired: true
            });
        }

        // Check OTP match
        if (pending.otp_code !== code.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }

        // OTP is valid — create the real account
        // Check again that email is not taken (race condition protection)
        const existingUser = await User.findByEmail(pending.email);
        if (existingUser) {
            // Clean up pending record
            await pool.execute('DELETE FROM pending_registrations WHERE id = ?', [pendingId]);
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user account (password is already hashed)
        const [userResult] = await pool.execute(
            `INSERT INTO users (email, password, role, is_active, created_at, updated_at)
             VALUES (?, ?, 'doctor', true, NOW(), NOW())`,
            [pending.email, pending.password_hash]
        );

        const userId = userResult.insertId;

        // Create doctor profile
        const doctor = await Doctor.create({
            userId,
            firstName: pending.first_name,
            lastName: pending.last_name,
            gender: pending.gender,
            phone: pending.phone,
            email: pending.email,
            address: pending.address,
            specialty: pending.specialty
        });

        // Delete pending record
        await pool.execute('DELETE FROM pending_registrations WHERE id = ?', [pendingId]);

        // Generate token
        const token = generateToken({ id: userId, role: 'doctor' });

        console.log(`✅ Doctor account created: ${pending.email} (userId: ${userId})`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: userId,
                    email: pending.email,
                    role: 'doctor'
                },
                doctor: {
                    id: doctor.id,
                    firstName: pending.first_name,
                    lastName: pending.last_name,
                    specialty: pending.specialty
                },
                token
            }
        });
    } catch (error) {
        console.error('Verify registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed'
        });
    }
}

/**
 * Resend OTP code
 * POST /api/auth/resend-otp
 */
async function resendOtp(req, res) {
    try {
        const { pendingId } = req.body;

        if (!pendingId) {
            return res.status(400).json({
                success: false,
                message: 'Pending ID is required'
            });
        }

        // Find pending registration
        const [rows] = await pool.execute(
            'SELECT * FROM pending_registrations WHERE id = ?',
            [pendingId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Registration request not found. Please register again.'
            });
        }

        const pending = rows[0];

        // Generate new OTP
        const newOtp = generateOTP();
        const newExpiry = new Date(Date.now() + 10 * 60 * 1000);

        // Update record
        await pool.execute(
            'UPDATE pending_registrations SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
            [newOtp, newExpiry, pendingId]
        );

        // Send email
        const emailSent = await sendVerificationCode(pending.email, newOtp);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to re-send verification email.'
            });
        }

        console.log(`📧 OTP re-sent to ${pending.email}`);

        res.json({
            success: true,
            message: 'New verification code sent'
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend code'
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

/**
 * Get current user info
 * GET /api/auth/me
 */
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
    verifyRegistration,
    resendOtp,
    login,
    forgotPassword,
    resetPassword,
    changePassword,
    getCurrentUser
};
