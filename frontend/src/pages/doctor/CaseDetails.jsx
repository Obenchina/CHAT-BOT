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
    const location = useLocation();

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', maxWidth: '900px', margin: '0 auto' }}>
                        {/* 1. Patient Info */}
                        <div className="card">
                            <div className="card-header border-b">
                                <h2 className="card-title" style={{ fontSize: '1.1rem' }}>👤 Informations du patient</h2>
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-xs)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Nom:</span>
                                        <strong style={{ textAlign: 'right' }}>{patient.first_name || patient.firstName} {patient.last_name || patient.lastName}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-xs)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Genre:</span>
                                        <strong style={{ textAlign: 'right' }}>{patient.gender === 'male' ? 'Homme' : patient.gender === 'female' ? 'Femme' : '-'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-xs)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Âge:</span>
                                        <strong style={{ textAlign: 'right' }}>{patient.age || '-'} ans</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Téléphone:</span>
                                        <strong style={{ textAlign: 'right' }}>{patient.phone || '-'}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Questionnaire */}
                        <div className="card">
                            <div className="card-header border-b" style={{ paddingBottom: 'var(--space-sm)' }}>
                                <h2 className="card-title">📋 Questionnaire</h2>
                            </div>
                            <div className="card-body" style={{ padding: '0' }}>
                                {answers.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {answers.map((answer, index) => (
                                            <div key={answer.id || index} style={{
                                                padding: 'var(--space-lg)',
                                                borderBottom: index < answers.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                background: index % 2 === 0 ? 'transparent' : 'var(--bg-elevated)'
                                            }}>
                                                <div style={{ fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                                                    <span style={{ color: 'var(--primary)', marginRight: '8px' }}>Q{index + 1}.</span>
                                                    {answer.question_text || answer.questionText}
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                                                    {/* Audio player if audio exists */}
                                                    {(answer.audio_path || answer.audioPath) && (
                                                        <div style={{ background: 'var(--bg-card)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', display: 'inline-block', width: 'fit-content' }}>
                                                            <audio controls style={{ height: '36px', width: '250px' }}>
                                                                <source src={`${UPLOAD_URL}/${answer.audio_path || answer.audioPath}`} type="audio/webm" />
                                                            </audio>
                                                        </div>
                                                    )}

                                                    {/* Transcribed text (Right aligned for Arabic) */}
                                                    <div style={{
                                                        color: 'var(--text-secondary)',
                                                        padding: 'var(--space-md)',
                                                        background: 'var(--bg-card)',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border-color)',
                                                        fontStyle: (answer.transcribed_text || answer.transcribedText) ? 'normal' : 'italic',
                                                        direction: 'rtl',
                                                        textAlign: 'right',
                                                        fontSize: '0.95rem',
                                                        lineHeight: '1.6'
                                                    }}>
                                                        {(answer.transcribed_text || answer.transcribedText) ||
                                                            (answer.audio_path || answer.audioPath ? 'في انتظار نسخ النص...' : 'لا توجد إجابة')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: 'var(--space-2xl) var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Aucune réponse enregistrée
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Documents */}
                        <div className="card">
                            <div className="card-header border-b">
                                <h2 className="card-title" style={{ fontSize: '1.1rem' }}>📎 Documents</h2>
                            </div>
                            <div className="card-body" style={{ padding: '0' }}>
                                {documents.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {documents.map((doc, index) => (
                                            <div key={doc.id || index} style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                borderBottom: index < documents.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)'
                                            }}>
                                                <span style={{ fontSize: '1.2rem' }}>📄</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: '500', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {doc.fileName || doc.file_name || 'Document'}
                                                    </div>
                                                </div>
                                                <a
                                                    href={`${UPLOAD_URL}/${doc.filePath || doc.file_path}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost btn-icon btn-sm"
                                                    title="Voir le document"
                                                >
                                                    👁️
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ padding: 'var(--space-md)', color: 'var(--gray-500)', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>Aucun document</p>
                                )}
                            </div>
                        </div>

                        {/* 4. AI Analysis */}
                        {aiAnalysis && (
                            <div className="card" style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
                                <div className="card-header border-b" style={{ borderBottomColor: 'var(--primary-100)' }}>
                                    <h2 className="card-title" style={{ color: 'var(--primary-700)', fontSize: '1.1rem' }}>🤖 Analyse IA</h2>
                                </div>
                                <div className="card-body">
                                    {typeof aiAnalysis === 'string' ? (
                                        <p>{aiAnalysis}</p>
                                    ) : (
                                        <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                            {/* Summary */}
                                            {aiAnalysis.summary && (
                                                <div>
                                                    <p style={{ marginTop: '0', lineHeight: '1.6', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{aiAnalysis.summary}</p>
                                                </div>
                                            )}

                                            {/* Diagnoses */}
                                            {(aiAnalysis.diagnoses || aiAnalysis.hypotheses) && (aiAnalysis.diagnoses || aiAnalysis.hypotheses).length > 0 && (
                                                <div style={{ marginTop: 'var(--space-md)' }}>
                                                    <strong style={{ color: 'var(--primary-700)', fontSize: '0.9rem' }}>🔬 Diagnostics:</strong>
                                                    <div style={{ marginTop: 'var(--space-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                                        {(aiAnalysis.diagnoses || aiAnalysis.hypotheses).map((d, i) => (
                                                            <div key={i} style={{
                                                                padding: 'var(--space-xs) var(--space-sm)',
                                                                background: 'var(--bg-elevated)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                borderRight: `3px solid ${d.probability === 'عالية' ? 'var(--success)' : d.probability === 'متوسطة' ? 'var(--warning)' : 'var(--gray-400)'}`,
                                                                fontSize: '0.85rem',
                                                                color: 'var(--text-primary)'
                                                            }}>
                                                                <div style={{ fontWeight: '600' }}>{d.name || d.diagnosis}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 5. Prescription List */}
                        <div className="card">
                            <div className="card-header border-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 'var(--space-xs)',
                                                    padding: 'var(--space-sm)',
                                                    background: draggedMedIndex === index ? 'var(--primary-50)' : 'var(--bg-elevated)',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'grab',
                                                    border: '1px solid var(--border-color)',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                                    <span style={{ cursor: 'grab', color: 'var(--gray-400)', width: '20px', textAlign: 'center' }}>≡</span>
                                                    <input
                                                        type="text"
                                                        value={med.name}
                                                        onChange={(e) => updateMedication(med.id, 'name', e.target.value)}
                                                        placeholder="Nom du médicament"
                                                        className="form-input"
                                                        style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)' }}
                                                    />
                                                    <button
                                                        onClick={() => removeMedication(med.id)}
                                                        style={{
                                                            background: 'var(--error-100)',
                                                            color: 'var(--error-600)',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-sm)',
                                                            cursor: 'pointer',
                                                            padding: '0',
                                                            fontSize: '1rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '32px',
                                                            height: '32px',
                                                            flexShrink: 0
                                                        }}
                                                        title="Supprimer"
                                                    >
                                                        🗑
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', gap: 'var(--space-xs)', paddingLeft: '28px' }}>
                                                    <input
                                                        type="text"
                                                        value={med.dosage}
                                                        onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)}
                                                        placeholder="Dosage"
                                                        className="form-input"
                                                        style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)', fontSize: '0.8rem' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={med.frequency}
                                                        onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)}
                                                        placeholder="Fréq"
                                                        className="form-input"
                                                        style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)', fontSize: '0.8rem' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={med.duration}
                                                        onChange={(e) => updateMedication(med.id, 'duration', e.target.value)}
                                                        placeholder="Durée"
                                                        className="form-input"
                                                        style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)', fontSize: '0.8rem' }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontSize: '0.85rem' }}>Aucun médicament prescrit.</p>
                                )}
                            </div>
                        </div>

                        {/* 6. Diagnostic */}
                        <div className="card">
                            <div className="card-header border-b">
                                <h2 className="card-title">📝 Diagnostic</h2>
                            </div>
                            <div className="card-body">
                                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
                                {success && <div className="alert alert-success" style={{ marginBottom: 'var(--space-md)' }}>{success}</div>}

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Observation / Diagnostic *</label>
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
                </div> {/* closes page-content */}
            </main>
        </div>
    );
}

export default CaseDetails;
