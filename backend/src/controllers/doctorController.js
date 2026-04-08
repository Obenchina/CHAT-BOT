/**
 * Doctor Controller
 * Handles doctor profile and dashboard operations
 */

const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Assistant = require('../models/Assistant');
const Case = require('../models/Case');
const Catalogue = require('../models/Catalogue');
const Patient = require('../models/Patient');
const AiConfig = require('../models/AiConfig');

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

        // Update name in users table
        if (firstName || lastName) {
            await User.updateName(req.user.id, firstName, lastName);
        }

        // Update email in users table if changed
        if (email) {
            await User.updateEmail(req.user.id, email);
        }

        // Update doctor-specific fields
        const updated = await Doctor.update(req.user.id, {
            gender,
            phone,
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

/**
 * Get doctor's AI configuration
 * GET /api/doctor/ai-config
 */
async function getAiConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const allConfigs = await AiConfig.getAllConfigs(doctor.id);
        const activeConfig = await AiConfig.findActiveConfig(doctor.id);

        const configsMap = {};
        allConfigs.forEach(conf => {
            configsMap[conf.provider] = {
                apiKey: conf.api_key ? '••••' + conf.api_key.slice(-4) : '',
                model: conf.model,
                hasKey: !!conf.api_key
            };
        });

        res.json({
            success: true,
            data: {
                activeProvider: activeConfig ? activeConfig.provider : 'gemini',
                configs: configsMap
            }
        });
    } catch (error) {
        console.error('Get AI config error:', error);
        res.status(500).json({ success: false, message: 'Failed to get AI config' });
    }
}

/**
 * Update doctor's AI configuration
 * PUT /api/doctor/ai-config
 */
async function updateAiConfig(req, res) {
    try {
        const { provider, apiKey, model } = req.body;

        if (!provider || !['gemini', 'openai'].includes(provider)) {
            return res.status(400).json({ success: false, message: 'Invalid provider' });
        }
        if (!model) {
            return res.status(400).json({ success: false, message: 'Model is required' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        // If apiKey is masked (starts with ••••), keep the existing one for THIS provider
        let finalApiKey = apiKey;
        if (apiKey && apiKey.startsWith('••••')) {
            const existing = await AiConfig.findByProvider(doctor.id, provider);
            finalApiKey = existing ? existing.api_key : '';
        }

        await AiConfig.upsert(doctor.id, {
            provider,
            apiKey: finalApiKey || '',
            model
        });

        res.json({
            success: true,
            message: 'AI configuration updated successfully'
        });
    } catch (error) {
        console.error('Update AI config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update AI config' });
    }
}

/**
 * Activate a specific AI configuration instantly
 * PUT /api/doctor/ai-config/activate
 */
async function activateAiConfig(req, res) {
    try {
        const { provider } = req.body;
        if (!provider || !['gemini', 'openai'].includes(provider)) {
            return res.status(400).json({ success: false, message: 'Invalid provider' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        await AiConfig.setActiveProvider(doctor.id, provider);

        res.json({
            success: true,
            message: `Provider ${provider} activated successfully`
        });
    } catch (error) {
        console.error('Activate AI config error:', error);
        res.status(500).json({ success: false, message: 'Failed to activate AI config' });
    }
}

/**
 * Get AI global availability status
 * Checks the last 5 cases to see if API errors or quota limits were hit.
 * GET /api/doctor/ai-config/status
 */
async function getAiStatus(req, res) {
    try {
        const { pool } = require('../config/database');
        const AiConfig = require('../models/AiConfig');
        const Doctor = require('../models/Doctor');

        const profile = await Doctor.findByUserId(req.user.id);
        if (!profile) return res.json({ hasError: false });

        // Check if config exists and is valid
        try {
            await AiConfig.getEffectiveConfig(profile.id);
        } catch (e) {
            if (e.code === 'MISSING_API_KEY') {
                return res.json({ hasError: true, code: 'MISSING_API_KEY', message: "Clé API non configurée." });
            }
        }

        // Check the MOST RECENT case only — if it succeeded, no banner needed
        const [recentCases] = await pool.execute(
            `SELECT c.ai_analysis FROM cases c 
             JOIN patients p ON c.patient_id = p.id 
             WHERE p.doctor_id = ? AND c.ai_analysis IS NOT NULL
             ORDER BY c.created_at DESC LIMIT 1`,
            [profile.id]
        );

        if (recentCases.length > 0) {
            let analysis = recentCases[0].ai_analysis;
            if (typeof analysis === 'string') {
                try { analysis = JSON.parse(analysis); } catch (e) { /* ignore */ }
            }

            if (analysis && (analysis.error_code === 'QUOTA_EXCEEDED' || analysis.error_code === 'API_ERROR')) {
                const msg = analysis.error_code === 'QUOTA_EXCEEDED' ? "Crédit API épuisé ou limite atteinte." : "Clé API invalide.";
                return res.json({ hasError: true, code: analysis.error_code, message: msg });
            }
        }

        res.json({ hasError: false });
    } catch (e) {
        console.error('getAiStatus error:', e);
        res.json({ hasError: false });
    }
}

module.exports = {
    getDashboard,
    getProfile,
    updateProfile,
    getAiConfig,
    updateAiConfig,
    activateAiConfig,
    getAiStatus
};
