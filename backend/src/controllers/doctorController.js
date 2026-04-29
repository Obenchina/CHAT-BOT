const Doctor = require('../models/Doctor');
const Catalogue = require('../models/Catalogue');
const Patient = require('../models/Patient');
const AiConfig = require('../models/AiConfig');
const GrowthCurve = require('../models/GrowthCurve');
const { pool } = require('../config/database');
const { getValidatedOfficialTemplates } = require('../config/growthCurveTemplates');
const { buildExtractedCharts, saveExtractedChartImage } = require('../services/growthCurvePdfService');
const { calibrateGrowthChartWithAI } = require('../services/growthCurveAiCalibrationService');

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

        // Stats queries
        const [[{ pendingCases }]] = await pool.execute(
            'SELECT COUNT(c.id) as pendingCases FROM cases c JOIN patients p ON c.patient_id = p.id WHERE p.doctor_id = ? AND c.status = "submitted"', 
            [doctor.id]
        );
        const [[{ reviewedCases }]] = await pool.execute(
            'SELECT COUNT(c.id) as reviewedCases FROM cases c JOIN patients p ON c.patient_id = p.id WHERE p.doctor_id = ? AND c.status = "reviewed"', 
            [doctor.id]
        );
        const [[{ totalAssistants }]] = await pool.execute(
            'SELECT COUNT(*) as totalAssistants FROM assistants WHERE doctor_id = ?', 
            [doctor.id]
        );
        const [[{ totalPatients }]] = await pool.execute(
            'SELECT COUNT(*) as totalPatients FROM patients WHERE doctor_id = ?', 
            [doctor.id]
        );

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
                    pendingCases,
                    reviewedCases,
                    totalAssistants,
                    totalPatients
                }
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
        const config = { ...req.body };
        if (req.file) {
            // Match the property name expected by Doctor.updatePrescriptionConfig
            config.logoPath = `uploads/logos/${req.file.filename}`;
        }

        const updated = await Doctor.updatePrescriptionConfig(req.user.id, config);
        res.json({ success: true, message: 'Configuration updated successfully', data: updated });
    } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update config', 
            error: error.message 
        });
    }
}

/**
 * AI Configuration endpoints
 */
async function getAiConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const configs = await AiConfig.getAllConfigs(doctor.id);
        const configsByProvider = {};
        let activeProvider = 'gemini';

        (configs || []).forEach((cfg) => {
            configsByProvider[cfg.provider] = {
                apiKey: cfg.api_key || '',
                model: cfg.model || '',
                responseLanguage: cfg.response_language || 'ar'
            };
            if (cfg.is_active) {
                activeProvider = cfg.provider;
            }
        });

        res.json({
            success: true,
            data: {
                activeProvider,
                configs: configsByProvider
            }
        });
    } catch (error) {
        console.error('Get AI config error:', error);
        res.status(500).json({ success: false, message: 'Failed to load AI config' });
    }
}

async function updateAiConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const {
            provider,
            api_key,
            apiKey,
            model,
            response_language,
            responseLanguage
        } = req.body;
        
        const config = await AiConfig.upsert(doctor.id, {
            provider,
            apiKey: api_key || apiKey || '',
            model,
            responseLanguage: response_language || responseLanguage || 'ar'
        });

        res.json({
            success: true,
            message: 'AI configuration saved',
            data: {
                provider: config?.provider || provider,
                model: config?.model || model,
                responseLanguage: config?.response_language || response_language || responseLanguage || 'ar'
            }
        });
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
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        // Return as an object with analysesList for frontend compatibility
        res.json({ 
            success: true, 
            data: { 
                analysesList: doctor.analyses_list || '' 
            } 
        });
    } catch (error) {
        console.error('Get analyses config error:', error);
        res.status(500).json({ success: false, message: 'Failed to get analyses config' });
    }
}

async function updateAnalysesConfig(req, res) {
    try {
        const { analysesList } = req.body;
        await Doctor.updateAnalysesConfig(req.user.id, analysesList);
        res.json({ success: true, message: 'Analyses updated' });
    } catch (error) {
        console.error('Update analyses config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update analyses' });
    }
}

/**
 * Letter PDF customization
 */
async function getLetterConfig(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        // Return as an object with letterTemplate for frontend compatibility
        res.json({ 
            success: true, 
            data: { 
                letterTemplate: doctor.letter_template || '' 
            } 
        });
    } catch (error) {
        console.error('Get letter config error:', error);
        res.status(500).json({ success: false, message: 'Failed to get letter config' });
    }
}

async function updateLetterConfig(req, res) {
    try {
        const { letterTemplate } = req.body;
        await Doctor.updateLetterConfig(req.user.id, letterTemplate);
        res.json({ success: true, message: 'Letter template updated' });
    } catch (error) {
        console.error('Update letter config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update letter config' });
    }
}

/**
 * Get doctor's growth curves
 */
async function getGrowthCurves(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const customCurves = await GrowthCurve.findByDoctorId(doctor.id);

        const officialCurves = getValidatedOfficialTemplates().map((tpl) => ({
            id: tpl.id,
            source_type: 'official',
            is_official: true,
            is_custom_upload: false,
            doctor_id: null,
            measure_key: tpl.measure_key,
            template_key: tpl.template_key,
            display_name: tpl.label,
            gender: tpl.gender,
            age_range: tpl.age_range,
            template_config: tpl.template_config,
            is_calibrated: true,
            is_plot_enabled: true,
            file_path: null,
            created_at: null
        }));

        const mappedCustom = (customCurves || []).map((c) => {
            const canPlot = Boolean(c.is_calibrated && c.template_config && c.file_path);
            return {
                ...c,
                source_type: canPlot ? 'custom_calibrated' : 'custom_upload',
                is_official: false,
                is_custom_upload: true,
                display_name: c.template_config?.label || `${c.measure_key} (${c.gender})`,
                is_plot_enabled: canPlot,
                is_calibrated: Boolean(c.is_calibrated)
            };
        });

        res.json({ success: true, data: [...officialCurves, ...mappedCustom] });
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

        const { measureKey, gender } = req.body;
        const isPdf = req.file.mimetype === 'application/pdf' || /\.pdf$/i.test(req.file.originalname);

        if (isPdf) {
            const extractedCharts = buildExtractedCharts(req.file, { measureKey, gender });

            if (extractedCharts.length > 0) {
                const createdCurves = [];
                let activeAiConfig = null;

                try {
                    activeAiConfig = await AiConfig.getEffectiveConfig(doctor.id);
                } catch (error) {
                    activeAiConfig = null;
                }

                for (const chart of extractedCharts) {
                    const aiTemplateConfig = activeAiConfig
                        ? await calibrateGrowthChartWithAI({
                            image: chart.image,
                            originalName: req.file.originalname,
                            fallbackConfig: chart.templateConfig,
                            fallbackMeasureKey: chart.measureKey,
                            fallbackGender: chart.gender || gender || 'both',
                            aiConfig: activeAiConfig
                        })
                        : null;
                    const templateConfig = aiTemplateConfig || chart.templateConfig;
                    const resolvedMeasureKey = templateConfig.measure_key || chart.measureKey;
                    const resolvedGender = templateConfig.gender || chart.gender || gender || 'both';
                    const filePath = saveExtractedChartImage(chart.image);
                    const curve = await GrowthCurve.create({
                        doctor_id: doctor.id,
                        measure_key: resolvedMeasureKey,
                        gender: resolvedGender,
                        file_path: filePath,
                        template_config: templateConfig,
                        is_calibrated: true
                    });

                    createdCurves.push({
                        ...curve,
                        source_type: 'custom_calibrated',
                        is_official: false,
                        is_custom_upload: true,
                        display_name: templateConfig.label,
                        is_plot_enabled: true,
                        is_calibrated: true,
                        calibration_source: aiTemplateConfig ? 'ai' : 'deterministic'
                    });
                }

                require('fs').unlink(req.file.path, () => {});

                return res.status(201).json({
                    success: true,
                    message: `${createdCurves.length} courbe(s) extraite(s) et calibrée(s).`,
                    data: createdCurves
                });
            }
        }

        const curve = await GrowthCurve.create({
            doctor_id: doctor.id,
            measure_key: measureKey,
            gender: gender || 'both',
            file_path: `uploads/curves/${req.file.filename}`,
            // Manual calibration is forbidden in this phase.
            template_config: null,
            is_calibrated: false
        });

        res.status(201).json({
            success: true,
            data: {
                ...curve,
                source_type: 'custom_upload',
                is_official: false,
                is_custom_upload: true,
                display_name: `${curve.measure_key} (${curve.gender})`,
                is_plot_enabled: false,
                is_calibrated: false
            }
        });
    } catch (error) {
        console.error('Upload curve error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload' });
    }
}

/**
 * Update calibration (template_config)
 */
async function calibrateGrowthCurve(req, res) {
    try {
        return res.status(400).json({
            success: false,
            message: 'La calibration manuelle est désactivée. Utilisez les templates officiels pré-calibrés.'
        });
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
        const { parse } = require('csv-parse/sync');
        const { pool } = require('../config/database');

        const fileBuffer = fs.readFileSync(req.file.path);
        // Decode: prefer utf8, fallback to latin1 if it looks badly decoded
        let csvContent = fileBuffer.toString('utf8');
        // Remove UTF-8 BOM if present
        csvContent = csvContent.replace(/^\uFEFF/, '');
        if (!csvContent.includes('\n') && fileBuffer.length > 0) {
            // Try latin1 if file has no line breaks after utf8 decode (rare encoding issues)
            csvContent = fileBuffer.toString('latin1').replace(/^\uFEFF/, '');
        }

        if (!csvContent.trim()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Fichier CSV vide' });
        }

        // Autodetect delimiter from header line: ; , \t
        const firstLine = csvContent.split(/\r?\n/).find(l => l.trim().length > 0) || '';
        const countChar = (s, ch) => (s.match(new RegExp(`\\${ch}`, 'g')) || []).length;
        const comma = countChar(firstLine, ',');
        const semi = countChar(firstLine, ';');
        const tab = (firstLine.match(/\t/g) || []).length;
        const delimiter = tab >= semi && tab >= comma ? '\t' : (semi >= comma ? ';' : ',');

        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            relax_quotes: true,
            bom: true,
            delimiter,
            trim: true
        });

        if (!Array.isArray(records) || records.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Fichier CSV vide ou invalide' });
        }

        const normalizeHeader = (h) =>
            String(h || '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .replace(/\s+/g, ' ');

        // Determine header mapping from actual keys
        const sample = records[0] || {};
        const keys = Object.keys(sample);
        const keyBy = (preds) => {
            const found = keys.find(k => preds.some(p => p(normalizeHeader(k))));
            return found || null;
        };

        const nameKey = keyBy([
            (h) => h === 'name' || h.includes('name'),
            (h) => h === 'nom' || h.includes('nom'),
            (h) => h.includes('medicament') || h.includes('medicament') || h.includes('medic')
        ]);
        const defaultDosageKey = keyBy([
            (h) => h.includes('default dosage') || h === 'dosage' || h.includes('dosage') || h.includes('dose')
        ]);
        const defaultFrequencyKey = keyBy([
            (h) => h.includes('default frequency') || h.includes('frequence') || h.includes('freq') || h.includes('frequency')
        ]);
        const defaultDurationKey = keyBy([
            (h) => h.includes('default duration') || h.includes('duration') || h.includes('duree')
        ]);

        if (!nameKey) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: `Colonne obligatoire introuvable. Attendu: name/nom/médicament. Colonnes détectées: ${keys.join(', ')}`
            });
        }

        let inserted = 0;
        let skipped = 0;
        const errors = [];

        // Append mode: DO NOT delete existing medications.
        for (let i = 0; i < records.length; i++) {
            const row = records[i] || {};
            const line = i + 2; // +1 header, +1 1-indexed

            const rawName = normalizeOptionalText(row[nameKey], 255);
            const name = rawName.trim();
            if (!name) {
                skipped++;
                errors.push({ line, reason: 'name vide' });
                continue;
            }

            // const dosage_form = ... (removed)
            const defaultDosage = defaultDosageKey ? normalizeOptionalText(row[defaultDosageKey], 100) : '';
            const defaultFrequency = defaultFrequencyKey ? normalizeOptionalText(row[defaultFrequencyKey], 100) : '';
            const defaultDuration = defaultDurationKey ? normalizeOptionalText(row[defaultDurationKey], 100) : '';

            try {
                await pool.execute(
                    'INSERT INTO doctor_medications (doctor_id, name, default_dosage, default_frequency, default_duration) VALUES (?, ?, ?, ?, ?)',
                    [
                        doctor.id,
                        name,
                        defaultDosage || null,
                        defaultFrequency || null,
                        defaultDuration || null
                    ]
                );
                inserted++;
            } catch (dbErr) {
                skipped++;
                errors.push({ line, reason: `DB: ${dbErr?.message || 'insert failed'}` });
            }
        }

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            inserted,
            skipped,
            errors
        });
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
