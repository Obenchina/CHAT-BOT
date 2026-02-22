/**
 * Doctor Controller
 * Handles doctor profile and dashboard operations
 */

const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');
const Case = require('../models/Case');
const Catalogue = require('../models/Catalogue');
const Patient = require('../models/Patient');

/**
 * Get doctor dashboard statistics
 * GET /api/doctor/dashboard
 */
async function getDashboard(req, res) {
    try {
        // Get doctor profile
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found'
            });
        }

        // Get statistics
        const pendingCases = await Case.findByDoctorId(doctor.id, 'submitted');
        const reviewedCases = await Case.findByDoctorId(doctor.id, 'reviewed');
        const assistants = await Assistant.findByDoctorId(doctor.id);
        const patients = await Patient.findByDoctorId(doctor.id);

        res.json({
            success: true,
            data: {
                doctor: {
                    id: doctor.id,
                    firstName: doctor.first_name,
                    lastName: doctor.last_name,
                    specialty: doctor.specialty
                },
                stats: {
                    pendingCases: pendingCases.length,
                    reviewedCases: reviewedCases.length,
                    totalAssistants: assistants.length,
                    activeAssistants: assistants.filter(a => a.is_active).length,
                    totalPatients: patients.length
                }
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard'
        });
    }
}

/**
 * Get doctor profile
 * GET /api/doctor/profile
 */
async function getProfile(req, res) {
    try {
        const doctor = await Doctor.getFullProfile(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: doctor.id,
                firstName: doctor.first_name,
                lastName: doctor.last_name,
                gender: doctor.gender,
                phone: doctor.phone,
                email: doctor.email,
                address: doctor.address,
                specialty: doctor.specialty,
                accountCreated: doctor.account_created
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
}

/**
 * Update doctor profile
 * PUT /api/doctor/profile
 */
async function updateProfile(req, res) {
    try {
        const { firstName, lastName, gender, phone, email, address, specialty } = req.body;

        const updated = await Doctor.update(req.user.id, {
            firstName,
            lastName,
            gender,
            phone,
            email,
            address,
            specialty
        });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found'
            });
        }

        // Get updated profile
        const doctor = await Doctor.getFullProfile(req.user.id);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: doctor.id,
                firstName: doctor.first_name,
                lastName: doctor.last_name,
                gender: doctor.gender,
                phone: doctor.phone,
                email: doctor.email,
                address: doctor.address,
                specialty: doctor.specialty
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
}

module.exports = {
    getDashboard,
    getProfile,
    updateProfile
};
