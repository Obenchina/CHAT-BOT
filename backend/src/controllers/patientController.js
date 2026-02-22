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
            data: patients.map(p => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                gender: p.gender,
                age: p.age,
                phone: p.phone,
                caseCount: p.case_count,
                createdAt: p.created_at
            }))
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
            data: patients.map(p => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                gender: p.gender,
                age: p.age,
                phone: p.phone
            }))
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
                id: patient.id,
                firstName: patient.first_name,
                lastName: patient.last_name,
                gender: patient.gender,
                age: patient.age,
                phone: patient.phone,
                createdAt: patient.created_at,
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
        let { firstName, lastName, gender, age, phone } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !gender || !age || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
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
            age,
            phone
        });

        res.status(201).json({
            success: true,
            message: 'Patient created successfully',
            data: {
                id: patient.id,
                firstName,
                lastName,
                gender,
                age,
                phone
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
        const { firstName, lastName, gender, age, phone } = req.body;

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

        await Patient.update(id, { firstName, lastName, gender, age, phone });

        res.json({
            success: true,
            message: 'Patient updated successfully'
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
            message: 'Patient deleted successfully'
        });
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete patient'
        });
    }
}

module.exports = {
    getAll,
    search,
    getById,
    create,
    update,
    remove
};
