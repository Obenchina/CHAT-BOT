/**
 * Assistant Controller
 * Handles assistant CRUD operations (managed by doctor)
 */

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');

/**
 * Get all assistants for current doctor
 * GET /api/assistant
 */
async function getAll(req, res) {
    try {
        // Get doctor profile
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const assistants = await Assistant.findByDoctorId(doctor.id);

        res.json({
            success: true,
            data: assistants.map(a => ({
                id: a.id,
                firstName: a.first_name,
                lastName: a.last_name,
                email: a.email,
                isActive: a.is_active
            }))
        });
    } catch (error) {
        console.error('Get assistants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get assistants'
        });
    }
}

/**
 * Create new assistant
 * POST /api/assistant
 */
async function create(req, res) {
    try {
        const { email, password, firstName, lastName } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get doctor profile
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
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

        // Create user account for assistant
        const user = await User.create({
            email,
            password,
            role: 'assistant'
        });

        // Create assistant profile
        const assistant = await Assistant.create({
            userId: user.id,
            doctorId: doctor.id,
            firstName,
            lastName
        });

        res.status(201).json({
            success: true,
            message: 'Assistant created successfully',
            data: {
                id: assistant.id,
                firstName,
                lastName,
                email,
                isActive: true
            }
        });
    } catch (error) {
        console.error('Create assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create assistant'
        });
    }
}

/**
 * Update assistant
 * PUT /api/assistant/:id
 */
async function update(req, res) {
    try {
        const { id } = req.params;
        const { firstName, lastName, isActive } = req.body;

        // Get doctor profile
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Get assistant and verify ownership
        const assistant = await Assistant.findById(id);

        if (!assistant || assistant.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Update assistant
        await Assistant.update(id, { firstName, lastName, isActive });

        // Also update user active status if changing isActive
        if (isActive !== undefined) {
            await User.updateActiveStatus(assistant.user_id, isActive);
        }

        res.json({
            success: true,
            message: 'Assistant updated successfully'
        });
    } catch (error) {
        console.error('Update assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update assistant'
        });
    }
}

/**
 * Toggle assistant active status
 * PATCH /api/assistant/:id/toggle
 */
async function toggleStatus(req, res) {
    try {
        const { id } = req.params;

        // Get doctor profile
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Get assistant and verify ownership
        const assistant = await Assistant.findById(id);

        if (!assistant || assistant.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Toggle status
        const newStatus = !assistant.is_active;
        await Assistant.setActiveStatus(id, newStatus);
        await User.updateActiveStatus(assistant.user_id, newStatus);

        res.json({
            success: true,
            message: `Assistant ${newStatus ? 'activated' : 'deactivated'} successfully`,
            data: {
                isActive: newStatus
            }
        });
    } catch (error) {
        console.error('Toggle assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle assistant status'
        });
    }
}

/**
 * Delete assistant
 * DELETE /api/assistant/:id
 */
async function remove(req, res) {
    try {
        const { id } = req.params;

        // Get doctor profile
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Get assistant and verify ownership
        const assistant = await Assistant.findById(id);

        if (!assistant || assistant.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Delete assistant
        await Assistant.delete(id);

        res.json({
            success: true,
            message: 'Assistant deleted successfully'
        });
    } catch (error) {
        console.error('Delete assistant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete assistant'
        });
    }
}

/**
 * Get assistant profile (for assistant user)
 * GET /api/assistant/profile
 */
async function getProfile(req, res) {
    try {
        const assistant = await Assistant.findByUserId(req.user.id);

        if (!assistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant profile not found'
            });
        }

        // Get doctor info
        const doctor = await Doctor.findById(assistant.doctor_id);

        res.json({
            success: true,
            data: {
                id: assistant.id,
                first_name: assistant.first_name,
                last_name: assistant.last_name,
                firstName: assistant.first_name,
                lastName: assistant.last_name,
                gender: assistant.gender,
                phone: assistant.phone,
                email: req.user.email,
                isActive: assistant.is_active,
                doctor: doctor ? {
                    id: doctor.id,
                    firstName: doctor.first_name,
                    lastName: doctor.last_name,
                    specialty: doctor.specialty
                } : null
            }
        });
    } catch (error) {
        console.error('Get assistant profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
}

/**
 * Update assistant profile (for assistant user)
 * PUT /api/assistant/profile
 */
async function updateProfile(req, res) {
    try {
        const { firstName, lastName, gender, phone, email } = req.body;

        const assistant = await Assistant.findByUserId(req.user.id);

        if (!assistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant profile not found'
            });
        }

        // Handle email update if changed
        if (email && email !== req.user.email) {
            // Check if email already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }

            // Update email in User table
            await User.updateEmail(req.user.id, email);
        }

        // Update assistant
        await Assistant.update(assistant.id, { firstName, lastName, gender, phone });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                firstName,
                lastName,
                gender,
                phone,
                email
            }
        });
    } catch (error) {
        console.error('Update assistant profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
}

module.exports = {
    getAll,
    create,
    update,
    toggleStatus,
    remove,
    getProfile,
    updateProfile
};
