/**
 * Case Details Page
 * Doctor views case details, answers, and writes diagnosis
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PatientIdentityBlock from '../../components/doctor/case/PatientIdentityBlock';
import CaseAnswersBlock from '../../components/doctor/case/CaseAnswersBlock';
import AiSummaryBlock from '../../components/doctor/case/AiSummaryBlock';
import api from '../../services/api';
import caseService from '../../services/caseService';
import doctorService from '../../services/doctorService';
import translations from '../../constants/translations';
import { getAuthUploadUrl } from '../../constants/config';
import AiChatPanel from '../../components/doctor/AiChatPanel';
import MedicationSearch from '../../components/doctor/MedicationSearch';
import aiChatService from '../../services/aiChatService';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import { showError } from '../../utils/toast';

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
    const [documentType, setDocumentType] = useState('ordonnance');
    const [allAnalyses, setAllAnalyses] = useState([]);
    const [selectedAnalyses, setSelectedAnalyses] = useState([]);
    const [letterContent, setLetterContent] = useState('');
    const [suggestingMeds, setSuggestingMeds] = useState(false);

    // Diagnostic voice dictation
    const [diagRecording, setDiagRecording] = useState(false);
    const [diagTranscribing, setDiagTranscribing] = useState(false);
    const diagRecorderRef = useRef(null);
    const diagChunksRef = useRef([]);

    // Refs for auto-save
    const autoSaveTimerRef = useRef(null);
    const lastSavedRef = useRef({ diagnosis: '', medications: [] });


    // Load case
    useEffect(() => {
        loadCase();
        loadDoctorConfigs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function loadDoctorConfigs() {
        try {
            const [analysesRes, letterRes] = await Promise.all([
                doctorService.getAnalysesConfig(),
                doctorService.getLetterConfig()
            ]);

            if (analysesRes.success && analysesRes.data && analysesRes.data.analysesList) {
                const list = analysesRes.data.analysesList.split('\n').map(a => a.trim()).filter(Boolean);
                setAllAnalyses(list);
            }

            if (letterRes.success && letterRes.data && letterRes.data.letterTemplate) {
                setLetterContent(letterRes.data.letterTemplate);
            }
        } catch (err) {
            console.error('Load doctor configs error:', err);
        }
    }

    async function loadCase() {
        try {
            const response = await caseService.getById(id);
            if (response.success) {
                setCaseData(response.data);
                setDiagnosis(response.data.doctor_diagnosis || response.data.doctorDiagnosis || '');

                // Initialize medications from saved prescription ONLY (AI no longer auto-suggests)
                if (response.data.doctor_prescription || response.data.doctorPrescription) {
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
        setError('');
        try {
            // Use the standard 'api' instance which already has the token interceptor
            const response = await api.get(`/cases/${id}/prescription/pdf`, {
                responseType: 'blob'
            });

            const blob = new Blob([response], { type: 'application/pdf' });
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

    async function startDiagRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            diagRecorderRef.current = recorder;
            diagChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data) diagChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                try {
                    setDiagTranscribing(true);
                    const blob = new Blob(diagChunksRef.current, { type: 'audio/webm' });
                    const res = await aiChatService.transcribe(blob);
                    if (res?.success) {
                        const text = res.data?.text ?? res.data?.data?.text ?? '';
                        const normalized = String(text || '').trim();
                        if (normalized) {
                            setDiagnosis(prev => (prev ? `${prev}\n${normalized}` : normalized));
                        }
                    } else {
                        showError(res?.message || 'Échec de la transcription audio');
                    }
                } catch (e) {
                    console.error('Diagnostic transcription error:', e);
                    showError(e?.message || 'Échec de la transcription audio');
                } finally {
                    setDiagTranscribing(false);
                    stream.getTracks().forEach(t => t.stop());
                }
            };

            recorder.start();
            setDiagRecording(true);
        } catch (e) {
            console.error('Mic permission error:', e);
            showError('Microphone غير متاح. تحقق من الصلاحيات.');
        }
    }

    function stopDiagRecording() {
        try {
            diagRecorderRef.current?.stop();
        } catch {
            // ignore
        }
        setDiagRecording(false);
    }

    // Download analyses PDF
    async function handleDownloadAnalysesPdf() {
        if (selectedAnalyses.length === 0) {
            setError('Veuillez selectionner au moins une analyse');
            return;
        }
        setDownloadingPdf(true);
        setError('');
        try {
            const selected = selectedAnalyses.join(',');
            const response = await api.get(`/cases/${id}/analyses/pdf`, {
                params: { selected },
                responseType: 'blob'
            });
            const blob = new Blob([response], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bilan_biologique_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download analyses PDF error:', err);
            setError('Erreur lors du telechargement du PDF');
        } finally {
            setDownloadingPdf(false);
        }
    }

    // Download letter PDF
    async function handleDownloadLetterPdf() {
        if (!letterContent.trim()) {
            setError('Veuillez remplir le contenu de la lettre');
            return;
        }
        setDownloadingPdf(true);
        setError('');
        try {
            const response = await api.get(`/cases/${id}/letter/pdf`, {
                params: { content: letterContent },
                responseType: 'blob'
            });
            const blob = new Blob([response], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lettre_orientation_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download letter PDF error:', err);
            setError('Erreur lors du telechargement du PDF');
        } finally {
            setDownloadingPdf(false);
        }
    }

    function toggleAnalysis(analysis) {
        setSelectedAnalyses(prev =>
            prev.includes(analysis)
                ? prev.filter(a => a !== analysis)
                : [...prev, analysis]
        );
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
            <div className="layout internal-shell case-details-shell">
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
            <div className="layout internal-shell case-details-shell">
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



    // Determine back path
    const backPath = location.state?.from === 'patients' ? '/doctor/patients' : '/doctor/dashboard';

    return (
        <div className="layout internal-shell case-details-shell">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <Button variant="secondary" className="page-back-button" onClick={() => navigate(backPath)}>
                            ← Retour
                        </Button>
                    </div>
                    <h1 className="page-title" style={{ marginLeft: 'var(--space-md)' }}>
                        Détails du cas
                    </h1>
                    {getStatusBadge(caseData.status)}
                </div>

                <div className="page-content">
                    <div className="case-stack case-details-stack" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', maxWidth: '900px', margin: '0 auto' }}>
                        {/* 1. Patient Info */}
                        <PatientIdentityBlock patient={patient} />

                        {/* 2. Questionnaire (grouped by section) */}
                        <CaseAnswersBlock answers={answers} patient={patient} />

                        {/* 3. AI Analysis */}
                        <AiSummaryBlock aiAnalysis={aiAnalysis} />

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
                                                    href={getAuthUploadUrl(doc.filePath || doc.file_path)}
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

                        {/* 5. Document Type Selector + Content */}
                        <div className="card">
                            <div className="card-header border-b">
                                <div style={{ display: 'flex', gap: '0', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                                    {[
                                        { key: 'ordonnance', icon: '💊', label: 'Ordonnance' },
                                        { key: 'analyses', icon: '🔬', label: 'Analyses' },
                                        { key: 'lettre', icon: '✉️', label: 'Lettre' }
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setDocumentType(tab.key)}
                                            style={{
                                                padding: 'var(--space-sm) var(--space-lg)',
                                                border: 'none',
                                                background: documentType === tab.key ? 'var(--primary)' : 'var(--bg-card)',
                                                color: documentType === tab.key ? 'white' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: documentType === tab.key ? '600' : '400',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <span>{tab.icon}</span> {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="card-body">
                                {/* Ordonnance Tab */}
                                {documentType === 'ordonnance' && (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Prescription</h3>
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                                <Button
                                                    variant="secondary"
                                                    onClick={async () => {
                                                        setSuggestingMeds(true);
                                                        try {
                                                            const res = await caseService.suggestMedications(id);
                                                            if (res.success && res.data && res.data.length > 0) {
                                                                const newMeds = res.data.map((m, i) => ({ ...m, id: Date.now() + i }));
                                                                setMedications(prev => [...prev, ...newMeds]);
                                                            }
                                                        } catch (e) { console.error(e); }
                                                        setSuggestingMeds(false);
                                                    }}
                                                    disabled={suggestingMeds}
                                                    style={{ padding: 'var(--space-xs) var(--space-md)', fontSize: '0.8rem' }}
                                                >
                                                    {suggestingMeds ? '⏳ IA...' : '🤖 Proposer via IA'}
                                                </Button>
                                                <Button variant="primary" onClick={addMedication} style={{ padding: 'var(--space-xs) var(--space-md)' }}>
                                                    + Ajouter
                                                </Button>
                                            </div>
                                        </div>
                                        <MedicationSearch onSelect={(med) => {
                                            setMedications(prev => [...prev, { ...med, id: Date.now() }]);
                                        }} />
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
                                                            <input type="text" value={med.dosage} onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)} placeholder="Dosage" className="form-input" style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)', fontSize: '0.8rem' }} />
                                                            <input type="text" value={med.frequency} onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)} placeholder="Fréq" className="form-input" style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)', fontSize: '0.8rem' }} />
                                                            <input type="text" value={med.duration} onChange={(e) => updateMedication(med.id, 'duration', e.target.value)} placeholder="Durée" className="form-input" style={{ flex: 1, minWidth: 0, padding: '0 var(--space-xs)', fontSize: '0.8rem' }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontSize: '0.85rem' }}>Aucun médicament prescrit.</p>
                                        )}
                                    </div>
                                )}

                                {/* Analyses Tab */}
                                {documentType === 'analyses' && (
                                    <div>
                                        <h3 style={{ margin: '0 0 var(--space-sm)', fontSize: '1rem', color: 'var(--text-primary)' }}>Bilan Biologique</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                                            Cochez les analyses souhaitées. Seules les analyses cochées apparaîtront dans le PDF.
                                        </p>
                                        {allAnalyses.length > 0 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-xs)' }}>
                                                {allAnalyses.map((analysis, i) => (
                                                    <label
                                                        key={i}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: 'var(--space-xs) var(--space-sm)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            cursor: 'pointer',
                                                            background: selectedAnalyses.includes(analysis) ? 'var(--primary-50)' : 'transparent',
                                                            border: selectedAnalyses.includes(analysis) ? '1px solid var(--primary-200)' : '1px solid transparent',
                                                            transition: 'all 0.15s',
                                                            fontSize: '0.88rem'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedAnalyses.includes(analysis)}
                                                            onChange={() => toggleAnalysis(analysis)}
                                                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                                        />
                                                        {analysis}
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                                                Aucune analyse configurée. Allez dans Paramètres &gt; Ordonnance PDF pour ajouter votre liste d'analyses.
                                            </p>
                                        )}
                                        {selectedAnalyses.length > 0 && (
                                            <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--primary-700)' }}>
                                                {selectedAnalyses.length} analyse(s)
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Lettre Tab */}
                                {documentType === 'lettre' && (
                                    <div>
                                        <h3 style={{ margin: '0 0 var(--space-sm)', fontSize: '1rem', color: 'var(--text-primary)' }}>Lettre d'Orientation</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                                            Modifiez la lettre ci-dessous avant de générer le PDF.
                                        </p>
                                        <textarea
                                            value={letterContent}
                                            onChange={(e) => setLetterContent(e.target.value)}
                                            className="form-input"
                                            rows="12"
                                            placeholder="Cher confrere,..."
                                            style={{ fontSize: '0.9rem', lineHeight: '1.7', width: '100%' }}
                                        />
                                    </div>
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
                                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                                        <span>Observation / Diagnostic *</span>
                                        <button
                                            type="button"
                                            onClick={() => (diagRecording ? stopDiagRecording() : startDiagRecording())}
                                            disabled={saving || diagTranscribing || caseData.status === 'closed'}
                                            className="btn btn-ghost btn-sm"
                                            style={{
                                                height: '28px',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                background: diagRecording ? 'var(--error-light)' : 'transparent',
                                                color: diagRecording ? 'var(--error)' : 'var(--text-secondary)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                            title={diagRecording ? 'Arrêter' : 'Dicter صوتياً'}
                                        >
                                            {diagRecording ? <StopIcon style={{ fontSize: '0.95rem' }} /> : <MicIcon style={{ fontSize: '0.95rem' }} />}
                                            {diagTranscribing ? '...' : 'Voice'}
                                        </button>
                                    </label>
                                    <textarea
                                        value={diagnosis}
                                        onChange={(e) => setDiagnosis(e.target.value)}
                                        className="form-input"
                                        rows="4"
                                        placeholder="Entrez votre diagnostic..."
                                        disabled={diagTranscribing}
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

                                    {documentType === 'ordonnance' && (
                                        <Button
                                            variant="secondary"
                                            onClick={handleDownloadPdf}
                                            loading={downloadingPdf}
                                            style={{ minWidth: '180px' }}
                                        >
                                            📄 Télécharger l'ordonnance
                                        </Button>
                                    )}

                                    {caseData.status === 'reviewed' && documentType === 'analyses' && (
                                        <Button
                                            variant="secondary"
                                            onClick={handleDownloadAnalysesPdf}
                                            loading={downloadingPdf}
                                            disabled={selectedAnalyses.length === 0}
                                        >
                                            📄 Télécharger le bilan
                                        </Button>
                                    )}

                                    {caseData.status === 'reviewed' && documentType === 'lettre' && (
                                        <Button
                                            variant="secondary"
                                            onClick={handleDownloadLetterPdf}
                                            loading={downloadingPdf}
                                            disabled={!letterContent.trim()}
                                        >
                                            📄 Télécharger la lettre
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

                        {/* AI Chat Panel */}
                        {caseData && caseData.status !== 'in_progress' && (
                            <AiChatPanel caseId={id} />
                        )}

                    </div>
                </div> {/* closes page-content */}
            </main>
        </div>
    );
}

export default CaseDetails;
