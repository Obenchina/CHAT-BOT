const Doctor = require('../models/Doctor');
const Catalogue = require('../models/Catalogue');
const Patient = require('../models/Patient');
const AiConfig = require('../models/AiConfig');
const GrowthCurve = require('../models/GrowthCurve');
const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs');
const referenceCurveLibrary = require('../services/curve/referenceCurveLibrary');
const { identifyCurve } = require('../services/curve/curveIdentificationService');
const { extractCurve } = require('../services/curve/curveExtractionService');
const { validateCurveData } = require('../services/curve/curveValidationService');

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

        const [[caseStats]] = await pool.execute(
            `SELECT
                COUNT(c.id) AS totalCases,
                SUM(CASE WHEN c.status = 'submitted' THEN 1 ELSE 0 END) AS pendingCases,
                SUM(CASE WHEN c.status = 'reviewed' THEN 1 ELSE 0 END) AS reviewedCases,
                SUM(CASE WHEN DATE(c.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayCreatedCases,
                SUM(CASE WHEN c.submitted_at IS NOT NULL AND DATE(c.submitted_at) = CURDATE() THEN 1 ELSE 0 END) AS todaySubmittedCases,
                SUM(CASE WHEN c.reviewed_at IS NOT NULL AND DATE(c.reviewed_at) = CURDATE() THEN 1 ELSE 0 END) AS todayReviewedCases
             FROM cases c
             JOIN patients p ON c.patient_id = p.id
             WHERE p.doctor_id = ?`,
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
        const [[{ todayNewPatients }]] = await pool.execute(
            'SELECT COUNT(*) as todayNewPatients FROM patients WHERE doctor_id = ? AND DATE(created_at) = CURDATE()',
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
                    totalCases: Number(caseStats.totalCases || 0),
                    pendingCases: Number(caseStats.pendingCases || 0),
                    reviewedCases: Number(caseStats.reviewedCases || 0),
                    todayCreatedCases: Number(caseStats.todayCreatedCases || 0),
                    todaySubmittedCases: Number(caseStats.todaySubmittedCases || 0),
                    todayReviewedCases: Number(caseStats.todayReviewedCases || 0),
                    todayNewPatients: Number(todayNewPatients || 0),
                    totalAssistants: Number(totalAssistants || 0),
                    totalPatients: Number(totalPatients || 0)
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
 * Map a doctor's saved growth curve into the API shape consumed by the frontend.
 * The frontend never sees the legacy template_config / plot_area fields.
 */
function mapDoctorCurveForApi(row) {
    let curveData = row.curve_data;
    let label = row.label;
    let source = null;
    if (row.source_type === 'reference' && row.reference_id) {
        const ref = referenceCurveLibrary.getById(row.reference_id);
        if (ref) {
            curveData = ref;
            label = label || ref.label;
            source = ref.source;
        }
    } else if (curveData) {
        source = curveData.source || 'AI-extracted';
        label = label || curveData.label;
    }
    return {
        id: row.id,
        doctor_id: row.doctor_id,
        measure_key: row.measure_key,
        gender: row.gender,
        source_type: row.source_type,
        reference_id: row.reference_id,
        validation_status: row.validation_status,
        original_image_path: row.original_image_path || null,
        label: label || `${row.measure_key} (${row.gender})`,
        source,
        curve_data: curveData,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * Get doctor's growth curves (saved bindings).
 */
async function getGrowthCurves(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const rows = await GrowthCurve.findByDoctorId(doctor.id);
        res.json({ success: true, data: rows.map(mapDoctorCurveForApi) });
    } catch (error) {
        console.error('Get growth curves error:', error);
        res.status(500).json({ success: false, message: 'Failed to get growth curves' });
    }
}

/**
 * List the built-in reference curve library.
 * GET /api/doctor/growth-curves/library
 */
async function getGrowthCurvesLibrary(req, res) {
    try {
        res.json({ success: true, data: referenceCurveLibrary.listIndex() });
    } catch (error) {
        console.error('Get curve library error:', error);
        res.status(500).json({ success: false, message: 'Failed to load library' });
    }
}

/**
 * Add a built-in reference curve to the doctor's bank (no file upload).
 * POST /api/doctor/growth-curves/from-reference  { referenceId }
 */
async function addCurveFromReference(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const referenceId = String(req.body.referenceId || '').trim();
        if (!referenceId) return res.status(400).json({ success: false, message: 'referenceId requis' });
        const ref = referenceCurveLibrary.getById(referenceId);
        if (!ref) return res.status(404).json({ success: false, message: 'Référence inconnue' });
        const existing = await GrowthCurve.existsForReference(doctor.id, referenceId);
        if (existing) return res.status(409).json({ success: false, message: 'Cette courbe est déjà ajoutée' });

        const created = await GrowthCurve.create({
            doctor_id: doctor.id,
            measure_key: ref.measure,
            gender: ref.gender,
            source_type: 'reference',
            reference_id: referenceId,
            curve_data: null,
            validation_status: 'auto_approved',
            original_image_path: null,
            label: ref.label,
        });
        res.status(201).json({ success: true, data: mapDoctorCurveForApi(created) });
    } catch (error) {
        console.error('Add curve from reference error:', error);
        res.status(500).json({ success: false, message: 'Failed to add curve' });
    }
}

/**
 * Save the original uploaded image for audit/comparison and return its public path.
 */
function persistOriginalImage(file) {
    if (!file) return null;
    const stamp = Date.now();
    const safeBase = (file.originalname || 'curve').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const targetDir = path.join(__dirname, '..', '..', 'uploads', 'curves');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const targetName = `${stamp}_${safeBase}`;
    const targetPath = path.join(targetDir, targetName);
    try {
        fs.copyFileSync(file.path, targetPath);
    } catch (e) {
        console.warn('persistOriginalImage failed:', e.message);
        return null;
    }
    return `uploads/curves/${targetName}`;
}

function cleanupTempFiles(req) {
    const files = [];
    if (req.files?.curve?.[0]) files.push(req.files.curve[0]);
    if (req.files?.curveImage?.[0]) files.push(req.files.curveImage[0]);
    for (const f of files) {
        if (f?.path) fs.unlink(f.path, () => {});
    }
}

/**
 * Upload a growth-curve image (or PDF page render). Pipeline:
 *   1. Identify (AI classifies the image: source, measure, gender, age range, composite?).
 *   2. Try to match a reference curve in the data bank.
 *   3. If no match, ask the AI to extract structured percentile data.
 *   4. Validate (math checks).
 *   5. Persist the binding (auto_approved for references, pending_review for AI-extracted).
 */
async function uploadGrowthCurve(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);

        // With multer.fields(), files come as req.files.curve[0] and req.files.curveImage[0]
        const curveFile = req.files?.curve?.[0];
        const curveImageFile = req.files?.curveImage?.[0];
        const imageFile = curveImageFile || curveFile;
        if (!imageFile) {
            cleanupTempFiles(req);
            return res.status(400).json({ success: false, message: 'Fichier requis' });
        }

        const fallbackMeasure = req.body.measureKey ? String(req.body.measureKey) : null;
        const fallbackGender = req.body.gender ? String(req.body.gender) : null;

        let aiConfig = null;
        try {
            aiConfig = await AiConfig.getEffectiveConfig(doctor.id);
        } catch {
            aiConfig = null;
        }
        if (!aiConfig?.apiKey) {
            cleanupTempFiles(req);
            return res.status(400).json({
                success: false,
                message: "Aucune configuration IA active. Configurez-la dans les paramètres avant d'importer une courbe.",
            });
        }

        // Stage 1 — identify the chart
        const classification = await identifyCurve({
            filePath: imageFile.path,
            mimeType: imageFile.mimetype,
            aiConfig,
        });

        // Build a working classification, falling back to the form values if AI failed
        const working = classification || {
            source: 'unknown',
            measure: fallbackMeasure || 'height',
            gender: fallbackGender || 'male',
            ageRange: { min: 0, max: 60, unit: 'months' },
            isComposite: fallbackMeasure === 'height_weight',
            title: '',
            confidence: 0,
            notes: 'AI identification failed; using form fallback.',
        };

        // Stage 2A — try to match a reference curve
        const matchMeasure = working.isComposite ? 'height_weight' : working.measure;
        const reference = referenceCurveLibrary.findMatching({
            measure: matchMeasure,
            gender: working.gender,
            ageRange: working.ageRange,
            source: working.source !== 'unknown' ? working.source : undefined,
        });

        if (reference) {
            const existing = await GrowthCurve.existsForReference(doctor.id, reference.id);
            if (existing) {
                cleanupTempFiles(req);
                return res.status(409).json({
                    success: false,
                    message: `Vous avez déjà la courbe référence « ${reference.label} ».`,
                    data: { matched_reference_id: reference.id },
                });
            }
            const originalImagePath = persistOriginalImage(imageFile);
            const created = await GrowthCurve.create({
                doctor_id: doctor.id,
                measure_key: reference.measure,
                gender: reference.gender,
                source_type: 'reference',
                reference_id: reference.id,
                curve_data: null,
                validation_status: 'auto_approved',
                original_image_path: originalImagePath,
                label: reference.label,
            });
            cleanupTempFiles(req);
            return res.status(201).json({
                success: true,
                message: `Courbe identifiée comme « ${reference.label} ». Données officielles utilisées.`,
                data: {
                    ...mapDoctorCurveForApi(created),
                    classification: working,
                    matched_reference: { id: reference.id, label: reference.label, source: reference.source },
                },
            });
        }

        // Stage 2B — no match: extract percentile data via AI
        const extraction = await extractCurve({
            filePath: imageFile.path,
            mimeType: imageFile.mimetype,
            classification: working,
            originalName: curveFile?.originalname || imageFile.originalname,
            aiConfig,
        });

        if (!extraction.curve) {
            cleanupTempFiles(req);
            return res.status(422).json({
                success: false,
                message: "Impossible d'extraire la courbe depuis l'image. Réessayez avec une image plus nette ou choisissez une courbe officielle.",
                data: { classification: working, error: extraction.error },
            });
        }

        const validation = validateCurveData(extraction.curve);
        // If math checks fail (P3 < P50 < P97 ordering, monotonic median, plausible ranges)
        // mark as rejected — the doctor still sees the entry and the validation report,
        // but the curve is not usable for plotting until they explicitly re-approve.
        const status = validation.ok ? 'pending_review' : 'rejected';

        const originalImagePath = persistOriginalImage(imageFile);
        const created = await GrowthCurve.create({
            doctor_id: doctor.id,
            measure_key: working.isComposite ? 'height_weight' : working.measure,
            gender: working.gender,
            source_type: 'extracted',
            reference_id: null,
            curve_data: extraction.curve,
            validation_status: status,
            original_image_path: originalImagePath,
            label: extraction.curve.label,
        });
        cleanupTempFiles(req);

        return res.status(201).json({
            success: true,
            message: validation.ok
                ? "Courbe extraite. Vérifiez le rendu dans l'aperçu et approuvez-la."
                : "Courbe extraite mais des incohérences ont été détectées. Vérifiez attentivement avant d'approuver.",
            data: {
                ...mapDoctorCurveForApi(created),
                classification: working,
                validation,
            },
        });
    } catch (error) {
        console.error('Upload curve error:', error);
        cleanupTempFiles(req);
        res.status(500).json({ success: false, message: 'Failed to upload' });
    }
}

/**
 * Approve / reject an extracted curve.
 * POST /api/doctor/growth-curves/:id/approve  { decision: 'approved' | 'rejected' }
 */
async function reviewExtractedCurve(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        const { id } = req.params;
        const decision = String(req.body.decision || '').toLowerCase();
        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ success: false, message: 'decision must be "approved" or "rejected"' });
        }
        const curve = await GrowthCurve.findById(id);
        if (!curve || curve.doctor_id !== doctor.id) {
            return res.status(404).json({ success: false, message: 'Curve not found' });
        }
        const status = decision === 'approved' ? 'doctor_approved' : 'rejected';
        await GrowthCurve.updateValidationStatus(id, doctor.id, status);
        const updated = await GrowthCurve.findById(id);
        res.json({ success: true, data: mapDoctorCurveForApi(updated) });
    } catch (error) {
        console.error('Review curve error:', error);
        res.status(500).json({ success: false, message: 'Failed to review' });
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
                // Check if already exists to prevent duplicates
                const [existing] = await pool.execute(
                    `SELECT id FROM doctor_medications 
                     WHERE doctor_id = ? AND name = ? 
                     AND (default_dosage = ? OR (default_dosage IS NULL AND ? IS NULL))
                     AND (default_frequency = ? OR (default_frequency IS NULL AND ? IS NULL))
                     AND (default_duration = ? OR (default_duration IS NULL AND ? IS NULL))
                     LIMIT 1`,
                    [
                        doctor.id,
                        name,
                        defaultDosage || null,
                        defaultDosage || null,
                        defaultFrequency || null,
                        defaultFrequency || null,
                        defaultDuration || null,
                        defaultDuration || null
                    ]
                );

                if (existing.length > 0) {
                    skipped++;
                    // No error needed for deliberate skip
                    continue;
                }

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
    getGrowthCurvesLibrary,
    addCurveFromReference,
    uploadGrowthCurve,
    reviewExtractedCurve,
    deleteGrowthCurve,
    uploadMedicationCSV,
    searchMedications,
    getMedications,
    deleteMedications
};
