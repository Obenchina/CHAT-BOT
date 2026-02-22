/**
 * Case Details Page
 * Doctor views case details, answers, and writes diagnosis
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import caseService from '../../services/caseService';
import translations from '../../constants/translations';
import { API_URL, UPLOAD_URL } from '../../constants/config';

const t = translations;

function CaseDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    // State
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [diagnosis, setDiagnosis] = useState('');
    const [medications, setMedications] = useState([]);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [autoSaving, setAutoSaving] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [draggedMedIndex, setDraggedMedIndex] = useState(null);

    // Refs for auto-save
    const autoSaveTimerRef = useRef(null);
    const lastSavedRef = useRef({ diagnosis: '', medications: [] });


    // Load case
    useEffect(() => {
        loadCase();
    }, [id]);

    async function loadCase() {
        try {
            const response = await caseService.getById(id);
            if (response.success) {
                setCaseData(response.data);
                setDiagnosis(response.data.doctor_diagnosis || response.data.doctorDiagnosis || '');

                // Initialize medications from AI analysis or saved prescription
                const aiAnalysis = response.data.aiAnalysis || response.data.ai_analysis;
                if (aiAnalysis && aiAnalysis.medications) {
                    setMedications(aiAnalysis.medications.map((m, i) => ({ ...m, id: i + 1 })));
                } else if (response.data.doctor_prescription || response.data.doctorPrescription) {
                    // Parse existing prescription (simple format)
                    try {
                        const savedMeds = JSON.parse(response.data.doctor_prescription || response.data.doctorPrescription);
                        if (Array.isArray(savedMeds)) {
                            setMedications(savedMeds);
                        }
                    } catch {
                        setMedications([]);
                    }
                }
            }
        } catch (err) {
            console.error('Load case error:', err);
            setError('Erreur lors du chargement du cas');
        } finally {
            setLoading(false);
        }
    }

    // Medication management functions
    function addMedication() {
        const newMed = {
            id: Date.now(),
            name: '',
            dosage: '',
            frequency: '',
            duration: ''
        };
        setMedications([...medications, newMed]);
    }

    function removeMedication(id) {
        setMedications(medications.filter(m => m.id !== id));
    }

    function updateMedication(id, field, value) {
        setMedications(medications.map(m =>
            m.id === id ? { ...m, [field]: value } : m
        ));
    }

    function handleDragStart(index) {
        setDraggedMedIndex(index);
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        if (draggedMedIndex === null || draggedMedIndex === index) return;

        const newMeds = [...medications];
        const draggedMed = newMeds[draggedMedIndex];
        newMeds.splice(draggedMedIndex, 1);
        newMeds.splice(index, 0, draggedMed);
        setMedications(newMeds);
        setDraggedMedIndex(index);
    }

    function handleDragEnd() {
        setDraggedMedIndex(null);
    }

    // Save review
    async function handleSaveReview() {
        if (!diagnosis.trim()) {
            setError('التشخيص مطلوب');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const prescription = JSON.stringify(medications);
            const response = await caseService.saveReview(id, { diagnosis, prescription });
            if (response.success) {
                setSuccess('تم حفظ التشخيص بنجاح');
                setCaseData(prev => ({ ...prev, status: 'reviewed' }));
            }
        } catch (err) {
            console.error('Save review error:', err);
            setError('خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    }

    // Auto-save effect (debounced 3 seconds)
    useEffect(() => {
        // Skip if case is not loaded or already closed
        if (!caseData || caseData.status === 'closed') return;

        // Skip if nothing changed from last saved values
        const currentMeds = JSON.stringify(medications);
        if (diagnosis === lastSavedRef.current.diagnosis &&
            currentMeds === JSON.stringify(lastSavedRef.current.medications)) return;

        // Clear existing timer
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        // Set new timer for auto-save
        autoSaveTimerRef.current = setTimeout(async () => {
            if (!diagnosis.trim()) return; // Don't auto-save without diagnosis

            setAutoSaving(true);
            try {
                const prescription = JSON.stringify(medications);
                await caseService.saveReview(id, { diagnosis, prescription });
                lastSavedRef.current = { diagnosis, medications: [...medications] };
                console.log('Auto-saved');
            } catch (err) {
                console.error('Auto-save error:', err);
            } finally {
                setAutoSaving(false);
            }
        }, 3000);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [diagnosis, medications, caseData, id]);

    // Download prescription PDF
    async function handleDownloadPdf() {
        setDownloadingPdf(true);
        try {
            const response = await fetch(`${API_URL}/cases/${id}/prescription/pdf`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('PDF generation failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ordonnance_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download PDF error:', err);
            setError('Erreur lors du téléchargement du PDF');
        } finally {
            setDownloadingPdf(false);
        }
    }

    // Status badge
    function getStatusBadge(status) {
        const badges = {
            in_progress: { class: 'badge-warning', text: 'En cours' },
            submitted: { class: 'badge-info', text: 'Soumis' },
            reviewed: { class: 'badge-success', text: 'Traité' },
            closed: { class: 'badge-gray', text: 'Fermé' }
        };
        const badge = badges[status] || badges.in_progress;
        return <span className={`badge ${badge.class}`}>{badge.text}</span>;
    }

    if (loading) {
        return (
            <div className="layout">
                <Sidebar />
                <main className="main-content">
                    <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                        <LoadingSpinner size="lg" text={t.common.loading} />
                    </div>
                </main>
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="layout">
                <Sidebar />
                <main className="main-content">
                    <div className="card">
                        <div className="card-body text-center">
                            Cas non trouvé
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const patient = caseData.patient || {};
    const answers = caseData.answers || [];
    const documents = caseData.documents || [];
    const aiAnalysis = caseData.aiAnalysis || caseData.ai_analysis;

    // Document type labels
    const docTypeLabels = {
        'analyses': 'Analyses',
        'imagerie': 'Imagerie',
        'ordonnances': 'Ordonnances',
        'comptes_rendus': 'Comptes rendus',
        'other': 'Autre'
    };

    const location = useLocation();

    // Determine back path
    const backPath = location.state?.from === 'patients' ? '/doctor/patients' : '/doctor/dashboard';

    return (
        <div className="layout">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <Button variant="secondary" onClick={() => navigate(backPath)}>
                            ← Retour
                        </Button>
                    </div>
                    <h1 className="page-title" style={{ marginLeft: 'var(--space-md)' }}>
                        Détails du cas
                    </h1>
                    {getStatusBadge(caseData.status)}
                </div>

                <div className="page-content">
                    {/* Patient Info */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="card-header">
                            <h2 className="card-title">👤 Informations du patient</h2>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                                <div>
                                    <strong>Nom:</strong> {patient.first_name || patient.firstName} {patient.last_name || patient.lastName}
                                </div>
                                <div>
                                    <strong>Genre:</strong> {patient.gender === 'male' ? 'Homme' : patient.gender === 'female' ? 'Femme' : '-'}
                                </div>
                                <div>
                                    <strong>Âge:</strong> {patient.age || '-'} ans
                                </div>
                                <div>
                                    <strong>Téléphone:</strong> {patient.phone || '-'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Answers */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="card-header">
                            <h2 className="card-title">📋 Réponses au questionnaire</h2>
                        </div>
                        <div className="card-body">
                            {answers.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {answers.map((answer, index) => (
                                        <div key={answer.id || index} style={{
                                            padding: 'var(--space-md)',
                                            background: 'var(--gray-50)',
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            <div style={{ fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--primary-700)' }}>
                                                Q{index + 1}: {answer.question_text || answer.questionText}
                                            </div>

                                            {/* Audio player if audio exists */}
                                            {(answer.audio_path || answer.audioPath) && (
                                                <div style={{ marginBottom: 'var(--space-sm)' }}>
                                                    <audio controls style={{ width: '100%', maxWidth: '400px' }}>
                                                        <source src={`${UPLOAD_URL}/${answer.audio_path || answer.audioPath}`} type="audio/webm" />
                                                    </audio>
                                                </div>
                                            )}

                                            {/* Transcribed text */}
                                            <div style={{
                                                color: 'var(--gray-700)',
                                                padding: 'var(--space-sm)',
                                                background: 'var(--gray-100)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontStyle: (answer.transcribed_text || answer.transcribedText) ? 'normal' : 'italic'
                                            }}>
                                                {(answer.transcribed_text || answer.transcribedText) ||
                                                    (answer.audio_path || answer.audioPath ? 'في انتظار نسخ النص...' : 'لا توجد إجابة')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--gray-500)' }}>Aucune réponse enregistrée</p>
                            )}
                        </div>
                    </div>

                    {/* Documents */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="card-header">
                            <h2 className="card-title">📎 Documents médicaux</h2>
                        </div>
                        <div className="card-body">
                            {documents.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
                                    {documents.map((doc, index) => (
                                        <div key={doc.id || index} style={{
                                            padding: 'var(--space-md)',
                                            background: 'var(--gray-50)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)'
                                        }}>
                                            <span style={{ fontSize: '1.5rem' }}>📄</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '500' }}>
                                                    {doc.fileName || doc.file_name || 'Document'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                                    {docTypeLabels[doc.type || doc.document_type] || 'Autre'}
                                                </div>
                                            </div>
                                            <a
                                                href={`${UPLOAD_URL}/${doc.filePath || doc.file_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                            >
                                                Voir
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--gray-500)' }}>Aucun document attaché</p>
                            )}
                        </div>
                    </div>

                    {/* AI Analysis */}
                    {aiAnalysis && (
                        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                            <div className="card-header">
                                <h2 className="card-title">🤖 Analyse IA</h2>
                            </div>
                            <div className="card-body">
                                {typeof aiAnalysis === 'string' ? (
                                    <p>{aiAnalysis}</p>
                                ) : (
                                    <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                        {/* Summary */}
                                        {aiAnalysis.summary && (
                                            <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                                                <strong style={{ color: 'var(--primary-700)' }}>📋 Résumé:</strong>
                                                <p style={{ marginTop: 'var(--space-sm)', lineHeight: '1.7' }}>{aiAnalysis.summary}</p>
                                            </div>
                                        )}

                                        {/* Diagnoses */}
                                        {(aiAnalysis.diagnoses || aiAnalysis.hypotheses) && (aiAnalysis.diagnoses || aiAnalysis.hypotheses).length > 0 && (
                                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                                <strong style={{ color: 'var(--primary-700)' }}>🔬 Diagnostics suggérés:</strong>
                                                <div style={{ marginTop: 'var(--space-sm)' }}>
                                                    {(aiAnalysis.diagnoses || aiAnalysis.hypotheses).map((d, i) => (
                                                        <div key={i} style={{
                                                            padding: 'var(--space-sm)',
                                                            marginBottom: 'var(--space-xs)',
                                                            background: 'var(--gray-50)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            borderRight: `4px solid ${d.probability === 'عالية' ? 'var(--success-500)' : d.probability === 'متوسطة' ? 'var(--warning-500)' : 'var(--gray-400)'}`
                                                        }}>
                                                            <div style={{ fontWeight: '600' }}>{d.name || d.diagnosis}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                                                                <span className="badge" style={{
                                                                    background: d.probability === 'عالية' ? 'var(--success-100)' : d.probability === 'متوسطة' ? 'var(--warning-100)' : 'var(--gray-100)',
                                                                    color: d.probability === 'عالية' ? 'var(--success-700)' : d.probability === 'متوسطة' ? 'var(--warning-700)' : 'var(--gray-600)'
                                                                }}>
                                                                    احتمالية {d.probability}
                                                                </span>
                                                                {d.reasoning && <span style={{ marginRight: 'var(--space-sm)' }}>{d.reasoning}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Additional Notes */}
                                        {aiAnalysis.additionalNotes && (
                                            <div style={{ padding: 'var(--space-md)', background: 'var(--warning-50)', borderRadius: 'var(--radius-md)', borderRight: '4px solid var(--warning-500)' }}>
                                                <strong style={{ color: 'var(--warning-700)' }}>⚠️ Notes supplémentaires:</strong>
                                                <p style={{ marginTop: 'var(--space-xs)' }}>{aiAnalysis.additionalNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Medications List */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="card-title">💊 Prescription</h2>
                            <Button variant="primary" onClick={addMedication} style={{ padding: 'var(--space-xs) var(--space-md)' }}>
                                + Ajouter médicament
                            </Button>
                        </div>
                        <div className="card-body">
                            {medications.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    {medications.map((med, index) => (
                                        <div
                                            key={med.id}
                                            draggable
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '30px 1fr 100px 120px 80px 1fr 40px',
                                                gap: 'var(--space-sm)',
                                                padding: 'var(--space-sm)',
                                                background: draggedMedIndex === index ? 'var(--primary-50)' : 'var(--gray-50)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'grab',
                                                alignItems: 'center',
                                                border: '1px solid var(--gray-200)'
                                            }}
                                        >
                                            <span style={{ cursor: 'grab', color: 'var(--gray-400)' }}>≡</span>
                                            <input
                                                type="text"
                                                value={med.name}
                                                onChange={(e) => updateMedication(med.id, 'name', e.target.value)}
                                                placeholder="Nom du médicament"
                                                className="form-input"
                                                style={{ padding: 'var(--space-xs)' }}
                                            />
                                            <input
                                                type="text"
                                                value={med.dosage}
                                                onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)}
                                                placeholder="Dosage"
                                                className="form-input"
                                                style={{ padding: 'var(--space-xs)' }}
                                            />
                                            <input
                                                type="text"
                                                value={med.frequency}
                                                onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)}
                                                placeholder="Fréquence"
                                                className="form-input"
                                                style={{ padding: 'var(--space-xs)' }}
                                            />
                                            <input
                                                type="text"
                                                value={med.duration}
                                                onChange={(e) => updateMedication(med.id, 'duration', e.target.value)}
                                                placeholder="Durée"
                                                className="form-input"
                                                style={{ padding: 'var(--space-xs)' }}
                                            />
                                            <button
                                                onClick={() => removeMedication(med.id)}
                                                style={{
                                                    background: 'var(--error-100)',
                                                    color: 'var(--error-600)',
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    padding: 'var(--space-xs)',
                                                    fontSize: '1rem'
                                                }}
                                                title="Supprimer"
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--gray-500)', textAlign: 'center' }}>Aucun médicament. Cliquez sur "Ajouter médicament" pour en ajouter un.</p>
                            )}
                        </div>
                    </div>

                    {/* Doctor Diagnosis */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">📝 Diagnostic et Prescription</h2>
                        </div>
                        <div className="card-body">
                            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
                            {success && <div className="alert alert-success" style={{ marginBottom: 'var(--space-md)' }}>{success}</div>}

                            <div className="form-group">
                                <label className="form-label">Diagnostic *</label>
                                <textarea
                                    value={diagnosis}
                                    onChange={(e) => setDiagnosis(e.target.value)}
                                    className="form-input"
                                    rows="4"
                                    placeholder="Entrez votre diagnostic..."
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap', marginTop: 'var(--space-md)' }}>
                                <Button
                                    variant="primary"
                                    onClick={handleSaveReview}
                                    loading={saving}
                                    disabled={caseData.status === 'closed'}
                                >
                                    {caseData.status === 'reviewed' ? 'Mettre à jour' : 'Enregistrer le diagnostic'}
                                </Button>

                                {caseData.status === 'reviewed' && (
                                    <Button
                                        variant="secondary"
                                        onClick={handleDownloadPdf}
                                        loading={downloadingPdf}
                                    >
                                        📄 Télécharger l'ordonnance
                                    </Button>
                                )}

                                {autoSaving && (
                                    <span style={{ fontSize: '0.875rem', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                                        ⏳ Enregistrement automatique...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default CaseDetails;
