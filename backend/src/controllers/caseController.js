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
const AiConfig = require('../models/AiConfig');
const aiService = require('../services/aiService');
const pdfService = require('../services/pdfService');

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return '-';
    
    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return '-';

    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    
    if (years === 0) {
        return `${months} mois`;
    }
    
    return `${years} ans`;
}

function formatStoredAge(age) {
    if (age === undefined || age === null || age === '') return '-';

    const text = String(age).trim();
    if (!text || text === '-') return '-';
    if (/[a-zA-Z]/.test(text)) return text;

    const numericAge = Number(text);
    return Number.isFinite(numericAge) ? `${numericAge} ans` : text;
}

function buildPdfPatient(patient = {}) {
    const dateOfBirth = patient.date_of_birth || patient.dateOfBirth;
    const calculatedAge = calculateAge(dateOfBirth);

    return {
        firstName: patient.first_name || patient.firstName || '',
        lastName: patient.last_name || patient.lastName || '',
        age: calculatedAge !== '-' ? calculatedAge : formatStoredAge(patient.age),
        gender: patient.gender || 'unknown',
        dateOfBirth
    };
}

function anonymizeCaseDataForAI(caseData) {
    if (!caseData || typeof caseData !== 'object') return caseData;
    const cloned = { ...caseData };
    if (cloned.patient && typeof cloned.patient === 'object') {
        cloned.patient = { ...cloned.patient };
        // Remove any name fields before sending to AI
        delete cloned.patient.first_name;
        delete cloned.patient.last_name;
        delete cloned.patient.firstName;
        delete cloned.patient.lastName;
        
        // Add age for AI context
        cloned.patient.age_display = calculateAge(cloned.patient.date_of_birth || cloned.patient.dateOfBirth);
    }
    return cloned;
}

function validateClinicalTextAnswer(question, rawAnswer) {
    const clinicalMeasure = question?.clinical_measure || 'none';
    const answerType = question?.answer_type;
    const answerStr = String(rawAnswer ?? '').trim();

    if (!answerStr) {
        return { valid: false, message: 'Réponse vide' };
    }

    if (clinicalMeasure === 'none') {
        return { valid: true };
    }

    if (answerType !== 'number') {
        return { valid: false, message: 'Incohérence type/mesure clinique' };
    }

    if (clinicalMeasure === 'blood_pressure') {
        const match = answerStr.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
        if (!match) {
            return { valid: false, message: 'La tension doit être au format 120/80' };
        }
        const systolic = Number(match[1]);
        const diastolic = Number(match[2]);
        if (systolic < 30 || systolic > 260 || diastolic < 20 || diastolic > 200) {
            return { valid: false, message: 'Valeur de tension hors plage médicale' };
        }
        return { valid: true, normalized: `${systolic}/${diastolic}` };
    }

    const numeric = Number(answerStr);
    if (!Number.isFinite(numeric)) {
        return { valid: false, message: 'Valeur numérique invalide' };
    }

    const ranges = {
        weight: [0, 300],
        height: [0, 250],
        head_circumference: [0, 80],
        temperature: [25, 45]
    };
    const range = ranges[clinicalMeasure];
    if (range) {
        const [min, max] = range;
        if (numeric < min || numeric > max) {
            return { valid: false, message: `Valeur hors plage médicale (${min}-${max})` };
        }
    }

    return { valid: true, normalized: String(numeric) };
}

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

function mapQuestionForQuestionnaire(question) {
    return {
        id: question.id,
        questionText: question.question_text,
        question_text: question.question_text,
        answerType: question.answer_type,
        answer_type: question.answer_type,
        choices: question.choices,
        isRequired: question.is_required,
        is_required: question.is_required,
        orderIndex: question.order_index,
        order_index: question.order_index,
        sectionName: question.section_name,
        section_name: question.section_name,
        sectionOrder: question.section_order,
        section_order: question.section_order,
        clinicalMeasure: question.clinical_measure,
        clinical_measure: question.clinical_measure
    };
}

async function getQuestionSnapshotForCase(caseId, questionId) {
    const caseRecord = await Case.findById(caseId);

    if (!caseRecord) {
        return { error: 'Case not found' };
    }

    const question = await Catalogue.getQuestionById(questionId);
    if (!question || question.catalogue_id !== caseRecord.catalogue_version_id) {
        return { error: 'Question does not belong to this case' };
    }

    return {
        caseRecord,
        question,
        snapshot: {
            questionTextSnapshot: question.question_text,
            answerTypeSnapshot: question.answer_type,
            orderIndexSnapshot: question.order_index
        }
    };
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

        const aiSummary = caseData.ai_summary || caseData.aiAnalysis?.summary || null;

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
                    dateOfBirth: patient.date_of_birth || null,
                    date_of_birth: patient.date_of_birth || null,
                    phone: patient.phone || '',
                    address: patient.address || '',
                    siblingsAlive: patient.siblings_alive ?? 0,
                    siblings_alive: patient.siblings_alive ?? 0,
                    siblingsDeceased: patient.siblings_deceased ?? 0,
                    siblings_deceased: patient.siblings_deceased ?? 0
                },
                answers: (caseData.answers || []).map(a => ({
                    id: a.id,
                    questionId: a.question_id,
                    question_id: a.question_id,
                    questionText: a.question_text,
                    question_text: a.question_text,
                    questionTextSnapshot: a.question_text_snapshot,
                    question_text_snapshot: a.question_text_snapshot,
                    answerType: a.answer_type,
                    answer_type: a.answer_type,
                    answerTypeSnapshot: a.answer_type_snapshot,
                    answer_type_snapshot: a.answer_type_snapshot,
                    sectionName: a.section_name,
                    section_name: a.section_name,
                    sectionOrder: a.section_order,
                    section_order: a.section_order,
                    clinicalMeasure: a.clinical_measure,
                    clinical_measure: a.clinical_measure,
                    audioPath: a.audio_path,
                    audio_path: a.audio_path,
                    textAnswer: a.text_answer,
                    text_answer: a.text_answer,
                    textAnswer: a.text_answer,
                    text_answer: a.text_answer,
                    createdAt: a.created_at,
                    created_at: a.created_at
                })),
                documents: (caseData.documents || []).map(d => ({
                    id: d.id,
                    type: d.document_type,
                    fileName: d.file_name,
                    filePath: d.file_path,
                    uploadedAt: d.uploaded_at
                })),
                aiSummary,
                ai_summary: aiSummary,
                aiAnalysis: caseData.aiAnalysis,
                ai_analysis: caseData.aiAnalysis,
                doctorDiagnosis: caseData.doctor_diagnosis,
                doctor_diagnosis: caseData.doctor_diagnosis,
                doctorPrescription: caseData.doctor_prescription,
                doctor_prescription: caseData.doctor_prescription,
                catalogueId: caseData.catalogue?.id || caseData.catalogue_version_id || null,
                catalogueName: caseData.catalogue?.name || '',
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
        const { patientId, catalogueId } = req.body;

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
            const selectedCatalogue = await Catalogue.findById(latestCase.catalogue_version_id);

            return res.status(200).json({
                success: true,
                message: 'Resuming existing active case',
                data: {
                    id: latestCase.id,
                    patientId,
                    status: 'in_progress',
                    isResumed: true,
                    catalogueId: selectedCatalogue?.id || latestCase.catalogue_version_id,
                    catalogueName: selectedCatalogue?.name || '',
                    questions: questions.filter(q => q.is_active).map(mapQuestionForQuestionnaire)
                }
            });
        }

        let effectiveCatalogueId = catalogueId;

        if (!effectiveCatalogueId) {
            const activeCatalogues = await Catalogue.findActiveByDoctorId(assistant.doctor_id);
            const fallbackCatalogue = activeCatalogues[0];

            if (!fallbackCatalogue) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun catalogue actif avec des questions disponibles'
                });
            }

            effectiveCatalogueId = fallbackCatalogue.id;
        }

        const catalogue = await Catalogue.findById(effectiveCatalogueId);
        if (!catalogue || catalogue.doctor_id !== assistant.doctor_id) {
            return res.status(404).json({
                success: false,
                message: 'Catalogue not found'
            });
        }

        if (!catalogue.is_active) {
            return res.status(400).json({
                success: false,
                message: 'Selected catalogue is not active'
            });
        }

        const questions = await Catalogue.getQuestions(catalogue.id);
        const activeQuestions = questions.filter(q => q.is_active);

        if (activeQuestions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Selected catalogue has no active questions'
            });
        }

        // Create case
        const newCase = await Case.create({
            patientId,
            assistantId: assistant.id,
            catalogueVersionId: catalogue.id
        });

        res.status(201).json({
            success: true,
            message: 'Case created successfully',
            data: {
                id: newCase.id,
                patientId,
                status: 'in_progress',
                catalogueId: catalogue.id,
                catalogueName: catalogue.name,
                questions: activeQuestions.map(mapQuestionForQuestionnaire)
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
        questionId = parseInt(questionId, 10);

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

        const questionContext = await getQuestionSnapshotForCase(parseInt(id, 10), questionId);
        if (questionContext.error) {
            return res.status(400).json({
                success: false,
                message: questionContext.error
            });
        }

        // Check if answer already exists to prevent duplicates (Upsert logic)
        const currentAnswers = await Case.getAnswers(parseInt(id));
        const existingAnswer = currentAnswers.find(a => a.question_id === questionId);

        let answer;
        if (existingAnswer) {
            console.log(`Updating existing answer ${existingAnswer.id} for question ${questionId}`);
            await Case.updateAnswer(existingAnswer.id, {
                audioPath,
                textAnswer: transcribedText || null,
                questionTextSnapshot: existingAnswer.question_text_snapshot || questionContext.snapshot.questionTextSnapshot,
                answerTypeSnapshot: existingAnswer.answer_type_snapshot || questionContext.snapshot.answerTypeSnapshot,
                orderIndexSnapshot: existingAnswer.order_index_snapshot ?? questionContext.snapshot.orderIndexSnapshot
            });
            answer = { ...existingAnswer, audioPath, textAnswer: transcribedText, transcribedText };
        } else {
            answer = await Case.addAnswer({
                caseId: parseInt(id),
                questionId,
                audioPath,
                textAnswer: transcribedText || null,
                ...questionContext.snapshot
            });
        }

        console.log('Answer saved/updated:', answer);

        res.status(200).json({
            success: true,
            message: 'Answer saved successfully',
            data: {
                id: answer.id,
                questionId,
                audioPath,
                textAnswer: transcribedText || null,
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
        const patientForTranscription = await Patient.findById(caseData.patient_id || caseData.patient?.id);
        const doctorIdForTranscription = patientForTranscription ? patientForTranscription.doctor_id : null;
        const aiCfgForTranscription = doctorIdForTranscription
            ? await AiConfig.getEffectiveConfig(doctorIdForTranscription)
            : null;

        for (const answer of answers) {
            // If answer is text-only (no audio), it's fine
            if (!answer.audio_path) {
                continue;
            }

            // Check if transcription exists
            if (!answer.text_answer) {
                try {
                    console.log('🎤 Transcription needed for answer:', answer.id);
                    const transcribedText = await aiService.transcribeAudio(answer.audio_path, aiCfgForTranscription);
                    if (transcribedText) {
                        answer.text_answer = transcribedText;
                        await Case.updateAnswer(answer.id, { textAnswer: transcribedText });
                        transcriptionCount++;
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
            const analysis = await aiService.analyzeCase(anonymizeCaseDataForAI(caseData), aiCfg);
            if (analysis) {
                if (analysis.summary) {
                    analysis.summary = aiService.clampSummaryToMaxLines(analysis.summary, 4);
                }
                await Case.saveAiAnalysis(id, analysis);
                console.log('AI analysis saved successfully');
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
        let { questionId, answer } = req.body;
        questionId = parseInt(questionId, 10);

        if (!questionId || answer === undefined || answer === null || String(answer).trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Question ID and answer are required'
            });
        }

        const questionContext = await getQuestionSnapshotForCase(parseInt(id, 10), questionId);
        if (questionContext.error) {
            return res.status(400).json({
                success: false,
                message: questionContext.error
            });
        }

        const validation = validateClinicalTextAnswer(questionContext.question, answer);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.message || 'Réponse invalide'
            });
        }
        const normalizedAnswer = validation.normalized ?? String(answer).trim();

        // Check if answer already exists
        const currentAnswers = await Case.getAnswers(parseInt(id));
        const existingAnswer = currentAnswers.find(a => a.question_id === questionId);

        let savedAnswer;
        if (existingAnswer) {
            await Case.updateAnswer(existingAnswer.id, {
                audioPath: existingAnswer.audio_path || null,
                textAnswer: normalizedAnswer,
                transcribedText: null,
                questionTextSnapshot: existingAnswer.question_text_snapshot || questionContext.snapshot.questionTextSnapshot,
                answerTypeSnapshot: existingAnswer.answer_type_snapshot || questionContext.snapshot.answerTypeSnapshot,
                orderIndexSnapshot: existingAnswer.order_index_snapshot ?? questionContext.snapshot.orderIndexSnapshot
            });
            savedAnswer = { ...existingAnswer, text_answer: normalizedAnswer };
        } else {
            savedAnswer = await Case.addAnswer({
                caseId: id,
                questionId,
                audioPath: null,
                textAnswer: normalizedAnswer,
                transcribedText: null,
                ...questionContext.snapshot
            });
        }

        res.status(200).json({
            success: true,
            message: 'Answer saved successfully',
            data: {
                id: savedAnswer.id,
                questionId,
                answer: normalizedAnswer
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
        const { diagnosis = '', prescription = '[]', markReviewed = false } = req.body;

        if (markReviewed && !String(diagnosis || '').trim()) {
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
            doctorDiagnosis: diagnosis || '',
            doctorPrescription: prescription || '[]',
            status: markReviewed ? 'reviewed' : caseData.status,
            reviewedAt: markReviewed ? new Date() : (caseData.reviewed_at || null)
        });

        res.json({
            success: true,
            message: markReviewed ? 'Review submitted successfully' : 'Review draft saved successfully'
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

        // Allow generating PDF even if not explicitly reviewed, as requested by user
        // (The doctor might be in the middle of a review)
        if (!caseData.status) {
            return res.status(400).json({
                success: false,
                message: 'Invalid case state'
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
        let parsedPrescription = [];
        if (typeof caseData.doctor_prescription === 'string' && caseData.doctor_prescription.trim()) {
            try {
                parsedPrescription = JSON.parse(caseData.doctor_prescription);
            } catch {
                parsedPrescription = [];
            }
        } else if (Array.isArray(caseData.doctor_prescription)) {
            parsedPrescription = caseData.doctor_prescription;
        }

        const pdfData = {
            patient: buildPdfPatient(caseData.patient),
            doctor: {
                firstName: doctor.first_name || '',
                lastName: doctor.last_name || '',
                specialty: doctor.specialty || 'Médecin Généraliste',
                phone: doctor.phone || '',
                email: doctor.email || '',
                address: doctor.address || '',
                prescriptionLogoPath: doctor.prescription_logo_path || '',
                prescriptionPrimaryColor: doctor.prescription_primary_color || '',
                prescriptionAccentColor: doctor.prescription_accent_color || '',
                prescriptionSpecialtyText: doctor.prescription_specialty_text || '',
                prescriptionServicesText: doctor.prescription_services_text || ''
            },
            diagnosis: caseData.doctor_diagnosis,
            prescription: parsedPrescription,
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
        const patient = await Patient.findById(caseData.patient_id || caseData.patient?.id);
        const doctorId = patient ? patient.doctor_id : null;
        const aiCfg = doctorId ? await AiConfig.getEffectiveConfig(doctorId) : null;

        for (const answer of answers) {
            // Skip if no audio or already has transcription
            if (!answer.audio_path || answer.text_answer) {
                console.log(`Skipping answer ${answer.id}: no audio or already transcribed`);
                continue;
            }

            console.log(`Transcribing answer ${answer.id}: ${answer.audio_path}`);
            const transcribedText = await aiService.transcribeAudio(answer.audio_path, aiCfg);

            if (transcribedText) {
                // Update answer with transcription
                await Case.updateAnswer(answer.id, { textAnswer: transcribedText });
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
        const answersWithText = (caseData.answers || []).filter(a => a.text_answer);
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
        const analysis = await aiService.analyzeCase(anonymizeCaseDataForAI(caseData), aiCfg);

        if (analysis) {
            if (analysis.summary) {
                analysis.summary = aiService.clampSummaryToMaxLines(analysis.summary, 4);
            }
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

/**
 * Generate analyses PDF
 * GET /api/cases/:id/analyses/pdf
 */
async function generateAnalysesPdf(req, res) {
    try {
        const { id } = req.params;
        const selectedAnalyses = req.query.selected
            ? String(req.query.selected).split(',').map(item => item.trim()).filter(Boolean)
            : [];

        if (selectedAnalyses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No analyses selected'
            });
        }

        // Get full case details
        const caseData = await Case.getFullDetails(id);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const pdfData = {
            patient: buildPdfPatient(caseData.patient),
            doctor: {
                firstName: doctor.first_name || '',
                lastName: doctor.last_name || '',
                specialty: doctor.specialty || '',
                phone: doctor.phone || '',
                email: doctor.email || '',
                address: doctor.address || '',
                prescriptionLogoPath: doctor.prescription_logo_path || '',
                prescriptionPrimaryColor: doctor.prescription_primary_color || '',
                prescriptionAccentColor: doctor.prescription_accent_color || '',
                prescriptionSpecialtyText: doctor.prescription_specialty_text || '',
                prescriptionServicesText: doctor.prescription_services_text || ''
            },
            selectedAnalyses,
            date: caseData.reviewed_at || new Date()
        };

        const pdfPath = await pdfService.generateAnalyses(pdfData);

        res.download(pdfPath, `bilan_biologique_${id}.pdf`, (err) => {
            if (err) console.error('Download error:', err);
            require('fs').unlink(pdfPath, () => {});
        });
    } catch (error) {
        console.error('Generate analyses PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate analyses PDF'
        });
    }
}

/**
 * Generate letter PDF
 * GET /api/cases/:id/letter/pdf
 */
async function generateLetterPdf(req, res) {
    try {
        const { id } = req.params;
        const letterContent = req.query.content ? String(req.query.content) : '';

        if (!letterContent.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Letter content is required'
            });
        }

        const caseData = await Case.getFullDetails(id);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const pdfData = {
            patient: buildPdfPatient(caseData.patient),
            doctor: {
                firstName: doctor.first_name || '',
                lastName: doctor.last_name || '',
                specialty: doctor.specialty || '',
                phone: doctor.phone || '',
                email: doctor.email || '',
                address: doctor.address || '',
                prescriptionLogoPath: doctor.prescription_logo_path || '',
                prescriptionPrimaryColor: doctor.prescription_primary_color || '',
                prescriptionAccentColor: doctor.prescription_accent_color || '',
                prescriptionSpecialtyText: doctor.prescription_specialty_text || '',
                prescriptionServicesText: doctor.prescription_services_text || ''
            },
            letterContent,
            date: caseData.reviewed_at || new Date()
        };

        const pdfPath = await pdfService.generateLetter(pdfData);

        res.download(pdfPath, `lettre_orientation_${id}.pdf`, (err) => {
            if (err) console.error('Download error:', err);
            require('fs').unlink(pdfPath, () => {});
        });
    } catch (error) {
        console.error('Generate letter PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate letter PDF'
        });
    }
}

/**
 * Suggest medications via AI (on-demand, doctor clicks button)
 * POST /api/cases/:id/suggest-medications
 */
async function suggestMedications(req, res) {
    try {
        const { id } = req.params;
        const caseData = await Case.getFullDetails(id);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Cas introuvable' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Médecin introuvable' });
        }

        const activeAiConfig = await AiConfig.findActiveByDoctorId(doctor.id);
        const aiConfig = activeAiConfig ? {
            provider: activeAiConfig.provider,
            apiKey: activeAiConfig.api_key,
            model: activeAiConfig.model
        } : null;

        if (!aiConfig || !aiConfig.apiKey) {
            return res.status(400).json({ success: false, message: 'Clé API IA non configurée pour ce médecin' });
        }

        const medications = await aiService.suggestMedications(anonymizeCaseDataForAI(caseData), aiConfig);
        res.json({ success: true, data: medications });
    } catch (error) {
        console.error('Suggest medications error:', error);
        let statusCode = 500;
        let userMessage = 'Échec de la suggestion de médicaments';
        if (error.code === 'QUOTA_EXCEEDED') { statusCode = 429; userMessage = 'Crédit IA épuisé'; }
        if (error.code === 'MISSING_API_KEY') { statusCode = 400; userMessage = 'Clé API non configurée'; }
        res.status(statusCode).json({ success: false, message: userMessage });
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
    generateAnalysesPdf,
    generateLetterPdf,
    retranscribeCase,
    reanalyzeCase,
    suggestMedications
};
