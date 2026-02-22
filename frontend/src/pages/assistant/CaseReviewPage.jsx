/**
 * Case Review Page (Assistant)
 * Review and submit case before sending to doctor
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import caseService from '../../services/caseService';
import translations from '../../constants/translations';
import { DOCUMENT_TYPES, CASE_STATUS, UPLOAD_URL } from '../../constants/config';
import { showSuccess, showError, showConfirm } from '../../utils/toast';
import CheckIcon from '@mui/icons-material/Check';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

const t = translations;

function CaseReviewPage() {
    const { caseId } = useParams();
    const navigate = useNavigate();

    // State
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Derived state
    const isReadOnly = caseData?.status && caseData.status !== CASE_STATUS.IN_PROGRESS;

    // Load case
    useEffect(() => {
        loadCase();
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
        const file = e.target.files[0];
        if (!file) return;

        const documentType = e.target.dataset.type;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('documentType', documentType);

            const response = await caseService.uploadDocument(caseId, formData);
            if (response.success) {
                // Reload case to get updated documents
                await loadCase();
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
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
            }
        } catch (error) {
            console.error('Delete document error:', error);
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
            showError(error.message || t.errors.serverError);
        } finally {
            setSubmitting(false);
        }
    }

    // Get document type label
    function getDocTypeLabel(type) {
        return t.documents.types[type] || type;
    }

    return (
        <div className="layout">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <h1 className="page-title">{t.assistant.review}</h1>
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
                        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                            {/* Patient info */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{t.patient.title}</h2>
                                    {isReadOnly && (
                                        <span className="badge badge-gray" style={{ background: 'var(--primary-color)', color: 'white' }}>
                                            {caseData.status === CASE_STATUS.SUBMITTED ? 'Soumis' :
                                                caseData.status === CASE_STATUS.REVIEWED ? 'Revu' :
                                                    caseData.status === CASE_STATUS.CLOSED ? 'Clôturé' : caseData.status}
                                        </span>
                                    )}
                                </div>
                                <div className="card-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
                                        <div>
                                            <strong>{t.patient.firstName}:</strong><br />
                                            {caseData.patient?.firstName || caseData.patient?.first_name}
                                        </div>
                                        <div>
                                            <strong>{t.patient.lastName}:</strong><br />
                                            {caseData.patient?.lastName || caseData.patient?.last_name}
                                        </div>
                                        <div>
                                            <strong>{t.patient.age}:</strong><br />
                                            {caseData.patient?.age} ans
                                        </div>
                                        <div>
                                            <strong>{t.patient.phone}:</strong><br />
                                            {caseData.patient?.phone}
                                        </div>
                                    </div>
                                </div>

                                {/* Documents - moved above answers */}
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">{t.documents.title}</h2>
                                    </div>
                                    <div className="card-body">
                                        {/* Upload section */}
                                        {!isReadOnly && (
                                            <>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                    gap: 'var(--space-md)',
                                                    marginBottom: 'var(--space-lg)'
                                                }}>
                                                    {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
                                                        <label key={key} className="upload-zone">
                                                            <input
                                                                type="file"
                                                                accept="image/*,.pdf"
                                                                data-type={value}
                                                                onChange={handleFileUpload}
                                                                style={{ display: 'none' }}
                                                            />
                                                            <div className="upload-zone-content">
                                                                <InsertDriveFileIcon style={{ fontSize: '2.5rem', color: 'var(--primary-400)' }} />
                                                                <span>{getDocTypeLabel(value)}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                                                                    Cliquez pour ajouter
                                                                </span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>

                                                {uploading && (
                                                    <div className="flex justify-center" style={{ marginBottom: 'var(--space-md)' }}>
                                                        <LoadingSpinner size="sm" text="Téléchargement..." />
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Uploaded documents */}
                                        {caseData.documents && caseData.documents.length > 0 ? (
                                            <div>
                                                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Documents téléchargés:</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                                    {caseData.documents.map(doc => (
                                                        <div
                                                            key={doc.id}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                padding: 'var(--space-sm) var(--space-md)',
                                                                background: 'var(--gray-50)',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                        >
                                                            <span>
                                                                <a
                                                                    href={`${UPLOAD_URL}/${doc.file_path || doc.filePath}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
                                                                    onClick={(e) => isReadOnly && e.stopPropagation()}
                                                                >
                                                                    <AttachFileIcon fontSize="small" style={{ marginRight: '4px' }} />
                                                                    <span style={{ textDecoration: 'underline' }}>{doc.file_name || doc.fileName}</span>
                                                                </a>
                                                                <span className="badge badge-gray" style={{ marginLeft: 'var(--space-sm)' }}>
                                                                    {getDocTypeLabel(doc.document_type || doc.documentType)}
                                                                </span>
                                                            </span>
                                                            {!isReadOnly && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                                >
                                                                    <DeleteIcon color="error" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : isReadOnly && (
                                            <div style={{
                                                padding: 'var(--space-lg)',
                                                textAlign: 'center',
                                                color: 'var(--gray-500)',
                                                background: 'var(--gray-50)',
                                                borderRadius: 'var(--radius-md)',
                                                fontStyle: 'italic'
                                            }}>
                                                Aucun document médical
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Answers summary */}
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">{t.case.answers}</h2>
                                    </div>
                                    <div className="card-body">
                                        {caseData.answers && caseData.answers.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                                {caseData.answers.map((answer, idx) => (
                                                    <div key={idx} style={{
                                                        padding: 'var(--space-md)',
                                                        background: 'var(--gray-50)',
                                                        borderRadius: 'var(--radius-md)'
                                                    }}>
                                                        <div style={{ fontWeight: '500', marginBottom: 'var(--space-xs)' }}>
                                                            {answer.question?.question_text || `Question ${idx + 1}`}
                                                        </div>
                                                        <div style={{ color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {answer.transcribed_text ? (
                                                                <>{answer.transcribed_text}</>
                                                            ) : (
                                                                <>
                                                                    <CheckIcon color="success" fontSize="small" />
                                                                    <span>Réponse enregistrée</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--gray-500)' }}>Aucune réponse enregistrée</p>
                                        )}
                                    </div>
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
