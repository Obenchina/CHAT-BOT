const Doctor = require('../models/Doctor');
const Catalogue = require('../models/Catalogue');
const Patient = require('../models/Patient');
const AiConfig = require('../models/AiConfig');
const GrowthCurve = require('../models/GrowthCurve');

function normalizeOptionalText(value, maxLength) {
    if (value === undefined || value === null) {
        return '';
    }
    const str = String(value).trim();
    return maxLength ? str.substring(0, maxLength) : str;
}

/**
 * Get dashboard stats
 */
async function getDashboard(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        // Stats: total patients, cases today, etc.
        // For now returning basic info
        res.json({
            success: true,
            data: {
                doctorName: doctor.first_name + ' ' + doctor.last_name,
                specialty: doctor.specialty
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
}

/**
 * Get doctor profile
 */
async function getProfile(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        res.json({ success: true, data: doctor });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
}

/**
 * Update doctor profile
 */
async function updateProfile(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const updated = await Doctor.update(doctor.id, req.body);
        res.json({ success: true, message: 'Profile updated successfully', data: updated });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
}

/**
 * Get prescription configuration
 */
async function getPrescriptionConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        res.json({ success: true, data: doctor.prescription_config || {} });
    } catch (error) {
        console.error('Get prescription config error:', error);
        res.status(500).json({ success: false, message: 'Failed to load config' });
    }
}

/**
 * Update prescription configuration (including logo upload)
 */
async function updatePrescriptionConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const config = { ...req.body };
        if (req.file) {
            config.logo_url = `uploads/logos/${req.file.filename}`;
        }

        const updated = await Doctor.updatePrescriptionConfig(doctor.id, config);
        res.json({ success: true, message: 'Configuration updated successfully', data: updated });
    } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update config' });
    }
}

/**
 * AI Configuration endpoints
 */
async function getAiConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const configs = await AiConfig.getAllConfigs(doctor.id);
        res.json({ success: true, data: configs });
    } catch (error) {
        console.error('Get AI config error:', error);
        res.status(500).json({ success: false, message: 'Failed to load AI config' });
    }
}

async function updateAiConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { provider, api_key, model } = req.body;
        
        const config = await AiConfig.upsert(doctor.id, {
            provider,
            apiKey: api_key,
            model
        });

        res.json({ success: true, message: 'AI configuration saved' });
    } catch (error) {
        console.error('Update AI config error:', error);
        res.status(500).json({ success: false, message: 'Failed to save AI config' });
    }
}

async function activateAiConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { provider } = req.body;
        await AiConfig.setActiveProvider(doctor.id, provider);
        res.json({ success: true, message: `${provider} activated` });
    } catch (error) {
        console.error('Activate AI error:', error);
        res.status(500).json({ success: false, message: 'Activation failed' });
    }
}

async function getAiStatus(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const active = await AiConfig.findActiveConfig(doctor.id);
        res.json({ success: true, activeProvider: active ? active.provider : null });
    } catch (error) {
        console.error('Get AI status error:', error);
        res.status(500).json({ success: false, message: 'Failed to get AI status' });
    }
}

/**
 * Analyses PDF customization
 */
async function getAnalysesConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        res.json({ success: true, data: doctor.analyses_config || '' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get analyses config' });
    }
}

async function updateAnalysesConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { analyses } = req.body;
        await Doctor.updateAnalysesConfig(doctor.id, analyses);
        res.json({ success: true, message: 'Analyses updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update analyses' });
    }
}

/**
 * Letter PDF customization
 */
async function getLetterConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        res.json({ success: true, data: doctor.letter_config || '' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get letter config' });
    }
}

async function updateLetterConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { letter } = req.body;
        await Doctor.updateLetterConfig(doctor.id, letter);
        res.json({ success: true, message: 'Letter template updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update letter config' });
    }
}

/**
 * Get doctor's growth curves
 */
async function getGrowthCurves(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const curves = await GrowthCurve.findByDoctorId(doctor.id);
        res.json({ success: true, data: curves });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get growth curves' });
    }
}

/**
 * Upload a growth curve background
 */
async function uploadGrowthCurve(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });

        const { measureKey, gender, p1_x, p1_y, p1_val_x, p1_val_y, p2_x, p2_y, p2_val_x, p2_val_y, is_calibrated } = req.body;

        const curve = await GrowthCurve.create({
            doctor_id: doctor.id,
            measure_key: measureKey,
            gender: gender || 'both',
            file_path: `uploads/curves/${req.file.filename}`,
            p1_x: parseFloat(p1_x) || 0,
            p1_y: parseFloat(p1_y) || 0,
            p1_val_x: parseFloat(p1_val_x) || 0,
            p1_val_y: parseFloat(p1_val_y) || 0,
            p2_x: parseFloat(p2_x) || 0,
            p2_y: parseFloat(p2_y) || 0,
            p2_val_x: parseFloat(p2_val_x) || 60,
            p2_val_y: parseFloat(p2_val_y) || 30,
            is_calibrated: is_calibrated === 'true' || is_calibrated === true
        });

        res.status(201).json({ success: true, data: curve });
    } catch (error) {
        console.error('Upload curve error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload' });
    }
}

/**
 * Update calibration points
 */
async function calibrateGrowthCurve(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const success = await GrowthCurve.updateCalibration(req.params.id, doctor.id, req.body);
        if (!success) return res.status(404).json({ success: false, message: 'Curve not found' });
        res.json({ success: true, message: 'Calibration updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to calibrate' });
    }
}

/**
 * Delete a growth curve
 */
async function deleteGrowthCurve(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const deleted = await GrowthCurve.delete(req.params.id, doctor.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Curve not found' });
        res.json({ success: true, message: 'Curve deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete' });
    }
}

/**
 * Upload medication CSV
 * POST /api/doctor/medications/csv
 */
async function uploadMedicationCSV(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!req.file) return res.status(400).json({ success: false, message: 'Fichier CSV requis' });

        const fs = require('fs');
        const csvContent = fs.readFileSync(req.file.path, 'utf-8');
        const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length < 2) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Fichier CSV vide ou invalide' });
        }

        // Parse header
        const header = lines[0].toLowerCase().split(/[;,\t]/);
        const nameIdx = header.findIndex(h => h.includes('nom') || h.includes('name') || h.includes('médicament') || h.includes('medicament'));
        const dosageFormIdx = header.findIndex(h => h.includes('forme') || h.includes('form'));
        const dosageIdx = header.findIndex(h => h.includes('dosage') || h.includes('dose'));
        const freqIdx = header.findIndex(h => h.includes('fréq') || h.includes('freq') || h.includes('frequency'));
        const notesIdx = header.findIndex(h => h.includes('note') || h.includes('remarque'));

        if (nameIdx === -1) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false, 
                message: 'Colonne "nom" ou "name" introuvable dans le CSV. Colonnes détectées: ' + header.join(', ') 
            });
        }

        // Delete existing medications for this doctor
        const { pool } = require('../config/database');
        await pool.execute('DELETE FROM doctor_medications WHERE doctor_id = ?', [doctor.id]);

        // Parse and insert
        let inserted = 0;
        const separator = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
        
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(separator);
            const name = (cols[nameIdx] || '').trim().replace(/^["']|["']$/g, '');
            if (!name) continue;

            await pool.execute(
                'INSERT INTO doctor_medications (doctor_id, name, dosage_form, default_dosage, default_frequency, notes) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    doctor.id,
                    name,
                    dosageFormIdx >= 0 ? (cols[dosageFormIdx] || '').trim() : null,
                    dosageIdx >= 0 ? (cols[dosageIdx] || '').trim() : null,
                    freqIdx >= 0 ? (cols[freqIdx] || '').trim() : null,
                    notesIdx >= 0 ? (cols[notesIdx] || '').trim() : null
                ]
            );
            inserted++;
        }

        // Cleanup temp file
        fs.unlinkSync(req.file.path);

        res.json({ success: true, message: `${inserted} médicaments importés`, count: inserted });
    } catch (error) {
        console.error('Upload CSV error:', error);
        res.status(500).json({ success: false, message: 'Échec de l\'importation CSV' });
    }
}

/**
 * Search medications
 * GET /api/doctor/medications/search?q=...
 */
async function searchMedications(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { q } = req.query;
        if (!q || q.length < 2) return res.json({ success: true, data: [] });

        const { pool } = require('../config/database');
        const [rows] = await pool.execute(
            'SELECT * FROM doctor_medications WHERE doctor_id = ? AND name LIKE ? LIMIT 20',
            [doctor.id, `%${q}%`]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur de recherche' });
    }
}

/**
 * Get all medications (paginated)
 * GET /api/doctor/medications
 */
async function getMedications(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { pool } = require('../config/database');
        const [rows] = await pool.execute(
            'SELECT * FROM doctor_medications WHERE doctor_id = ? ORDER BY name LIMIT 500',
            [doctor.id]
        );
        res.json({ success: true, data: rows, count: rows.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur' });
    }
}

/**
 * Delete all medications
 * DELETE /api/doctor/medications
 */
async function deleteMedications(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { pool } = require('../config/database');
        await pool.execute('DELETE FROM doctor_medications WHERE doctor_id = ?', [doctor.id]);
        res.json({ success: true, message: 'Tous les médicaments supprimés' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Échec de la suppression' });
    }
}

module.exports = {
    getDashboard,
    getProfile,
    updateProfile,
    getPrescriptionConfig,
    updatePrescriptionConfig,
    getAiConfig,
    updateAiConfig,
    activateAiConfig,
    getAiStatus,
    getAnalysesConfig,
    updateAnalysesConfig,
    getLetterConfig,
    updateLetterConfig,
    getGrowthCurves,
    uploadGrowthCurve,
    calibrateGrowthCurve,
    deleteGrowthCurve,
    uploadMedicationCSV,
    searchMedications,
    getMedications,
    deleteMedications
};
