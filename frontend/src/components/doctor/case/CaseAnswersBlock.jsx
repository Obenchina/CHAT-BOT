import { useEffect, useState } from 'react';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { CLINICAL_MEASURE_LABELS, getAuthUploadUrl } from '../../../constants/config';
import patientService from '../../../services/patientService';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import PatientMeasurementsChart from '../../patient/PatientMeasurementsChart';

const CURVE_MEASURES = new Set(['weight', 'height', 'head_circumference']);
const MEASURE_TEXT_PATTERNS = [
    { measure: 'weight', pattern: /(weight|poids|وزن|الوزن)/i },
    { measure: 'height', pattern: /(height|taille|طول|الطول|قامة|القامة)/i },
    { measure: 'head_circumference', pattern: /(head\s*circumference|p[ée]rim[èe]tre\s*cr[aâ]nien|محيط\s*الر[أا]س)/i }
];

function getAnswerMeasure(answer) {
    const measure = answer.clinical_measure || answer.clinicalMeasure || 'none';
    if (CURVE_MEASURES.has(measure)) return measure;

    const questionText = String(answer.question_text || answer.questionText || '');
    return MEASURE_TEXT_PATTERNS.find((entry) => entry.pattern.test(questionText))?.measure || null;
}

function getAnswerText(answer) {
    if (answer.text_answer !== null && answer.text_answer !== undefined) return answer.text_answer;
    if (answer.textAnswer !== null && answer.textAnswer !== undefined) return answer.textAnswer;
    return answer.transcribed_text || answer.transcribedText || '';
}

function CaseAnswersBlock({ answers, patient }) {
    const [showCurveModal, setShowCurveModal] = useState(false);
    const [activeMeasure, setActiveMeasure] = useState(null);
    const [measurements, setMeasurements] = useState(null);
    const [loadingMeasurements, setLoadingMeasurements] = useState(false);
    const [measurementsError, setMeasurementsError] = useState('');
    const patientId = patient?.id || patient?.patient_id || patient?.patientId;

    useEffect(() => {
        setMeasurements(null);
        setActiveMeasure(null);
        setShowCurveModal(false);
        setMeasurementsError('');
    }, [patientId]);

    const activeMeasureInfo = activeMeasure
        ? (CLINICAL_MEASURE_LABELS[activeMeasure] || { label: activeMeasure, unit: '' })
        : null;

    async function openCurveModal(measure) {
        setActiveMeasure(measure);
        setShowCurveModal(true);
        setMeasurementsError('');

        if (measurements) return;

        if (!patientId) {
            setMeasurementsError('Patient introuvable.');
            return;
        }

        try {
            setLoadingMeasurements(true);
            const res = await patientService.getMeasurements(patientId);
            if (res.success) {
                setMeasurements(res.data || {});
            } else {
                setMeasurementsError(res.message || 'Erreur lors du chargement des mesures.');
            }
        } catch (error) {
            console.error('Load measurements error:', error);
            setMeasurementsError(error.message || 'Erreur lors du chargement des mesures.');
        } finally {
            setLoadingMeasurements(false);
        }
    }

    function renderAnswerValue(answer) {
        const answerText = getAnswerText(answer);
        if (!answerText) {
            return answer.audio_path || answer.audioPath
                ? 'En attente de transcription...'
                : 'Aucune reponse';
        }

        const measure = answer.clinical_measure || answer.clinicalMeasure;
        const unit = answer.answer_type === 'number'
            ? CLINICAL_MEASURE_LABELS[measure]?.unit
            : '';

        return `${answerText}${unit ? ` ${unit}` : ''}`;
    }

    return (
        <div className="card">
            <div className="card-header border-b" style={{ paddingBottom: 'var(--space-sm)' }}>
                <h2 className="card-title">Questionnaire</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                {answers && answers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {answers.map((answer, index) => {
                            const curveMeasure = getAnswerMeasure(answer);

                            return (
                                <div key={answer.id || index} style={{
                                    padding: 'var(--space-lg)',
                                    borderBottom: index < answers.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    background: index % 2 === 0 ? 'transparent' : 'var(--bg-elevated)'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 'var(--space-sm)',
                                        marginBottom: 'var(--space-sm)',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{
                                            fontWeight: '600',
                                            color: 'var(--text-primary)',
                                            fontSize: '1.05rem',
                                            minWidth: 0
                                        }}>
                                            <span style={{ color: 'var(--primary)', marginRight: 8 }}>Q.</span>
                                            {answer.question_text || answer.questionText}
                                        </div>

                                        {curveMeasure && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                startIcon={<ShowChartIcon fontSize="small" />}
                                                onClick={() => openCurveModal(curveMeasure)}
                                                style={{ flexShrink: 0 }}
                                            >
                                                Voir la courbe
                                            </Button>
                                        )}
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-sm)',
                                        marginTop: 'var(--space-md)'
                                    }}>
                                        {(answer.audio_path || answer.audioPath) && (
                                            <div style={{
                                                background: 'var(--bg-card)',
                                                padding: 'var(--space-xs)',
                                                borderRadius: 'var(--radius-full)',
                                                border: '1px solid var(--border-color)',
                                                display: 'inline-block',
                                                width: 'fit-content'
                                            }}>
                                                <audio controls style={{ height: 36, width: 250 }}>
                                                    <source src={getAuthUploadUrl(answer.audio_path || answer.audioPath)} type="audio/webm" />
                                                </audio>
                                            </div>
                                        )}

                                        <div style={{
                                            color: 'var(--text-secondary)',
                                            padding: 'var(--space-md)',
                                            background: 'var(--bg-card)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)',
                                            fontStyle: getAnswerText(answer) ? 'normal' : 'italic',
                                            direction: 'rtl',
                                            textAlign: 'right',
                                            fontSize: '0.95rem',
                                            lineHeight: 1.6
                                        }}>
                                            {renderAnswerValue(answer)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center" style={{ padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
                        Aucune reponse enregistree
                    </div>
                )}
            </div>

            <Modal
                isOpen={showCurveModal}
                title={activeMeasureInfo ? `Courbe - ${activeMeasureInfo.label}` : 'Courbe'}
                onClose={() => setShowCurveModal(false)}
                fullscreen
                bodyStyle={{ padding: 0, overflow: 'hidden' }}
            >
                {loadingMeasurements ? (
                    <div style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>
                        Chargement...
                    </div>
                ) : measurementsError ? (
                    <div className="alert alert-danger">{measurementsError}</div>
                ) : (
                    <div style={{ width: '100%', height: 'calc(100vh - 72px)', padding: 'var(--space-md)', boxSizing: 'border-box' }}>
                        <PatientMeasurementsChart
                            data={(measurements && activeMeasure) ? (measurements[activeMeasure] || []) : []}
                            measureKey={activeMeasure}
                            patient={patient}
                            height="100%"
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default CaseAnswersBlock;
