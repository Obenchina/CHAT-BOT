/**
 * Questionnaire Page
 * Assistant fills in patient responses to catalogue questions
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import caseService from '../../services/caseService';
import patientService from '../../services/patientService';
import translations from '../../constants/translations';
import { UPLOAD_URL, getAuthUploadUrl, CLINICAL_MEASURE_LABELS } from '../../constants/config';
import { showError, showWarning } from '../../utils/toast';
import '../../styles/questionnaire.css';
import Modal from '../../components/common/Modal';
import PatientMeasurementsChart from '../../components/patient/PatientMeasurementsChart';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';

const t = translations;

function validateClinicalInput(question, rawValue) {
    const clinicalMeasure = question?.clinical_measure;
    if (!clinicalMeasure || clinicalMeasure === 'none') return { valid: true };

    const value = String(rawValue ?? '').trim();
    if (!value) return { valid: false, message: 'Valeur clinique requise.' };

    if (clinicalMeasure === 'blood_pressure') {
        const match = value.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
        if (!match) return { valid: false, message: 'La tension doit être au format 120/80.' };
        const x = Number(match[1]);
        const y = Number(match[2]);
        if (x < 30 || x > 260 || y < 20 || y > 200) {
            return { valid: false, message: 'Valeur de tension hors plage médicale (30-260 / 20-200).' };
        }
        return { valid: true };
    }

    const n = Number(value);
    if (!Number.isFinite(n)) return { valid: false, message: 'Valeur numérique invalide.' };

    const ranges = {
        weight: [0, 300, 'poids'],
        height: [0, 250, 'taille'],
        head_circumference: [0, 80, 'périmètre crânien'],
        temperature: [25, 45, 'température']
    };
    const range = ranges[clinicalMeasure];
    if (!range) return { valid: true };
    const [min, max, label] = range;
    if (n < min || n > max) {
        return { valid: false, message: `Valeur ${label} hors plage médicale (${min} à ${max}).` };
    }
    return { valid: true };
}

function QuestionnairePage() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const selectedCatalogueId = searchParams.get('catalogueId');

    // State
    const [patient, setPatient] = useState(null);
    const [caseId, setCaseId] = useState(null);
    const [catalogueName, setCatalogueName] = useState('');
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({}); // Stores all answers including audio blobs
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Curve modal
    const [showCurveModal, setShowCurveModal] = useState(false);
    const [measurements, setMeasurements] = useState(null);
    const [loadingMeasurements, setLoadingMeasurements] = useState(false);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const pendingSavesRef = useRef(new Set());

    // Load patient and create case
    useEffect(() => {
        initializeQuestionnaire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, selectedCatalogueId]);

    // Warn user before leaving page during active questionnaire
    useEffect(() => {
        const hasAnswers = Object.keys(answers).length > 0;
        if (!hasAnswers) return;

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [answers]);

    async function initializeQuestionnaire() {
        setLoading(true);
        setCaseId(null);
        setCatalogueName('');
        setQuestions([]);
        setAnswers({});
        setCurrentIndex(0);

        try {
            // Load patient
            const patientResponse = await patientService.getById(patientId);
            if (patientResponse.success) {
                setPatient(patientResponse.data);
            }

            // Create new case or resume existing
            const caseResponse = await caseService.create(patientId, selectedCatalogueId);
            if (caseResponse.success) {
                const caseData = caseResponse.data;
                console.log('Case initialized:', caseData); // Debug log
                setCaseId(caseData.id || caseData.caseId);
                setCatalogueName(caseData.catalogueName || '');
                const allQuestions = caseData.questions || [];
                setQuestions(allQuestions);

                // If resumed, load existing answers
                if (caseData.isResumed) {
                    try {
                        // Fetch full case details to get answers
                        console.log('Fetching full case details for:', caseData.id);
                        const fullCaseResponse = await caseService.getById(caseData.id);
                        console.log('Full case response:', fullCaseResponse);

                        if (fullCaseResponse.success) {
                            const existingAnswers = {};
                            const loadedAnswers = fullCaseResponse.data.answers || [];
                            console.log('Loaded answers raw:', loadedAnswers);

                            loadedAnswers.forEach(ans => {
                                // Map backend answer format to frontend state
                                // Check for both camelCase (API) and snake_case (DB)
                                const qId = ans.questionId || ans.question_id;
                                const audioPath = ans.audioPath || ans.audio_path;
                                const answerType = ans.answerType || ans.answer_type;
                                const textAnswer = ans.textAnswer || ans.text_answer || '';

                                if (qId) {
                                    // FIX: Add /uploads/ prefix to audio path
                                    const audioUrl = audioPath ? getAuthUploadUrl(audioPath) : null;
                                    console.log(`Loading answer for Q${qId}: type=${answerType}, audioPath=${audioPath}, url=${audioUrl}`);

                                    existingAnswers[qId] = {
                                        type: answerType,
                                        value: transcribedText,
                                        audioUrl: audioUrl
                                    };
                                } else {
                                    console.warn('Skipping answer without questionId:', ans);
                                }
                            });

                            console.log('Restored answers:', existingAnswers);
                            setAnswers(existingAnswers);

                            // Find first unanswered question index
                            const firstUnansweredIndex = allQuestions.findIndex(q => !existingAnswers[q.id]);
                            if (firstUnansweredIndex !== -1) {
                                setCurrentIndex(firstUnansweredIndex);
                            } else {
                                // All answered, go to last
                                setCurrentIndex(allQuestions.length - 1);
                            }
                        }
                    } catch (err) {
                        console.error('Error loading existing answers:', err);
                    }
                }
            }
        } catch (error) {
            console.error('Initialize error:', error);
            showError(error.message || 'Erreur lors du chargement du questionnaire');
        } finally {
            setLoading(false);
        }
    }

    // Current question
    const currentQuestion = questions[currentIndex];
    const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

    // Get current answer for this question
    const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
    const currentAudioBlob = currentAnswer?.audioBlob || null;

    const curveEligibleMeasure = currentQuestion?.clinical_measure;
    const canShowCurve = Boolean(curveEligibleMeasure && ['weight', 'height', 'head_circumference'].includes(curveEligibleMeasure));
    const answeredCount = questions.filter((q) => answers[q.id]).length;
    const answeredPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
    const currentSectionName = currentQuestion?.section_name || currentQuestion?.sectionName || 'Sans section';
    const patientName = patient
        ? `${patient.firstName || patient.first_name || ''} ${patient.lastName || patient.last_name || ''}`.trim()
        : '';
    const patientGender = patient?.gender === 'female'
        ? 'Femme'
        : patient?.gender === 'male'
            ? 'Homme'
            : 'Non renseigné';
    const currentAnswerType = currentQuestion?.answerType || currentQuestion?.answer_type;
    const answerTypeLabels = {
        yes_no: 'Oui / non',
        choices: 'Choix',
        text_short: 'Texte court',
        text_long: 'Texte long',
        number: 'Nombre',
        voice: 'Vocal'
    };
    const currentAnswerTypeLabel = answerTypeLabels[currentAnswerType] || 'Texte';

    async function openCurveModal() {
        setShowCurveModal(true);
        if (measurements) return;
        try {
            setLoadingMeasurements(true);
            const res = await patientService.getMeasurements(patientId);
            if (res.success) {
                setMeasurements(res.data || {});
            }
        } catch (e) {
            console.error('Load measurements error:', e);
            showError(e.message || 'Erreur lors du chargement des mesures');
        } finally {
            setLoadingMeasurements(false);
        }
    }

    // Start recording
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Save audio blob to answers for this question
                setAnswers(prev => ({
                    ...prev,
                    [currentQuestion.id]: {
                        type: 'voice',
                        audioBlob: blob,
                        audioUrl: URL.createObjectURL(blob)
                    }
                }));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Recording error:', error);
            showError('Impossible d\'accéder au microphone');
        }
    }

    // Stop recording
    function stopRecording() {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }

    // Clear recording for current question
    function clearRecording() {
        setAnswers(prev => {
            const newAnswers = { ...prev };
            if (newAnswers[currentQuestion.id]) {
                // Revoke URL to free memory
                if (newAnswers[currentQuestion.id].audioUrl && newAnswers[currentQuestion.id].audioUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(newAnswers[currentQuestion.id].audioUrl);
                }
                delete newAnswers[currentQuestion.id];
            }
            return newAnswers;
        });
    }

    // Handle yes/no answer
    function handleYesNo(value) {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: { type: 'yes_no', value }
        }));
    }

    // Handle choice answer
    function handleChoice(value) {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: { type: 'choices', value }
        }));
    }

    // Handle text/number answer
    function handleTextChange(value, type) {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: { type, value }
        }));
    }

    // Helper to save a single answer to backend
    async function saveCurrentAnswer(question, answerData) {
        if (!answerData) return;

        const savePromise = (async () => {
            try {
                if (answerData.type === 'voice' && answerData.audioBlob) {
                    const formData = new FormData();
                    formData.append('audio', answerData.audioBlob, 'recording.webm');
                    formData.append('questionId', question.id);
                    await caseService.addAnswer(caseId, formData);
                    console.log('Voice answer saved:', question.id);
                } else if (answerData.type === 'yes_no' || answerData.type === 'choices' || answerData.type === 'text_short' || answerData.type === 'text_long' || answerData.type === 'number') {
                    await caseService.addTextAnswer(caseId, {
                        questionId: question.id,
                        answer: String(answerData.value)
                    });
                    console.log('Text/Number answer saved:', question.id);
                }
            } catch (error) {
                console.error('Failed to save answer:', error);
                // Handle specific AI errors
                if (error.code === 'MISSING_API_KEY' || error.code === 'QUOTA_EXCEEDED' || error.code === 'API_ERROR') {
                    showError(error.message);
                } else {
                    showError(error.message || 'Erreur lors de l\'enregistrement de la réponse');
                }
            }
        })();

        pendingSavesRef.current.add(savePromise);
        try {
            await savePromise;
        } finally {
            pendingSavesRef.current.delete(savePromise);
        }
    }

    // Validate if current question is required and answered
    function validateCurrentQuestion() {
        const required = currentQuestion.isRequired || currentQuestion.is_required;
        if (!required) return true;

        // Check if we have an answer (saved state)
        const hasSavedAnswer = answers[currentQuestion.id];

        // Check if we are currently recording (which means we HAVE an answer pending)
        const isRecordingNow = isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive';

        // Check if we have a temporary blob not yet saved to answers state (rare but possible in race conditions)
        const hasAudioBlob = currentQuestion.id && audioChunksRef.current && audioChunksRef.current.length > 0;

        if (!hasSavedAnswer && !isRecordingNow && !hasAudioBlob) {
            showWarning('Veuillez répondre à cette question obligatoire pour continuer.');
            return false;
        }

        const currentType = currentQuestion.answerType || currentQuestion.answer_type;
        const answerValue = hasSavedAnswer?.value ?? '';
        if (currentType === 'number') {
            const clinicalValidation = validateClinicalInput(currentQuestion, answerValue);
            if (!clinicalValidation.valid) {
                showWarning(clinicalValidation.message);
                return false;
            }
        }
        return true;
    }

    // Navigate to next question - stops recording and SAVES current answer
    async function goNext() {
        // Validate before moving
        if (!validateCurrentQuestion()) {
            return;
        }

        // If recording is active, stop it first
        let blobToSave = null;
        if (isRecording && mediaRecorderRef.current) {
            await new Promise(resolve => {
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    blobToSave = blob;
                    // Update state locally
                    setAnswers(prev => ({
                        ...prev,
                        [currentQuestion.id]: {
                            type: 'voice',
                            audioBlob: blob,
                            audioUrl: URL.createObjectURL(blob)
                        }
                    }));
                    resolve();
                };
                mediaRecorderRef.current.stop();
            });
            setIsRecording(false);
        }

        // Save current answer before moving
        const answerToSave = blobToSave
            ? { type: 'voice', audioBlob: blobToSave }
            : answers[currentQuestion.id];

        if (answerToSave) {
            // Non-blocking save (or blocking if we want to ensure safety)
            saveCurrentAnswer(currentQuestion, answerToSave);
        }

        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }

    // Navigate to previous question - same logic
    async function goPrevious() {
        if (isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }

        // We can save here too, just in case they changed it
        const currentAns = answers[currentQuestion.id];
        if (currentAns) {
            saveCurrentAnswer(currentQuestion, currentAns);
        }

        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }

    // Finish questionnaire
    async function finishQuestionnaire() {
        // Validate current question first
        if (!validateCurrentQuestion()) {
            return;
        }

        // Validate all required questions
        const missingRequired = questions.find(q => {
            const required = q.isRequired || q.is_required;
            if (!required) return false;

            // If it's the current question and we are recording, it's fine
            if (q.id === currentQuestion.id && isRecording) return false;

            return !answers[q.id];
        });

        if (missingRequired) {
            showWarning(`La question "${missingRequired.questionText || missingRequired.question_text}" est obligatoire.`);
            const idx = questions.findIndex(q => q.id === missingRequired.id);
            if (idx !== -1) setCurrentIndex(idx);
            return;
        }

        // Stop recording if active
        let finalBlob = null;
        if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            await new Promise(resolve => {
                mediaRecorderRef.current.onstop = () => {
                    finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    setAnswers(prev => ({
                        ...prev,
                        [currentQuestion.id]: { type: 'voice', audioBlob: finalBlob, audioUrl: URL.createObjectURL(finalBlob) }
                    }));
                    resolve();
                };
                mediaRecorderRef.current.stop();
            });
            setIsRecording(false);
        }

        setSubmitting(true);
        try {
            // Save the current (last) answer
            const lastAnswer = finalBlob ? { type: 'voice', audioBlob: finalBlob } : answers[currentQuestion.id];
            if (lastAnswer) {
                await saveCurrentAnswer(currentQuestion, lastAnswer);
            }

            // Wait for ANY other pending saves (from background inputs)
            if (pendingSavesRef.current.size > 0) {
                console.log(`Waiting for ${pendingSavesRef.current.size} pending saves...`);
                await Promise.all(pendingSavesRef.current);
            }

            // Navigate to review
            navigate(`/assistant/case/${caseId}/review`);

        } catch (error) {
            console.error('Finish error:', error);
            showError('Erreur lors de la finalisation');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="layout internal-shell questionnaire-shell">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t.questionnaire.title}</h1>
                        {(patient || catalogueName) && (
                            <div style={{ color: 'var(--gray-600)' }}>
                                {patient && `${patient.firstName || patient.first_name} ${patient.lastName || patient.last_name}`}
                                {patient && catalogueName && ' · '}
                                {catalogueName && `Catalogue: ${catalogueName}`}
                            </div>
                        )}
                    </div>
                </div>

                <div className="page-content">
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="card">
                            <div className="card-body text-center" style={{ color: 'var(--gray-500)' }}>
                                Aucune question dans le catalogue. Le médecin doit d'abord créer un catalogue.
                            </div>
                        </div>
                    ) : (
                        <div className="questionnaire-container questionnaire-workspace">
                            <aside className="card questionnaire-plan">
                                <div className="card-header">
                                    <h2 className="card-title">Plan du questionnaire</h2>
                                </div>
                                <div className="card-body">
                                    <div className="questionnaire-progress-summary">
                                        <span>{answeredCount}/{questions.length} réponses</span>
                                        <span>{answeredPercent}%</span>
                                    </div>
                                    <div className="progress-bar" style={{ marginBottom: 'var(--space-4)' }}>
                                        <div className="progress-fill" style={{ width: `${answeredPercent}%` }} />
                                    </div>
                                    <div className="questionnaire-plan-list">
                                        {questions.map((q, idx) => {
                                            const section = q.section_name || q.sectionName || 'Sans section';
                                            return (
                                                <button
                                                    key={q.id}
                                                    type="button"
                                                    className={`questionnaire-plan-item ${answers[q.id] ? 'is-answered' : ''} ${idx === currentIndex ? 'is-current' : ''}`}
                                                    onClick={() => setCurrentIndex(idx)}
                                                    title={`Question ${idx + 1}`}
                                                >
                                                    <span className="questionnaire-plan-dot" />
                                                    <span style={{ minWidth: 0 }}>
                                                        <span style={{ display: 'block', fontWeight: 700 }}>Q{idx + 1}</span>
                                                        <span style={{ display: 'block', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {section}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </aside>

                            <section className="questionnaire-main-column">
                                <div className="questionnaire-progress">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="progress-text">
                                        Section : {currentSectionName} · {t.questionnaire.question} {currentIndex + 1} / {questions.length}
                                    </div>
                                </div>

                                <div className="card questionnaire-card">
                                    <div className="card-body">
                                        <div style={{ marginBottom: '8px' }}>
                                            <span className="badge badge-info">
                                                {currentSectionName}
                                            </span>
                                        </div>
                                        <h2 className="question-text">
                                            {currentQuestion.questionText || currentQuestion.question_text}
                                            {(currentQuestion.isRequired || currentQuestion.is_required) && (
                                                <span style={{ color: 'var(--error)' }}> *</span>
                                            )}
                                        </h2>
                                        {currentQuestion.clinical_measure && currentQuestion.clinical_measure !== 'none' && (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                                                Mesure : {CLINICAL_MEASURE_LABELS[currentQuestion.clinical_measure]?.label || currentQuestion.clinical_measure}
                                            </p>
                                        )}
                                        {canShowCurve && (
                                            <div style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                                                <Button variant="secondary" size="sm" onClick={openCurveModal}>
                                                    Voir la courbe
                                                </Button>
                                            </div>
                                        )}

                                        <div className="answer-section">
                                            {currentAnswerType === 'yes_no' && (
                                                <div className="yes-no-buttons">
                                                    <Button
                                                        variant={currentAnswer?.value === 'yes' ? 'success' : 'secondary'}
                                                        size="lg"
                                                        onClick={() => handleYesNo('yes')}
                                                    >
                                                        {t.common.yes}
                                                    </Button>
                                                    <Button
                                                        variant={currentAnswer?.value === 'no' ? 'danger' : 'secondary'}
                                                        size="lg"
                                                        onClick={() => handleYesNo('no')}
                                                    >
                                                        {t.common.no}
                                                    </Button>
                                                </div>
                                            )}

                                            {currentAnswerType === 'choices' && currentQuestion.choices && (
                                                <div className="choices-list">
                                                    {currentQuestion.choices.map((choice, idx) => {
                                                        const isSelected = currentAnswer?.value &&
                                                            String(currentAnswer.value).trim().toLowerCase() === String(choice).trim().toLowerCase();

                                                        return (
                                                            <button
                                                                key={idx}
                                                                className={`choice-btn ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => handleChoice(choice)}
                                                            >
                                                                {choice}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {currentAnswerType === 'text_short' && (
                                                <div className="text-answer">
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
                                                        value={currentAnswer?.value || ''}
                                                        onChange={(e) => handleTextChange(e.target.value, 'text_short')}
                                                        placeholder="Votre réponse..."
                                                    />
                                                </div>
                                            )}

                                            {currentAnswerType === 'text_long' && (
                                                <div className="text-answer">
                                                    <textarea
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '12px', fontSize: '1.1rem', minHeight: '120px' }}
                                                        value={currentAnswer?.value || ''}
                                                        onChange={(e) => handleTextChange(e.target.value, 'text_long')}
                                                        placeholder="Votre réponse détaillée..."
                                                    />
                                                </div>
                                            )}

                                            {currentAnswerType === 'number' && (
                                                <div className="text-answer flex items-center gap-sm">
                                                    {currentQuestion.clinical_measure === 'blood_pressure' ? (
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            style={{ width: '180px', padding: '12px', fontSize: '1.1rem' }}
                                                            value={currentAnswer?.value || ''}
                                                            onChange={(e) => handleTextChange(e.target.value, 'number')}
                                                            placeholder="120/80"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className="form-input"
                                                            style={{ width: '150px', padding: '12px', fontSize: '1.1rem' }}
                                                            value={currentAnswer?.value || ''}
                                                            onChange={(e) => handleTextChange(e.target.value, 'number')}
                                                            placeholder="0"
                                                        />
                                                    )}
                                                    {currentQuestion.clinical_measure && currentQuestion.clinical_measure !== 'none' && CLINICAL_MEASURE_LABELS[currentQuestion.clinical_measure]?.unit && (
                                                        <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                                                            {CLINICAL_MEASURE_LABELS[currentQuestion.clinical_measure].unit}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {currentAnswerType === 'voice' && (
                                                <div className="voice-recorder">
                                                    {!isRecording && !currentAudioBlob && !currentAnswer?.audioUrl && (
                                                        <Button variant="primary" size="lg" onClick={startRecording}>
                                                            <MicIcon /> {t.questionnaire.startRecording}
                                                        </Button>
                                                    )}

                                                    {isRecording && (
                                                        <div className="recording-active">
                                                            <div className="recording-indicator">
                                                                <span className="recording-dot"></span>
                                                                {t.questionnaire.recording}
                                                            </div>
                                                            <Button variant="danger" onClick={stopRecording}>
                                                                <StopIcon /> {t.questionnaire.stopRecording}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {(currentAudioBlob || currentAnswer?.audioUrl) && !isRecording && (
                                                        <div className="recording-complete">
                                                            <div className="recording-saved">
                                                                <CheckCircleIcon color="success" /> Enregistrement sauvegardé
                                                            </div>
                                                            <audio controls src={currentAnswer?.audioUrl} />
                                                            <Button variant="secondary" onClick={clearRecording}>
                                                                {t.questionnaire.reRecord}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="questionnaire-nav">
                                    <Button
                                        variant="secondary"
                                        onClick={goPrevious}
                                        disabled={currentIndex === 0}
                                        style={{ gap: '0.5rem' }}
                                    >
                                        <ArrowBackIcon /> {t.questionnaire.previousQuestion}
                                    </Button>

                                    {currentIndex < questions.length - 1 ? (
                                        <Button variant="primary" onClick={goNext} style={{ gap: '0.5rem' }}>
                                            {t.questionnaire.nextQuestion} <ArrowForwardIcon />
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="success"
                                            onClick={finishQuestionnaire}
                                            loading={submitting}
                                            style={{ gap: '0.5rem' }}
                                        >
                                            {t.questionnaire.finish} <CheckIcon />
                                        </Button>
                                    )}
                                </div>
                            </section>

                            <aside className="card questionnaire-preview">
                                <div className="card-header">
                                    <h2 className="card-title">Aperçu du dossier</h2>
                                </div>
                                <div className="card-body">
                                    <div className="questionnaire-preview-list">
                                        <div className="questionnaire-preview-stat">
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Patient</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 750 }}>{patientName || 'Patient'}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>{patientGender}</div>
                                        </div>
                                        <div className="questionnaire-preview-stat">
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Catalogue</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 650 }}>{catalogueName || 'Catalogue actif'}</div>
                                        </div>
                                        <div className="questionnaire-preview-stat">
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Question actuelle</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 650 }}>Q{currentIndex + 1} · {currentAnswerTypeLabel}</div>
                                            <div style={{ color: currentAnswer ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                                                {currentAnswer ? 'Réponse enregistrée localement' : 'En attente de réponse'}
                                            </div>
                                        </div>
                                        <Button
                                            variant="success"
                                            onClick={finishQuestionnaire}
                                            loading={submitting}
                                            disabled={answeredCount === 0}
                                            style={{ width: '100%' }}
                                        >
                                            Valider le récapitulatif
                                        </Button>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    )}
                </div>
            </main>

            <Modal
                isOpen={showCurveModal}
                title="Courbe"
                onClose={() => setShowCurveModal(false)}
                footer={
                    <Button variant="secondary" onClick={() => setShowCurveModal(false)}>
                        Fermer
                    </Button>
                }
            >
                {loadingMeasurements ? (
                    <div style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>
                        Chargement...
                    </div>
                ) : (
                    <div style={{ width: '100%', minHeight: '420px' }}>
                        <PatientMeasurementsChart
                            data={(measurements && curveEligibleMeasure) ? (measurements[curveEligibleMeasure] || []) : []}
                            measureKey={curveEligibleMeasure}
                            patient={patient}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default QuestionnairePage;
