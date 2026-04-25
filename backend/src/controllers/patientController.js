/**
 * Patient Controller
 * Handles patient CRUD operations
 */

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');

/**
 * Get doctor ID from user (works for both doctor and assistant)
 * @param {Object} user - Authenticated user
 * @returns {Promise<number|null>} Doctor ID
 */
async function getDoctorIdFromUser(user) {
    if (user.role === 'doctor') {
        const doctor = await Doctor.findByUserId(user.id);
        return doctor ? doctor.id : null;
    } else if (user.role === 'assistant') {
        const assistant = await Assistant.findByUserId(user.id);
        return assistant ? assistant.doctor_id : null;
    }
    return null;
}

/**
 * Validate date_of_birth
 * @param {string} dateStr - ISO date string
 * @returns {{ valid: boolean, error?: string, date?: Date }}
 */
function validateDateOfBirth(dateStr) {
    if (!dateStr) {
        return { valid: false, error: 'La date de naissance est requise.' };
    }

    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Format de date de naissance invalide.' };
    }

    if (date > new Date()) {
        return { valid: false, error: 'La date de naissance ne peut pas être dans le futur.' };
    }

    // Sanity check: not more than 150 years old
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 150);
    if (date < minDate) {
        return { valid: false, error: 'La date de naissance est trop ancienne.' };
    }

    return { valid: true, date };
}

/**
 * Format patient data for API response
 */
function formatPatient(p) {
    return {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        gender: p.gender,
        dateOfBirth: p.date_of_birth,
        age: p.age,
        phone: p.phone,
        address: p.address || '',
        siblingsAlive: p.siblings_alive || 0,
        siblingsDeceased: p.siblings_deceased || 0,
        caseCount: p.case_count,
        createdAt: p.created_at
    };
}

/**
 * Get all patients
 * GET /api/patients
 */
async function getAll(req, res) {
    try {
        const doctorId = await getDoctorIdFromUser(req.user);

        if (!doctorId) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const patients = await Patient.findByDoctorId(doctorId);

        res.json({
            success: true,
            data: patients.map(formatPatient)
        });
    } catch (error) {
        console.error('Get patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get patients'
        });
    }
}

/**
 * Search patients
 * GET /api/patients/search?q=query
 */
async function search(req, res) {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const doctorId = await getDoctorIdFromUser(req.user);

        if (!doctorId) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Search for patients
        const patients = await Patient.search(doctorId, q);

        res.json({
            success: true,
            data: patients.map(formatPatient)
        });
    } catch (error) {
        console.error('Search patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search patients'
        });
    }
}

/**
 * Get patient by ID
 * GET /api/patients/:id
 */
async function getById(req, res) {
    try {
        const { id } = req.params;

        const patient = await Patient.getWithCases(id);

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        // Verify ownership
        const doctorId = await getDoctorIdFromUser(req.user);
        if (patient.doctor_id !== doctorId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: {
                ...formatPatient(patient),
                cases: patient.cases.map(c => ({
                    id: c.id,
                    status: c.status,
                    createdAt: c.created_at,
                    submittedAt: c.submitted_at,
                    reviewedAt: c.reviewed_at
                }))
            }
        });
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get patient'
        });
    }
}

/**
 * Create new patient
 * POST /api/patients
 */
async function create(req, res) {
    try {
        let {
            firstName, lastName, gender, dateOfBirth,
            phone, address, siblingsAlive, siblingsDeceased
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !gender || !dateOfBirth || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants (prénom, nom, sexe, date de naissance, téléphone).'
            });
        }

        // Validate date_of_birth
        const dobValidation = validateDateOfBirth(dateOfBirth);
        if (!dobValidation.valid) {
            return res.status(400).json({
                success: false,
                message: dobValidation.error
            });
        }

        // Validate siblings
        if (siblingsAlive !== undefined && (isNaN(siblingsAlive) || Number(siblingsAlive) < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Le nombre de frères/sœurs vivants doit être un nombre positif.'
            });
        }
        if (siblingsDeceased !== undefined && (isNaN(siblingsDeceased) || Number(siblingsDeceased) < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Le nombre de frères/sœurs décédés doit être un nombre positif.'
            });
        }

        const doctorId = await getDoctorIdFromUser(req.user);

        if (!doctorId) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Normalize names to uppercase
        firstName = firstName.toUpperCase().trim();
        lastName = lastName.toUpperCase().trim();

        // Check for duplicate patient
        const isDuplicate = await Patient.checkDuplicate(doctorId, firstName, lastName);

        if (isDuplicate) {
            return res.status(409).json({
                success: false,
                message: `Le patient ${firstName} ${lastName} existe déjà.`
            });
        }

        const patient = await Patient.create({
            doctorId,
            firstName,
            lastName,
            gender,
            dateOfBirth,
            phone,
            address: address || null,
            siblingsAlive: Number(siblingsAlive) || 0,
            siblingsDeceased: Number(siblingsDeceased) || 0
        });

        res.status(201).json({
            success: true,
            message: 'Patient créé avec succès.',
            data: {
                id: patient.id,
                firstName,
                lastName,
                gender,
                dateOfBirth,
                phone,
                address: address || '',
                siblingsAlive: Number(siblingsAlive) || 0,
                siblingsDeceased: Number(siblingsDeceased) || 0
            }
        });
    } catch (error) {
        console.error('Create patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create patient'
        });
    }
}

/**
 * Update patient
 * PUT /api/patients/:id
 */
async function update(req, res) {
    try {
        const { id } = req.params;
        const {
            firstName, lastName, gender, dateOfBirth,
            phone, address, siblingsAlive, siblingsDeceased
        } = req.body;

        // Verify ownership
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        const doctorId = await getDoctorIdFromUser(req.user);
        if (patient.doctor_id !== doctorId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Validate date_of_birth if provided
        if (dateOfBirth !== undefined) {
            const dobValidation = validateDateOfBirth(dateOfBirth);
            if (!dobValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: dobValidation.error
                });
            }
        }

        // Validate siblings if provided
        if (siblingsAlive !== undefined && (isNaN(siblingsAlive) || Number(siblingsAlive) < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Le nombre de frères/sœurs vivants doit être un nombre positif.'
            });
        }
        if (siblingsDeceased !== undefined && (isNaN(siblingsDeceased) || Number(siblingsDeceased) < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Le nombre de frères/sœurs décédés doit être un nombre positif.'
            });
        }

        await Patient.update(id, {
            firstName: firstName ? firstName.toUpperCase().trim() : undefined,
            lastName: lastName ? lastName.toUpperCase().trim() : undefined,
            gender,
            dateOfBirth,
            phone,
            address,
            siblingsAlive: siblingsAlive !== undefined ? Number(siblingsAlive) : undefined,
            siblingsDeceased: siblingsDeceased !== undefined ? Number(siblingsDeceased) : undefined
        });

        res.json({
            success: true,
            message: 'Patient mis à jour avec succès.'
        });
    } catch (error) {
        console.error('Update patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update patient'
        });
    }
}

/**
 * Delete patient
 * DELETE /api/patients/:id
 */
async function remove(req, res) {
    try {
        const { id } = req.params;

        // Verify ownership
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        const doctorId = await getDoctorIdFromUser(req.user);
        if (patient.doctor_id !== doctorId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await Patient.delete(id);

        res.json({
            success: true,
            message: 'Patient supprimé avec succès.'
        });
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete patient'
        });
    }
}

/**
 * Get longitudinal measurements
 * GET /api/patients/:id/measurements
 */
async function getMeasurements(req, res) {
    try {
        const { id } = req.params;

        // Verify ownership
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const doctorId = await getDoctorIdFromUser(req.user);
        if (patient.doctor_id !== doctorId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const rawMeasurements = await Patient.getMeasurements(id);

        // Group by clinical_measure
        const grouped = rawMeasurements.reduce((acc, curr) => {
            const measure = curr.clinical_measure;
            if (!acc[measure]) acc[measure] = [];
            // Assuming value is a string from text_answer, we parse it
            const val = parseFloat(curr.value);
            if (!isNaN(val)) {
                acc[measure].push({
                    caseId: curr.case_id,
                    date: curr.date,
                    value: val
                });
            }
            return acc;
        }, {});

        res.json({
            success: true,
            data: grouped
        });
    } catch (error) {
        console.error('Get patient measurements error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get patient measurements'
        });
    }
}

module.exports = {
    getAll,
    search,
    getById,
    create,
    update,
    remove,
    getMeasurements
};
