/**
 * Catalogue Controller
 * Handles catalogue and question management
 */

const Catalogue = require('../models/Catalogue');
const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');

// Valid answer types and clinical measures
const VALID_ANSWER_TYPES = ['yes_no', 'voice', 'choices', 'text_short', 'text_long', 'number'];
const VALID_CLINICAL_MEASURES = ['none', 'temperature', 'weight', 'height', 'head_circumference', 'blood_pressure'];

async function getDoctorIdFromUser(user) {
    if (user.role === 'doctor') {
        const doctor = await Doctor.findByUserId(user.id);
        return doctor ? doctor.id : null;
    }

    if (user.role === 'assistant') {
        const assistant = await Assistant.findByUserId(user.id);
        return assistant ? assistant.doctor_id : null;
    }

    return null;
}

/**
 * Get all catalogues for doctor
 * GET /api/catalogue
 */
async function getCatalogues(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogues = await Catalogue.findByDoctorId(doctor.id);

        res.json({
            success: true,
            data: {
                catalogues: catalogues.map(catalogue => ({
                    id: catalogue.id,
                    name: catalogue.name,
                    version: catalogue.version,
                    is_active: Boolean(catalogue.is_active),
                    question_count: Number(catalogue.question_count || 0),
                    active_question_count: Number(catalogue.active_question_count || 0),
                    case_count: Number(catalogue.case_count || 0),
                    created_at: catalogue.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Get catalogues error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get catalogues'
        });
    }
}

/**
 * Get catalogue by ID with questions
 * GET /api/catalogue/:id
 */
async function getCatalogueById(req, res) {
    try {
        const { id } = req.params;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        const catalogueWithQuestions = await Catalogue.getWithQuestions(id);
        const sections = await Catalogue.getSections(id);
        const caseCount = await Catalogue.countCasesUsing(id);

        res.json({
            success: true,
            data: {
                catalogue: {
                    id: catalogueWithQuestions.id,
                    name: catalogueWithQuestions.name,
                    version: catalogueWithQuestions.version,
                    is_active: Boolean(catalogueWithQuestions.is_active),
                    case_count: caseCount
                },
                sections,
                questions: (catalogueWithQuestions.questions || []).map(question => ({
                    id: question.id,
                    question_text: question.question_text,
                    answer_type: question.answer_type,
                    clinical_measure: question.clinical_measure || 'none',
                    choices: question.choices,
                    is_required: Boolean(question.is_required),
                    is_active: Boolean(question.is_active),
                    order_index: question.order_index,
                    section_name: question.section_name || null,
                    section_order: question.section_order || 0
                }))
            }
        });
    } catch (error) {
        console.error('Get catalogue by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get catalogue'
        });
    }
}

/**
 * Get active catalogues for assistant selection
 * GET /api/catalogue/active/list
 */
async function getActiveCatalogues(req, res) {
    try {
        const doctorId = await getDoctorIdFromUser(req.user);

        if (!doctorId) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogues = await Catalogue.findActiveByDoctorId(doctorId);

        res.json({
            success: true,
            data: {
                catalogues: catalogues.map(catalogue => ({
                    id: catalogue.id,
                    name: catalogue.name,
                    active_question_count: Number(catalogue.active_question_count || 0)
                }))
            }
        });
    } catch (error) {
        console.error('Get active catalogues error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get active catalogues'
        });
    }
}

/**
 * Create new catalogue
 * POST /api/catalogue
 */
async function createCatalogue(req, res) {
    try {
        const { name, isActive = true } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        if (!String(name || '').trim()) {
            return res.status(400).json({
                success: false,
                message: 'Catalogue name is required'
            });
        }

        const catalogue = await Catalogue.create({
            doctorId: doctor.id,
            name,
            isActive
        });

        res.status(201).json({
            success: true,
            message: 'Catalogue created successfully',
            data: {
                id: catalogue.id,
                name: catalogue.name,
                version: catalogue.version,
                is_active: catalogue.is_active
            }
        });
    } catch (error) {
        console.error('Create catalogue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create catalogue'
        });
    }
}

/**
 * Update catalogue metadata
 * PUT /api/catalogue/:id
 */
async function updateCatalogue(req, res) {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        if (name !== undefined && !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Catalogue name is required'
            });
        }

        await Catalogue.update(id, { name, isActive });
        const updatedCatalogue = await Catalogue.findById(id);

        res.json({
            success: true,
            message: 'Catalogue updated successfully',
            data: {
                id: updatedCatalogue.id,
                name: updatedCatalogue.name,
                version: updatedCatalogue.version,
                is_active: Boolean(updatedCatalogue.is_active)
            }
        });
    } catch (error) {
        console.error('Update catalogue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update catalogue'
        });
    }
}

/**
 * Backward-compatible activation endpoint
 * POST /api/catalogue/:id/publish
 */
async function publishCatalogue(req, res) {
    try {
        req.body.isActive = true;
        return updateCatalogue(req, res);
    } catch (error) {
        console.error('Activate catalogue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate catalogue'
        });
    }
}

/**
 * Delete catalogue
 * DELETE /api/catalogue/:id
 */
async function deleteCatalogue(req, res) {
    try {
        const { id } = req.params;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        const caseCount = await Catalogue.countCasesUsing(id);
        if (caseCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer ce catalogue car il est deja utilise dans des cas existants.'
            });
        }

        await Catalogue.delete(id);

        res.json({
            success: true,
            message: 'Catalogue deleted successfully'
        });
    } catch (error) {
        console.error('Delete catalogue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete catalogue'
        });
    }
}

/**
 * Add question to catalogue
 * POST /api/catalogue/:id/questions
 */
async function addQuestion(req, res) {
    try {
        const { id } = req.params;
        const { questionText, answerType, choices, isRequired, sectionName, sectionOrder, sectionId, clinicalMeasure } = req.body;

        if (!questionText || !answerType) {
            return res.status(400).json({
                success: false,
                message: 'Question text and answer type are required'
            });
        }

        if (!VALID_ANSWER_TYPES.includes(answerType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid answer type. Must be one of: ${VALID_ANSWER_TYPES.join(', ')}`
            });
        }

        // Validate clinical_measure
        if (clinicalMeasure && !VALID_CLINICAL_MEASURES.includes(clinicalMeasure)) {
            return res.status(400).json({
                success: false,
                message: `Invalid clinical measure. Must be one of: ${VALID_CLINICAL_MEASURES.join(', ')}`
            });
        }

        // Clinical measure only makes sense for number type
        if (clinicalMeasure && clinicalMeasure !== 'none' && answerType !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Clinical measure can only be set for number-type questions'
            });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        const questions = await Catalogue.getQuestions(id);
        const maxOrder = questions.length > 0 ? Math.max(...questions.map(question => question.order_index)) : 0;

        let resolvedSectionName = sectionName || null;
        let resolvedSectionOrder = sectionOrder || 0;
        if (sectionId) {
            const sec = await Catalogue.getSectionById(id, Number(sectionId));
            if (!sec) {
                return res.status(400).json({ success: false, message: 'Section introuvable' });
            }
            resolvedSectionName = sec.name;
            resolvedSectionOrder = sec.section_order;
        } else if (resolvedSectionName && String(resolvedSectionName).trim()) {
            const ensured = await Catalogue.ensureSectionByName(id, resolvedSectionName, resolvedSectionOrder);
            resolvedSectionName = ensured.name;
            resolvedSectionOrder = ensured.section_order;
        } else {
            resolvedSectionName = null;
            resolvedSectionOrder = 9999;
        }

        const question = await Catalogue.addQuestion({
            catalogueId: id,
            questionText,
            answerType,
            choices: choices || [],
            isRequired: isRequired !== false,
            orderIndex: maxOrder + 1,
            sectionName: resolvedSectionName,
            sectionOrder: resolvedSectionOrder,
            clinicalMeasure: clinicalMeasure || 'none'
        });

        res.status(201).json({
            success: true,
            message: 'Question added successfully',
            data: question
        });
    } catch (error) {
        console.error('Add question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add question'
        });
    }
}

/**
 * Update question
 * PUT /api/catalogue/questions/:questionId
 */
async function updateQuestion(req, res) {
    try {
        const { questionId } = req.params;
        const { questionText, answerType, choices, isRequired, isActive, sectionName, sectionOrder, sectionId, clinicalMeasure } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Validate answer type if provided
        if (answerType && !VALID_ANSWER_TYPES.includes(answerType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid answer type. Must be one of: ${VALID_ANSWER_TYPES.join(', ')}`
            });
        }

        // Validate clinical measure if provided
        if (clinicalMeasure && !VALID_CLINICAL_MEASURES.includes(clinicalMeasure)) {
            return res.status(400).json({
                success: false,
                message: `Invalid clinical measure. Must be one of: ${VALID_CLINICAL_MEASURES.join(', ')}`
            });
        }

        const question = await Catalogue.getQuestionWithCatalogue(questionId);
        if (!question || question.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        let resolvedSectionName = sectionName;
        let resolvedSectionOrder = sectionOrder;
        if (sectionId !== undefined) {
            if (sectionId === null || sectionId === '' || Number(sectionId) === 0) {
                resolvedSectionName = null;
                resolvedSectionOrder = 9999;
            } else {
                const sec = await Catalogue.getSectionById(question.catalogue_id, Number(sectionId));
                if (!sec) {
                    return res.status(400).json({ success: false, message: 'Section introuvable' });
                }
                resolvedSectionName = sec.name;
                resolvedSectionOrder = sec.section_order;
            }
        } else if (resolvedSectionName !== undefined) {
            if (String(resolvedSectionName || '').trim()) {
                const ensured = await Catalogue.ensureSectionByName(question.catalogue_id, resolvedSectionName, resolvedSectionOrder);
                resolvedSectionName = ensured.name;
                resolvedSectionOrder = ensured.section_order;
            } else {
                resolvedSectionName = null;
                resolvedSectionOrder = 9999;
            }
        }

        await Catalogue.updateQuestion(questionId, {
            questionText,
            answerType,
            choices,
            isRequired,
            isActive,
            sectionName: resolvedSectionName,
            sectionOrder: resolvedSectionOrder,
            clinicalMeasure
        });

        res.json({
            success: true,
            message: 'Question updated successfully'
        });
    } catch (error) {
        console.error('Update question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update question'
        });
    }
}

/**
 * Delete question
 * DELETE /api/catalogue/questions/:questionId
 */
async function deleteQuestion(req, res) {
    try {
        const { questionId } = req.params;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const question = await Catalogue.getQuestionWithCatalogue(questionId);
        if (!question || question.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        await Catalogue.deleteQuestion(questionId);

        res.json({
            success: true,
            message: 'Question deleted successfully'
        });
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete question'
        });
    }
}

/**
 * Reorder questions
 * PUT /api/catalogue/:id/reorder
 */
async function reorderQuestions(req, res) {
    try {
        const { id } = req.params;
        const { order } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                message: 'Order must be an array'
            });
        }

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        await Catalogue.reorderQuestions(id, order);

        res.json({
            success: true,
            message: 'Questions reordered successfully'
        });
    } catch (error) {
        console.error('Reorder questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder questions'
        });
    }
}

/**
 * Sections management
 */
async function getSections(req, res) {
    try {
        const { id } = req.params;
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({ success: false, message: 'Catalogue not found' });
        }
        const sections = await Catalogue.getSections(id);
        res.json({ success: true, data: sections });
    } catch (error) {
        console.error('Get sections error:', error);
        res.status(500).json({ success: false, message: 'Failed to get sections' });
    }
}

async function createSection(req, res) {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({ success: false, message: 'Catalogue not found' });
        }
        const section = await Catalogue.createSection(id, name);
        res.status(201).json({ success: true, data: section });
    } catch (error) {
        console.error('Create section error:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create section' });
    }
}

async function renameSection(req, res) {
    try {
        const { id, sectionId } = req.params;
        const { name } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({ success: false, message: 'Catalogue not found' });
        }
        const ok = await Catalogue.renameSection(id, Number(sectionId), name);
        if (!ok) return res.status(404).json({ success: false, message: 'Section not found' });
        res.json({ success: true, message: 'Section updated' });
    } catch (error) {
        console.error('Rename section error:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to rename section' });
    }
}

async function reorderSections(req, res) {
    try {
        const { id } = req.params;
        const { order } = req.body;
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({ success: false, message: 'Catalogue not found' });
        }
        if (!Array.isArray(order)) {
            return res.status(400).json({ success: false, message: 'Order must be an array' });
        }
        await Catalogue.reorderSections(id, order);
        res.json({ success: true, message: 'Sections reordered' });
    } catch (error) {
        console.error('Reorder sections error:', error);
        res.status(500).json({ success: false, message: 'Failed to reorder sections' });
    }
}

async function deleteSection(req, res) {
    try {
        const { id, sectionId } = req.params;
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({ success: false, message: 'Catalogue not found' });
        }
        const ok = await Catalogue.deleteSection(id, Number(sectionId));
        if (!ok) return res.status(404).json({ success: false, message: 'Section not found' });
        res.json({ success: true, message: 'Section deleted' });
    } catch (error) {
        console.error('Delete section error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete section' });
    }
}

module.exports = {
    getCatalogues,
    getCatalogueById,
    getActiveCatalogues,
    createCatalogue,
    updateCatalogue,
    publishCatalogue,
    deleteCatalogue,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    getSections,
    createSection,
    renameSection,
    reorderSections,
    deleteSection
};
