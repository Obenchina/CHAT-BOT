/**
 * Case Review Page (Assistant)
 * Review and submit case before sending to doctor
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DocumentPreviewModal from '../../components/common/DocumentPreviewModal';
import caseService from '../../services/caseService';
import translations from '../../constants/translations';
import { DOCUMENT_TYPES, CASE_STATUS } from '../../constants/config';
import { showSuccess, showError, showConfirm } from '../../utils/toast';
import { computeAgeDisplay, formatDateOnlyDisplay } from '../../utils/patientAge';
import { getTextAlign, getTextDirection, isRtlText } from '../../utils/textDirection';
import CheckIcon from '@mui/icons-material/Check';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const t = translations;

function CaseReviewPage() {
    const { caseId } = useParams();
    const navigate = useNavigate();

    // State
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);

    // Derived state
    const isReadOnly = caseData?.status && caseData.status !== CASE_STATUS.IN_PROGRESS;

    // Load case
    useEffect(() => {
        loadCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId]);

    async function loadCase(retryCount = 0) {
        try {
            const response = await caseService.getById(caseId);
            if (response.success) {
                // If in progress and no answers, might be a race condition from backend
                // Retry a few times before showing empty state
                if (response.data.status === CASE_STATUS.IN_PROGRESS &&
                    (!response.data.answers || response.data.answers.length === 0) &&
                    retryCount < 3) {
                    console.log(`No answers found, retrying... (${retryCount + 1}/3)`);
                    setTimeout(() => loadCase(retryCount + 1), 1000);
                    return;
                }
                setCaseData(response.data);
            }
        } catch (error) {
            console.error('Load case error:', error);
        } finally {
            // Only stop loading if we are keeping the data (not retrying)
            // We know we are retrying if: in_progress && no_answers && retryCount < 3
            // Since we returned early above, reaching here means we are DONE (either success with data, success with empty after retries, or error)
            setLoading(false);
        }
    }

    // Handle file upload
    async function handleFileUpload(e) {
        if (isReadOnly) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setUploading(true);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('document', file);
                formData.append('documentType', 'general');

                await caseService.uploadDocument(caseId, formData);
            }
            // Reload case to get updated documents
            await loadCase();
            showSuccess('Document(s) ajoute(s) avec succes');
        } catch (error) {
            console.error('Upload error:', error);
            showError(error.message || 'Erreur lors du téléchargement');
        } finally {
            setUploading(false);
            // reset input
            e.target.value = null;
        }
    }

    // Delete document
    async function handleDeleteDocument(docId) {
        if (isReadOnly) return;
        const confirmed = await showConfirm('Supprimer ce document ?');
        if (!confirmed) return;

        try {
            const response = await caseService.deleteDocument(caseId, docId);
            if (response.success) {
                setCaseData(prev => ({
                    ...prev,
                    documents: prev.documents.filter(d => d.id !== docId)
                }));
                showSuccess('Document supprime');
            }
        } catch (error) {
            console.error('Delete document error:', error);
            showError('Erreur lors de la suppression');
        }
    }

    // Submit case
    async function handleSubmit() {
        if (isReadOnly) return;
        const confirmed = await showConfirm('Soumettre ce cas au médecin ? Vous ne pourrez plus le modifier.');
        if (!confirmed) return;

        setSubmitting(true);
        try {
            const response = await caseService.submit(caseId);
            if (response.success) {
                showSuccess(t.case.caseSubmitted);
                navigate('/assistant/patients');
            }
        } catch (error) {
            console.error('Submit error:', error);
            if (error.code === 'MISSING_API_KEY' || error.code === 'QUOTA_EXCEEDED' || error.code === 'API_ERROR') {
                showError(error.message);
            } else {
                showError(error.message || t.errors.serverError);
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="layout internal-shell case-review-shell">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <Button
                            variant="ghost"
                            className="page-back-button"
                            onClick={() => {
                                if (caseData?.patient?.id) {
                                    navigate(`/assistant/case/new/${caseData.patient.id}`);
                                } else {
                                    navigate('/assistant/patients');
                                }
                            }}
                            style={{ 
                                gap: '0.3rem', 
                                padding: '6px 16px',
                                background: 'white',
                                color: '#3B82F6',
                                border: '1px solid #3B82F6',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: '500'
                            }}
                        >
                            <ArrowBackIcon fontSize="small" /> Retour
                        </Button>
                        <h1 className="page-title" style={{ margin: 0 }}>{t.assistant.review}</h1>
                    </div>
                    {!isReadOnly && (
                        <Button
                            variant="success"
                            size="lg"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={loading}
                            style={{ gap: '0.5rem' }}
                        >
                            <CheckIcon /> {t.case.submitCase}
                        </Button>
                    )}
                </div>

                <div className="page-content">
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : caseData ? (
                        <div className="case-stack case-review-stack" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', maxWidth: '900px', margin: '0 auto' }}>
                            {/* 1. Patient info */}
                            <div className="card">
                                <div className="card-header border-b">
                                    <h2 className="card-title" style={{ fontSize: '1.1rem' }}>{t.patient.title}</h2>
                                    {isReadOnly && (
                                        <span className="badge badge-gray" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                            {caseData.status === CASE_STATUS.SUBMITTED ? 'Soumis' :
                                                caseData.status === CASE_STATUS.REVIEWED ? 'Revu' :
                                                    caseData.status === CASE_STATUS.CLOSED ? 'Cloture' : caseData.status}
                                        </span>
                                    )}
                                </div>
                                <div className="card-body">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-xs)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{t.patient.firstName} {t.patient.lastName}:</span>
                                            <strong style={{ textAlign: 'right' }}>{caseData.patient?.firstName || caseData.patient?.first_name} {caseData.patient?.lastName || caseData.patient?.last_name}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-xs)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Date de naissance:</span>
                                            <strong style={{ textAlign: 'right' }}>{formatDateOnlyDisplay(caseData.patient?.dateOfBirth || caseData.patient?.date_of_birth)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-xs)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Age:</span>
                                            <strong style={{ textAlign: 'right' }}>{computeAgeDisplay(caseData.patient?.dateOfBirth || caseData.patient?.date_of_birth).label}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{t.patient.phone}:</span>
                                            <strong style={{ textAlign: 'right' }}>{caseData.patient?.phone || '-'}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Answers section */}
                            <div className="card">
                                <div className="card-header border-b" style={{ paddingBottom: 'var(--space-sm)' }}>
                                    <h2 className="card-title">{t.case.answers}</h2>
                                </div>
                                <div className="card-body" style={{ padding: '0' }}>
                                    {caseData.answers && caseData.answers.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {caseData.answers.map((answer, idx) => {
                                                const questionText = answer.question_text || answer.question?.question_text || `Question ${idx + 1}`;
                                                const answerText = answer.text_answer || answer.textAnswer || answer.transcribed_text || '';
                                                const answerDirection = getTextDirection(answerText || questionText);
                                                const questionIsRtl = isRtlText(questionText);

                                                return (
                                                <div key={idx} style={{
                                                    padding: 'var(--space-lg)',
                                                    borderBottom: idx < caseData.answers.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)'
                                                }}>
                                                    <div style={{
                                                        fontWeight: '600',
                                                        marginBottom: 'var(--space-sm)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '1.05rem',
                                                        direction: questionIsRtl ? 'rtl' : 'ltr',
                                                        textAlign: questionIsRtl ? 'right' : 'left'
                                                    }}>
                                                        <span style={{ color: 'var(--primary)', marginInlineEnd: '8px' }}>Q{idx + 1}.</span>
                                                        {questionText}
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 'var(--space-sm)',
                                                        marginTop: 'var(--space-md)'
                                                    }}>
                                                        <div style={{
                                                            color: 'var(--text-secondary)',
                                                            padding: 'var(--space-md)',
                                                            background: 'var(--bg-card)',
                                                            borderRadius: 'var(--radius-md)',
                                                            border: '1px solid var(--border-color)',
                                                            direction: answerDirection,
                                                            textAlign: getTextAlign(answerText || questionText),
                                                            fontSize: '0.95rem',
                                                            lineHeight: '1.6'
                                                        }}>
                                                            {answerText ? (
                                                                <>{answerText}</>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: answerDirection === 'rtl' ? 'flex-end' : 'flex-start', fontStyle: 'italic' }}>
                                                                    <span>Réponse enregistrée vocalement</span>
                                                                    <CheckIcon color="success" fontSize="small" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                );
                                            })}
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
                                    <h2 className="card-title" style={{ fontSize: '1.1rem' }}>{t.documents.title}</h2>
                                </div>
                                <div className="card-body" style={{ padding: '0' }}>
                                    {/* Upload section */}
                                    {!isReadOnly && (
                                        <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)' }}>
                                            <label htmlFor="doc-upload" className="upload-zone" style={{ padding: 'var(--space-xl)', display: 'block', textAlign: 'center', cursor: 'pointer', border: '2px dashed var(--primary-300)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-component)', transition: 'all 0.2s' }}>
                                                <input
                                                    id="doc-upload"
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    multiple
                                                    onChange={handleFileUpload}
                                                    style={{ display: 'none' }}
                                                />
                                                <div className="upload-zone-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                    <InsertDriveFileIcon style={{ fontSize: '2.5rem', color: 'var(--primary)' }} />
                                                    <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                        Cliquez pour ajouter des documents medicaux
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        Images ou PDF pris en charge. Sélectionnez plusieurs fichiers si besoin.
                                                    </span>
                                                </div>
                                            </label>

                                            {uploading && (
                                                <div className="flex justify-center" style={{ marginTop: 'var(--space-md)' }}>
                                                    <LoadingSpinner size="sm" text="Téléchargement..." />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Uploaded documents */}
                                    {caseData.documents && caseData.documents.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {caseData.documents.map((doc, index) => (
                                                <div
                                                    key={doc.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: 'var(--space-sm) var(--space-md)',
                                                        borderBottom: index < caseData.documents.length - 1 ? '1px solid var(--border-color)' : 'none'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            style={{ border: 'none', background: 'transparent', padding: 0, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                            onClick={(e) => {
                                                                if (isReadOnly) e.stopPropagation();
                                                                setPreviewDocument(doc);
                                                            }}
                                                        >
                                                            <AttachFileIcon fontSize="small" style={{ marginRight: '4px', color: 'var(--primary)' }} />
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{doc.file_name || doc.fileName}</span>
                                                        </button>
                                                    </span>
                                                    {!isReadOnly && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="btn-icon"
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                        >
                                                            <DeleteIcon fontSize="small" color="error" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : isReadOnly && (
                                        <div style={{
                                            padding: 'var(--space-lg)',
                                            textAlign: 'center',
                                            color: 'var(--gray-500)',
                                            fontSize: '0.85rem',
                                            fontStyle: 'italic'
                                        }}>
                                            Aucun document médical
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-body text-center" style={{ color: 'var(--gray-500)' }}>
                                Cas non trouvé
                            </div>
                        </div>
                    )}
                </div>
            </main >

            <DocumentPreviewModal
                document={previewDocument}
                isOpen={Boolean(previewDocument)}
                onClose={() => setPreviewDocument(null)}
            />

            <style>{`
        .upload-zone {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-lg);
          border: 2px dashed var(--gray-300);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .upload-zone:hover {
          border-color: var(--primary-400);
          background: var(--primary-50);
        }
        
        .upload-zone-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
          text-align: center;
        }
      `}</style>
        </div >
    );
}

export default CaseReviewPage;


