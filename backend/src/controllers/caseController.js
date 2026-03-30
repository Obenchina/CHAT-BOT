/**
 * Case Controller
 * Handles medical case workflow operations
 */

const Case = require('../models/Case');
const Document = require('../models/Document');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Assistant = require('../models/Assistant');
const Catalogue = require('../models/Catalogue');
const AuditLog = require('../models/AuditLog');
const AiConfig = require('../models/AiConfig');
const aiService = require('../services/aiService');
const pdfService = require('../services/pdfService');

/**
 * Get doctor ID from user (works for both doctor and assistant)
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
 * Get cases inbox (for doctor)
 * GET /api/cases
 */
async function getAll(req, res) {
    try {
        const { status } = req.query;

        const doctor = await Doctor.findByUserId(req.user.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const cases = await Case.findByDoctorId(doctor.id, status);

        res.json({
            success: true,
            data: cases.map(c => ({
                id: c.id,
                patient_first_name: c.patient_first_name,
                patient_last_name: c.patient_last_name,
                patientName: `${c.patient_first_name} ${c.patient_last_name}`,
                assistantName: `${c.assistant_first_name} ${c.assistant_last_name}`,
                status: c.status,
                createdAt: c.created_at,
                created_at: c.created_at,
                submittedAt: c.submitted_at,
                reviewedAt: c.reviewed_at
            }))
        });
    } catch (error) {
        console.error('Get cases error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get cases'
        });
    }
}

/**
 * Get case by ID
 * GET /api/cases/:id
 */
async function getById(req, res) {
    try {
        const { id } = req.params;
        console.log('GetById request for case:', id, 'by user:', req.user?.id, 'role:', req.user?.role);

        const caseData = await Case.getFullDetails(id);
        console.log('Case data retrieved:', caseData ? `Found (status: ${caseData.status})` : 'Not found');

        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }

        // Get patient data safely
        const patient = caseData.patient || {};
        console.log('Patient doctor_id:', patient.doctor_id);

        // Verify access
        const doctorId = await getDoctorIdFromUser(req.user);
        console.log('User doctorId:', doctorId);

        // Allow access if:
        // 1. User is the doctor who owns the patient
        // 2. User is an assistant of that doctor
        // 3. No doctor_id on patient (legacy data)
        if (patient.doctor_id && doctorId && patient.doctor_id !== doctorId) {
            console.log('Access denied: patient.doctor_id', patient.doctor_id, '!== doctorId', doctorId);
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: {
                id: caseData.id,
                status: caseData.status,
                patient: {
                    id: patient.id || null,
                    firstName: patient.first_name || '',
                    lastName: patient.last_name || '',
                    first_name: patient.first_name || '',
                    last_name: patient.last_name || '',
                    gender: patient.gender || '',
                    age: patient.age || 0,
                    phone: patient.phone || ''
                },
                answers: (caseData.answers || []).map(a => ({
                    id: a.id,
                    questionId: a.question_id,
                    question_id: a.question_id,
                    questionText: a.question_text,
                    question_text: a.question_text,
                    answerType: a.answer_type,
                    answer_type: a.answer_type,
                    audioPath: a.audio_path,
                    audio_path: a.audio_path,
                    transcribedText: a.transcribed_text,
                    transcribed_text: a.transcribed_text
                })),
                documents: (caseData.documents || []).map(d => ({
                    id: d.id,
                    type: d.document_type,
                    fileName: d.file_name,
                    filePath: d.file_path,
                    uploadedAt: d.uploaded_at
                })),
                aiAnalysis: caseData.aiAnalysis,
                doctorDiagnosis: caseData.doctor_diagnosis,
                doctorPrescription: caseData.doctor_prescription,
                createdAt: caseData.created_at,
                submittedAt: caseData.submitted_at,
                reviewedAt: caseData.reviewed_at
            }
        });
    } catch (error) {
        console.error('Get case error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to get case',
            error: error.message
        });
    }
}

/**
 * Create new case
 * POST /api/cases
 */
async function create(req, res) {
    try {
        const { patientId } = req.body;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                message: 'Patient ID is required'
            });
        }

        // Get assistant
        const assistant = await Assistant.findByUserId(req.user.id);

        if (!assistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant not found'
            });
        }

        // Verify patient belongs to assistant's doctor
        const patient = await Patient.findById(patientId);
        if (!patient || patient.doctor_id !== assistant.doctor_id) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        // Get active catalogue
        const catalogue = await Catalogue.getActive(assistant.doctor_id);
        if (!catalogue) {
            return res.status(400).json({
                success: false,
                message: 'No active catalogue found'
            });
        }

        // Check for existing in_progress case for this patient
        const existingCases = await Case.findByPatientId(patientId); // Returns array ordered by created_at DESC

        // Find the most recent case with status 'in_progress'
        // This prevents creating a new case if there is an orphan "En cours" case even if there are newer "Submitted" cases
        const latestCase = existingCases.find(c => c.status === 'in_progress');

        // Check if we have an active case that is still in progress
        if (latestCase) {
            console.log(`Found existing in_progress case ${latestCase.id} for patient ${patientId}, reusing it.`);

            // Get questions for this case's catalogue version
            const questions = await Catalogue.getQuestions(latestCase.catalogue_version_id);

            return res.status(200).json({
                success: true,
                message: 'Resuming existing active case',
                data: {
                    id: latestCase.id,
                    patientId,
                    status: 'in_progress',
                    isResumed: true,
                    questions: questions.filter(q => q.is_active).map(q => ({
                        id: q.id,
                        questionText: q.question_text,
                        answerType: q.answer_type,
                        choices: q.choices,
                        isRequired: q.is_required,
                        orderIndex: q.order_index
                    }))
                }
            });
        }

        // Create case
        const newCase = await Case.create({
            patientId,
            assistantId: assistant.id,
            catalogueVersionId: catalogue.id
        });

        // Log creation
        await AuditLog.logCaseCreated(req.user.id, newCase.id, { patientId });

        // Get catalogue questions
        const questions = await Catalogue.getQuestions(catalogue.id);

        res.status(201).json({
            success: true,
            message: 'Case created successfully',
            data: {
                id: newCase.id,
                patientId,
                status: 'in_progress',
                questions: questions.filter(q => q.is_active).map(q => ({
                    id: q.id,
                    questionText: q.question_text,
                    answerType: q.answer_type,
                    choices: q.choices,
                    isRequired: q.is_required,
                    orderIndex: q.order_index
                }))
            }
        });
    } catch (error) {
        console.error('Create case error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create case'
        });
    }
}

/**
 * Add answer to case
 * POST /api/cases/:id/answers
 */
async function addAnswer(req, res) {
    try {
        const { id } = req.params;
        let { questionId, transcribedText } = req.body;

        console.log('addAnswer called:', { caseId: id, questionId, hasFile: !!req.file });

        // Validate questionId
        if (!questionId) {
            return res.status(400).json({
                success: false,
                message: 'Question ID is required'
            });
        }

        // Get audio path from uploaded file
        const audioPath = req.file ? `audio/${req.file.filename}` : null;

        // If audio was uploaded and no transcription provided, transcribe it
        if (audioPath && !transcribedText) {
            console.log('Transcribing audio for question:', questionId);
            try {
                // Look up doctor AI config for transcription
                const assistant = await Assistant.findByUserId(req.user.id);
                let aiCfg = null;
                if (assistant) {
                    aiCfg = await AiConfig.getEffectiveConfig(assistant.doctor_id);
                }
                transcribedText = await aiService.transcribeAudio(audioPath, aiCfg);
                console.log('Transcription result:', transcribedText ? transcribedText.substring(0, 50) + '...' : 'null');
            } catch (err) {
                console.error('Audio transcription error:', err);
                if (err.code === 'MISSING_API_KEY' || err.code === 'QUOTA_EXCEEDED' || err.code === 'API_ERROR') {
                    return res.status(400).json({
                        success: false,
                        code: err.code,
                        message: err.message
                    });
                }
                // Fallback for other unexpected errors during transcription
                return res.status(500).json({
                    success: false,
                    message: 'Échec de la transcription audio: ' + err.message
                });
            }
        }

        // Check if answer already exists to prevent duplicates (Upsert logic)
        const currentAnswers = await Case.getAnswers(parseInt(id));
        const existingAnswer = currentAnswers.find(a => a.question_id === parseInt(questionId));

        let answer;
        if (existingAnswer) {
            console.log(`Updating existing answer ${existingAnswer.id} for question ${questionId}`);
            await Case.updateAnswer(existingAnswer.id, {
                audioPath,
                transcribedText: transcribedText || null
            });
            answer = { ...existingAnswer, audioPath, transcribedText };
        } else {
            answer = await Case.addAnswer({
                caseId: parseInt(id),
                questionId: parseInt(questionId),
                audioPath,
                transcribedText: transcribedText || null
            });
        }

        console.log('Answer saved/updated:', answer);

        res.status(200).json({
            success: true,
            message: 'Answer saved successfully',
            data: {
                id: answer.id,
                questionId: parseInt(questionId),
                audioPath,
                transcribedText
            }
        });
    } catch (error) {
        console.error('Add answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add answer',
            error: error.message
        });
    }
}

/**
 * Upload document to case
 * POST /api/cases/:id/documents
 */
async function uploadDocument(req, res) {
    try {
        const { id } = req.params;
        const { documentType } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Any document type is accepted now

        const document = await Document.create({
            caseId: id,
            documentType,
            filePath: `documents/${req.file.filename}`,
            fileName: req.file.originalname
        });

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                id: document.id,
                type: documentType,
                fileName: req.file.originalname
            }
        });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document'
        });
    }
}

/**
 * Delete document from case
 * DELETE /api/cases/:id/documents/:docId
 */
async function deleteDocument(req, res) {
    try {
        const { docId } = req.params;

        await Document.delete(docId);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document'
        });
    }
}

/**
 * Submit case for AI analysis and doctor review
 * POST /api/cases/:id/submit
 */
async function submit(req, res) {
    try {
        const { id } = req.params;
        console.log('Submit case request:', id);

        // Get full case details
        let caseData = await Case.getFullDetails(id);
        console.log('Case data found:', caseData ? 'yes' : 'no');

        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }

        if (caseData.status !== 'in_progress') {
            return res.status(400).json({
                success: false,
                message: 'Case already submitted'
            });
        }

        // ========================================
        // STEP 1: Transcribe all audio answers
        // ========================================
        // ========================================
        // STEP 1: Validate Transcriptions (Strict Local Mode)
        // ========================================
        console.log('Step 1: Validating audio transcriptions...');
        const answers = caseData.answers || [];
        let transcriptionCount = 0;
        let missingTranscriptions = [];

        for (const answer of answers) {
            // If answer is text-only (no audio), it's fine
            if (!answer.audio_path) {
                continue;
            }

            // Check if transcription exists
            if (!answer.transcribed_text) {
                console.log(`Missing transcription for answer ${answer.id}, attempting local transcription...`);

                try {
                    // Attempt local transcription as last resort (should have happened at upload)
                    const transcribedText = await aiService.transcribeAudio(answer.audio_path);

                    if (transcribedText) {
                        await Case.updateAnswer(answer.id, { transcribedText });
                        transcriptionCount++;
                        console.log(`Recovered transcription for answer ${answer.id}`);
                        // Update local object to reflect change for analysis step
                        answer.transcribed_text = transcribedText;
                    } else {
                        console.error(`Failed to transcribe answer ${answer.id} locally.`);
                        missingTranscriptions.push(answer.question_text);
                    }
                } catch (err) {
                    console.error(`Error transcribing answer ${answer.id}:`, err);
                    missingTranscriptions.push(answer.question_text);
                }
            }
        }

        // BLOCKING: If any audio answer lacks text, ABORT submission
        if (missingTranscriptions.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Transcription failed for some answers. Please re-record or check audio.',
                details: missingTranscriptions
            });
        }

        console.log(`Validation complete. ${transcriptionCount} missing transcriptions recovered.`);

        // ========================================
        // STEP 2: Reload case data with transcriptions
        // ========================================
        caseData = await Case.getFullDetails(id);

        // ========================================
        // STEP 3: Submit case (update status)
        // ========================================
        await Case.submit(id);
        console.log('Case status updated to submitted');

        // Log submission (non-blocking)
        try {
            await AuditLog.logCaseSubmitted(req.user.id, id);
        } catch (logError) {
            console.error('Audit log error (non-blocking):', logError.message);
        }

        // ========================================
        // STEP 4: AI Analysis with transcriptions
        // ========================================
        console.log('Step 4: Running AI analysis...');
        try {
            // Look up doctor's AI config
            const patient = await Patient.findById(caseData.patient_id || caseData.patient?.id);
            const doctorId = patient ? patient.doctor_id : null;
            let aiCfg = null;
            if (doctorId) {
                aiCfg = await AiConfig.getEffectiveConfig(doctorId);
            }
            const analysis = await aiService.analyzeCase(caseData, aiCfg);
            if (analysis) {
                await Case.saveAiAnalysis(id, analysis);
                console.log('AI analysis saved successfully');

                try {
                    await AuditLog.logAiAnalysis(id);
                } catch (logError) {
                    console.error('AI audit log error (non-blocking):', logError.message);
                }
            }
        } catch (aiError) {
            console.error('AI analysis error during submit:', aiError);
            if (aiError.code === 'MISSING_API_KEY' || aiError.code === 'QUOTA_EXCEEDED' || aiError.code === 'API_ERROR') {
                
                // Save the error so the doctor can see it permanently attached to the case!
                await Case.saveAiAnalysis(id, {
                    summary: "L'analyse IA n'a pas pu être générée.",
                    error_code: aiError.code,
                    error_message: aiError.message
                });

                return res.status(400).json({
                    success: false,
                    code: aiError.code,
                    message: aiError.message
                });
            }
            // Continue without AI analysis for generic/parsing errors
        }

        res.json({
            success: true,
            message: 'Case submitted successfully',
            transcriptionCount
        });
    } catch (error) {
        console.error('Submit case error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit case',
            error: error.message
        });
    }
}

/**
 * Add text answer to case (for yes/no and choices)
 * POST /api/cases/:id/answers/text
 */
async function addTextAnswer(req, res) {
    try {
        const { id } = req.params;
        const { questionId, answer } = req.body;

        if (!questionId || !answer) {
            return res.status(400).json({
                success: false,
                message: 'Question ID and answer are required'
            });
        }

        // Check if answer already exists
        const currentAnswers = await Case.getAnswers(parseInt(id));
        const existingAnswer = currentAnswers.find(a => a.question_id === parseInt(questionId));

        let savedAnswer;
        if (existingAnswer) {
            await Case.updateAnswer(existingAnswer.id, {
                audioPath: null,
                transcribedText: answer
            });
            savedAnswer = { ...existingAnswer, transcribed_text: answer };
        } else {
            savedAnswer = await Case.addAnswer({
                caseId: id,
                questionId,
                audioPath: null,
                transcribedText: answer
            });
        }

        res.status(200).json({
            success: true,
            message: 'Answer saved successfully',
            data: {
                id: savedAnswer.id,
                questionId,
                answer
            }
        });
    } catch (error) {
        console.error('Add text answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add answer'
        });
    }
}

/**
 * Save doctor review
 * PUT /api/cases/:id/review
 */
async function saveReview(req, res) {
    try {
        const { id } = req.params;
        const { diagnosis, prescription } = req.body;

        if (!diagnosis) {
            return res.status(400).json({
                success: false,
                message: 'Diagnosis is required'
            });
        }

        // Get case
        const caseData = await Case.findById(id);
        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }

        // Update case with review
        await Case.updateReview(id, {
            doctorDiagnosis: diagnosis,
            doctorPrescription: prescription,
            status: 'reviewed',
            reviewedAt: new Date()
        });

        res.json({
            success: true,
            message: 'Review saved successfully'
        });
    } catch (error) {
        console.error('Save review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save review'
        });
    }
}

/**
 * Close case
 * POST /api/cases/:id/close
 */
async function closeCase(req, res) {
    try {
        const { id } = req.params;

        const caseData = await Case.findById(id);
        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }

        await Case.updateStatus(id, 'closed');

        res.json({
            success: true,
            message: 'Case closed successfully'
        });
    } catch (error) {
        console.error('Close case error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to close case'
        });
    }
}

/**
 * Delete case
 * DELETE /api/cases/:id
 */
async function deleteCase(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;

        const caseData = await Case.findById(id);
        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }

        // Permission check with ownership verification
        if (user.role === 'assistant') {
            // Assistant can only delete their own in-progress cases
            const Assistant = require('../models/Assistant');
            const assistant = await Assistant.findByUserId(user.id);
            if (!assistant || caseData.assistant_id !== assistant.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès non autorisé à cette consultation'
                });
            }
            if (caseData.status !== 'in_progress') {
                return res.status(403).json({
                    success: false,
                    message: 'Assistants can only delete in-progress cases'
                });
            }
        } else if (user.role === 'doctor') {
            // Doctor can only delete cases of their own patients
            const Doctor = require('../models/Doctor');
            const Patient = require('../models/Patient');
            const doctor = await Doctor.findByUserId(user.id);
            if (!doctor) {
                return res.status(403).json({ success: false, message: 'Doctor not found' });
            }
            const patient = await Patient.findById(caseData.patient_id);
            if (!patient || patient.doctor_id !== doctor.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès non autorisé à cette consultation'
                });
            }
        }

        await Case.delete(id);

        res.json({
            success: true,
            message: 'Case deleted successfully'
        });
    } catch (error) {
        console.error('Delete case error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete case'
        });
    }
}

/**
 * Generate prescription PDF
 * GET /api/cases/:id/prescription/pdf
 */
async function generatePrescriptionPdf(req, res) {
    try {
        const { id } = req.params;

        // Get full case details
        const caseData = await Case.getFullDetails(id);
        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }

        // Verify case is reviewed
        if (caseData.status !== 'reviewed' && caseData.status !== 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Case must be reviewed before generating prescription'
            });
        }

        // Get doctor info
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Generate PDF
        // Map data to expected format (Database uses snake_case, PDF service expects camelCase)
        const pdfData = {
            patient: {
                firstName: caseData.patient.first_name || '',
                lastName: caseData.patient.last_name || '',
                age: caseData.patient.age || 0,
                gender: caseData.patient.gender || 'unknown'
            },
            doctor: {
                firstName: doctor.first_name || '',
                lastName: doctor.last_name || '',
                specialty: doctor.specialty || 'Médecin Généraliste',
                phone: doctor.phone || '',
                email: doctor.email || '',
                address: doctor.address || ''
            },
            diagnosis: caseData.doctor_diagnosis,
            prescription: typeof caseData.doctor_prescription === 'string'
                ? JSON.parse(caseData.doctor_prescription)
                : caseData.doctor_prescription,
            date: caseData.reviewed_at || new Date()
        };

        const pdfPath = await pdfService.generatePrescription(pdfData);

        // Send PDF file
        res.download(pdfPath, `ordonnance_${id}.pdf`, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up temp file
            require('fs').unlink(pdfPath, () => { });
        });
    } catch (error) {
        console.error('Generate prescription PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate prescription PDF'
        });
    }
}

/**
 * Retranscribe all audio answers in a case
 * POST /api/cases/:id/retranscribe
 */
async function retranscribeCase(req, res) {
    try {
        const { id } = req.params;
        console.log('Retranscribing case:', id);

        // Get case data
        const caseData = await Case.getFullDetails(id);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        const answers = caseData.answers || [];
        let transcribedCount = 0;

        for (const answer of answers) {
            // Skip if no audio or already has transcription
            if (!answer.audio_path || answer.transcribed_text) {
                console.log(`Skipping answer ${answer.id}: no audio or already transcribed`);
                continue;
            }

            console.log(`Transcribing answer ${answer.id}: ${answer.audio_path}`);
            const transcribedText = await aiService.transcribeAudio(answer.audio_path);

            if (transcribedText) {
                // Update answer with transcription
                await Case.updateAnswer(answer.id, { transcribedText });
                transcribedCount++;
                console.log(`Successfully transcribed answer ${answer.id}`);
            }
        }

        res.json({
            success: true,
            message: `Retranscribed ${transcribedCount} answers`,
            transcribedCount
        });
    } catch (error) {
        console.error('Retranscribe error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retranscribe case',
            error: error.message
        });
    }
}

/**
 * Reanalyze case with AI
 * POST /api/cases/:id/reanalyze
 */
async function reanalyzeCase(req, res) {
    try {
        const { id } = req.params;
        console.log('Reanalyzing case:', id);

        // Get case data with transcriptions
        const caseData = await Case.getFullDetails(id);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        // Check if any answers have transcriptions
        const answersWithText = (caseData.answers || []).filter(a => a.transcribed_text);
        if (answersWithText.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune réponse transcrite. Veuillez d\'abord transcrire les réponses audio.'
            });
        }

        console.log(`Found ${answersWithText.length} answers with transcriptions, analyzing...`);

        // Get doctor's AI config
        const patient = await Patient.findById(caseData.patient_id || caseData.patient?.id);
        const doctorId = patient ? patient.doctor_id : null;
        let aiCfg = null;
        if (doctorId) {
            aiCfg = await AiConfig.getEffectiveConfig(doctorId);
        }

        // Analyze the case
        const analysis = await aiService.analyzeCase(caseData, aiCfg);

        if (analysis) {
            // Save the analysis
            await Case.saveAiAnalysis(id, analysis);
            console.log('AI analysis saved successfully');
        }

        res.json({
            success: true,
            message: 'Analyse IA mise à jour avec succès',
            analysis
        });
    } catch (error) {
        console.error('Reanalyze error:', error);
        if (error.code === 'MISSING_API_KEY' || error.code === 'QUOTA_EXCEEDED' || error.code === 'API_ERROR') {
            return res.status(400).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to reanalyze case',
            error: error.message
        });
    }
}

module.exports = {
    getAll,
    getById,
    create,
    addAnswer,
    addTextAnswer,
    uploadDocument,
    deleteDocument,
    submit,
    saveReview,
    closeCase,
    deleteCase,
    generatePrescriptionPdf,
    retranscribeCase,
    reanalyzeCase
};
