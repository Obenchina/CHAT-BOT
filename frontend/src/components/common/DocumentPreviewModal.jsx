import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { getAuthUploadUrl } from '../../constants/config';

function getDocumentName(document) {
    return document?.fileName || document?.file_name || document?.name || 'Document';
}

function getDocumentPath(document) {
    return document?.filePath || document?.file_path || document?.path || '';
}

function getDocumentKind(name, type) {
    const lowerName = String(name || '').toLowerCase();
    const lowerType = String(type || '').toLowerCase();
    if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
    if (lowerType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName)) return 'image';
    return 'unknown';
}

function DocumentPreviewModal({ document, isOpen, onClose }) {
    const [previewUrl, setPreviewUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const name = getDocumentName(document);
    const path = getDocumentPath(document);
    const kind = getDocumentKind(name, document?.mimeType || document?.mime_type || document?.type);

    useEffect(() => {
        if (!isOpen || !path) {
            setPreviewUrl('');
            setError('');
            setLoading(false);
            return undefined;
        }

        let objectUrl = '';
        let cancelled = false;

        async function loadDocument() {
            setLoading(true);
            setError('');
            setPreviewUrl('');

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(getAuthUploadUrl(path), {
                    credentials: 'include',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });

                if (!response.ok) {
                    throw new Error('Impossible de charger ce document.');
                }

                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                if (!cancelled) setPreviewUrl(objectUrl);
            } catch (previewError) {
                console.error('Document preview error:', previewError);
                if (!cancelled) {
                    setError(previewError?.message || 'Impossible de charger ce document.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadDocument();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [isOpen, path]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={name}
            fullscreen
            bodyStyle={{ padding: 0, overflow: 'hidden' }}
            modalStyle={{ background: 'var(--bg-card)' }}
            footer={(
                <Button variant="secondary" onClick={onClose}>
                    Fermer
                </Button>
            )}
        >
            <div style={{
                minHeight: 'calc(100vh - 140px)',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-md)',
                background: 'var(--bg-app)',
                boxSizing: 'border-box'
            }}>
                {loading ? (
                    <LoadingSpinner size="md" text="Chargement du document..." />
                ) : error ? (
                    <div className="alert alert-error" style={{ maxWidth: 560 }}>
                        {error}
                    </div>
                ) : !previewUrl ? (
                    <div style={{ color: 'var(--text-secondary)' }}>Aucun aperçu disponible.</div>
                ) : kind === 'pdf' ? (
                    <iframe
                        title={`Aperçu ${name}`}
                        src={previewUrl}
                        style={{
                            width: '100%',
                            height: 'calc(100vh - 172px)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            background: '#fff'
                        }}
                    />
                ) : kind === 'image' ? (
                    <img
                        src={previewUrl}
                        alt={name}
                        style={{
                            maxWidth: '100%',
                            maxHeight: 'calc(100vh - 172px)',
                            objectFit: 'contain',
                            borderRadius: 'var(--radius-md)',
                            background: '#fff',
                            boxShadow: 'var(--shadow-lg)'
                        }}
                    />
                ) : (
                    <div className="alert alert-info" style={{ maxWidth: 560 }}>
                        Ce type de fichier ne peut pas être prévisualisé dans le navigateur.
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default DocumentPreviewModal;
