/**
 * Catalogue Controller
 * Handles catalogue and question management for doctors
 */

const Catalogue = require('../models/Catalogue');
const Doctor = require('../models/Doctor');

/**
 * Get or create catalogue for doctor
 * GET /api/catalogue
 */
async function getCatalogue(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Get latest catalogue for doctor (published or draft)
        const catalogues = await Catalogue.findByDoctorId(doctor.id);

        // Get the latest catalogue (draft first, then published)
        let catalogue = catalogues.find(c => !c.is_published) || catalogues[0] || null;
        let questions = [];

        if (catalogue) {
            const catalogueWithQuestions = await Catalogue.getWithQuestions(catalogue.id);
            if (catalogueWithQuestions && catalogueWithQuestions.questions) {
                questions = catalogueWithQuestions.questions;
            }
        }

        res.json({
            success: true,
            data: {
                catalogue: catalogue ? {
                    id: catalogue.id,
                    version: catalogue.version,
                    is_published: catalogue.is_published
                } : null,
                questions: questions.map(q => ({
                    id: q.id,
                    question_text: q.question_text,
                    answer_type: q.answer_type,
                    choices: q.choices,
                    is_required: q.is_required,
                    is_active: q.is_active,
                    order_index: q.order_index
                }))
            }
        });
    } catch (error) {
        console.error('Get catalogue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get catalogue'
        });
    }
}

/**
 * Create new catalogue version
 * POST /api/catalogue
 */
async function createCatalogue(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const catalogue = await Catalogue.create(doctor.id);

        res.status(201).json({
            success: true,
            message: 'Catalogue created successfully',
            data: {
                id: catalogue.id,
                version: catalogue.version,
                isPublished: false
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
 * Publish catalogue
 * POST /api/catalogue/:id/publish
 */
async function publishCatalogue(req, res) {
    try {
        const { id } = req.params;

        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Verify ownership
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        await Catalogue.publish(id, doctor.id);

        res.json({
            success: true,
            message: 'Catalogue published successfully'
        });
    } catch (error) {
        console.error('Publish catalogue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish catalogue'
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
        const { questionText, answerType, choices, isRequired } = req.body;

        // Validate input
        if (!questionText || !answerType) {
            return res.status(400).json({
                success: false,
                message: 'Question text and answer type are required'
            });
        }

        // Validate answer type
        if (!['yes_no', 'voice', 'choices'].includes(answerType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid answer type'
            });
        }

        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Verify ownership
        const catalogue = await Catalogue.findById(id);
        if (!catalogue || catalogue.doctor_id !== doctor.id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        // Get max order index
        const questions = await Catalogue.getQuestions(id);
        const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.order_index)) : 0;

        const question = await Catalogue.addQuestion({
            catalogueId: id,
            questionText,
            answerType,
            choices: choices || [],
            isRequired: isRequired !== false,
            orderIndex: maxOrder + 1
        });

        res.status(201).json({
            success: true,
            message: 'Question added successfully',
            data: {
                id: question.id,
                question_text: questionText,
                answer_type: answerType,
                choices: choices || [],
                is_required: question.isRequired,
                is_active: true,
                order_index: question.orderIndex
            }
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
        const { questionText, answerType, choices, isRequired, isActive } = req.body;

        await Catalogue.updateQuestion(questionId, {
            questionText,
            answerType,
            choices,
            isRequired,
            isActive
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
        const { order } = req.body; // Array of {id, orderIndex}

        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                message: 'Order must be an array'
            });
        }

        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Verify ownership
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

module.exports = {
    getCatalogue,
    createCatalogue,
    publishCatalogue,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions
};
