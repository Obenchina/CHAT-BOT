/**
 * GrowthCurveManager
 *
 * Settings panel for the doctor's growth-curve bank. Three things:
 *   1. Browse the built-in reference library (WHO/CDC/AFPA) and add curves to the bank.
 *   2. Upload an unknown curve image/PDF — the backend tries to match it to the library
 *      first, otherwise extracts percentile data via AI for review.
 *   3. List, preview (Recharts), approve/reject and delete saved curves.
 */
import { useEffect, useMemo, useState } from 'react';
import doctorService from '../../../services/doctorService';
import { showSuccess, showError } from '../../../utils/toast';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import GrowthCurveChart from '../../charts/GrowthCurveChart';
import ManualCurveEntryModal from './ManualCurveEntryModal';
import { API_URL } from '../../../constants/config';
import * as pdfjsLib from 'pdfjs-dist';

// Build a URL to the doctor-uploaded source image. The /uploads endpoint
// authenticates via cookie (withCredentials: true) or query token.
const UPLOADS_BASE = API_URL.replace(/\/api\/?$/, '');
function uploadUrl(relPath) {
    if (!relPath) return null;
    const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
    const token = localStorage.getItem('token');
    return `${UPLOADS_BASE}${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

async function renderPdfToImage(pdfFile) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

const MEASURE_LABEL = {
    weight: 'Poids',
    height: 'Taille',
    height_weight: 'Taille + Poids',
    head: 'Périmètre crânien',
    bmi: 'IMC',
};
const GENDER_LABEL = { male: 'Garçon', female: 'Fille', both: 'Mixte' };

const STATUS_BADGE = {
    auto_approved: { label: 'Référence officielle', color: '#10b981', bg: '#ecfdf5' },
    doctor_approved: { label: 'Approuvée', color: '#10b981', bg: '#ecfdf5' },
    pending_review: { label: 'À vérifier', color: '#f59e0b', bg: '#fffbeb' },
    rejected: { label: 'Rejetée', color: '#dc2626', bg: '#fef2f2' },
};

function CurveCard({ curve, onPreview, onDelete }) {
    const status = STATUS_BADGE[curve.validation_status] || STATUS_BADGE.auto_approved;
    return (
        <div
            className="profile-section-card"
            style={{ padding: 'var(--space-md)', border: `1px solid ${status.color}` }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {curve.label || `${MEASURE_LABEL[curve.measure_key] || curve.measure_key} - ${GENDER_LABEL[curve.gender] || curve.gender}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {curve.source || (curve.source_type === 'reference' ? 'Référence intégrée' : 'IA extraction')}
                    </div>
                    <span style={{
                        display: 'inline-block', marginTop: 8, padding: '2px 8px', borderRadius: 8,
                        fontSize: 11, color: status.color, background: status.bg,
                    }}>{status.label}</span>
                </div>
                <button
                    onClick={() => onDelete(curve)}
                    style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem' }}
                    aria-label="Supprimer la courbe"
                >×</button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Button size="sm" variant="ghost" onClick={() => onPreview(curve)}>Aperçu</Button>
            </div>
        </div>
    );
}

function GrowthCurveManager() {
    const [savedCurves, setSavedCurves] = useState([]);
    const [library, setLibrary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [adding, setAdding] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewCurve, setPreviewCurve] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [curveToDelete, setCurveToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const [manualOpen, setManualOpen] = useState(false);
    const [manualInitial, setManualInitial] = useState(null);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [savedRes, libRes] = await Promise.all([
                doctorService.getGrowthCurves(),
                doctorService.getGrowthCurvesLibrary(),
            ]);
            if (savedRes?.success) setSavedCurves(savedRes.data || []);
            if (libRes?.success) setLibrary(libRes.data || []);
        } catch (e) {
            console.error('Load curves error:', e);
            showError('Erreur de chargement');
        }
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAll();
    }, []);

    async function handleAddFromLibrary(referenceId) {
        setAdding(referenceId);
        try {
            const res = await doctorService.addCurveFromReference(referenceId);
            if (res?.success) {
                showSuccess('Courbe ajoutée');
                await loadAll();
            } else {
                showError(res?.message || 'Échec de l\'ajout');
            }
        } catch (e) {
            showError(e?.response?.data?.message || e?.message || 'Erreur');
        }
        setAdding(null);
    }

    async function handleUpload() {
        if (!selectedFile) return showError('Sélectionnez un fichier');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('curve', selectedFile);
            const isPdf = selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name);
            if (isPdf) {
                try {
                    const imgBlob = await renderPdfToImage(selectedFile);
                    fd.append('curveImage', imgBlob, selectedFile.name.replace(/\.pdf$/i, '.png'));
                } catch (e) {
                    console.warn('PDF→image failed:', e);
                }
            }
            const res = await doctorService.uploadGrowthCurve(fd);
            if (res?.success) {
                showSuccess(res.message || 'Courbe importée');
                setSelectedFile(null);
                await loadAll();
            } else {
                showError(res?.message || 'Échec de l\'import');
            }
        } catch (e) {
            showError(e?.response?.data?.message || e?.message || 'Erreur');
        }
        setUploading(false);
    }

    function requestDelete(curve) {
        setCurveToDelete(curve);
        setDeleteModalOpen(true);
    }

    async function confirmDelete() {
        if (!curveToDelete) return;
        setDeleting(true);
        try {
            const res = await doctorService.deleteGrowthCurve(curveToDelete.id);
            if (res?.success) {
                showSuccess('Courbe supprimée');
                setDeleteModalOpen(false);
                setCurveToDelete(null);
                await loadAll();
            } else {
                showError(res?.message || 'Erreur lors de la suppression');
            }
        } catch (e) {
            showError(e?.response?.data?.message || e?.message || 'Erreur');
        }
        setDeleting(false);
    }

    async function handleApprove(curveId, decision) {
        try {
            const res = await doctorService.reviewExtractedCurve(curveId, decision);
            if (res?.success) {
                showSuccess(decision === 'approved' ? 'Courbe approuvée' : 'Courbe rejetée');
                await loadAll();
                if (decision === 'approved') {
                    setPreviewCurve((prev) => (prev && prev.id === curveId ? res.data : prev));
                }
            }
        } catch (e) {
            showError(e?.response?.data?.message || e?.message || 'Erreur');
        }
    }

    const savedReferenceIds = useMemo(
        () => new Set(savedCurves.filter((c) => c.source_type === 'reference').map((c) => c.reference_id)),
        [savedCurves],
    );

    const filteredLibrary = useMemo(() => {
        const q = librarySearch.trim().toLowerCase();
        if (!q) return library;
        return library.filter((c) => (c.label || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q));
    }, [library, librarySearch]);

    return (
        <div className="growth-curve-manager">
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">Bibliothèque officielle (WHO / CDC / AFPA)</div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Ajoutez les courbes officielles que vous souhaitez utiliser. Les données sont intégrées au système — aucune image n'est utilisée pour le rendu.
                </p>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Rechercher (taille, poids, OMS, garçons…)"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    style={{ marginBottom: 12 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {filteredLibrary.map((entry) => {
                        const already = savedReferenceIds.has(entry.id);
                        return (
                            <div key={entry.id} className="profile-section-card" style={{ padding: 'var(--space-md)' }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {entry.source} • {GENDER_LABEL[entry.gender] || entry.gender}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {MEASURE_LABEL[entry.measure] || entry.measure} • {Math.round(entry.ageRange?.min / 12)}–{Math.round(entry.ageRange?.max / 12)} ans
                                </div>
                                <Button
                                    size="sm"
                                    variant={already ? 'ghost' : 'primary'}
                                    disabled={already || adding === entry.id}
                                    onClick={() => handleAddFromLibrary(entry.id)}
                                    style={{ marginTop: 10 }}
                                >
                                    {already ? 'Déjà ajoutée' : (adding === entry.id ? 'Ajout…' : 'Ajouter')}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">Importer une courbe inconnue</div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Glissez un PDF ou une image. Si le système reconnaît une courbe officielle, il l'ajoute automatiquement. Sinon il extrait les percentiles via IA et vous demande de valider le résultat.
                </p>
                <input
                    type="file"
                    className="input-field"
                    accept="image/*,application/pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    style={{ marginTop: 12, width: '100%' }}
                >
                    {uploading ? 'Analyse en cours…' : 'Importer'}
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px dashed #e5e7eb' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
                        Vous avez les valeurs sous la main (livre, table) ? Saisissez-les directement :
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => { setManualInitial(null); setManualOpen(true); }}>
                        Saisie manuelle
                    </Button>
                </div>
            </div>

            <div className="curves-list">
                <h4 style={{ marginBottom: 'var(--space-md)' }}>Mes courbes</h4>
                {!loading && savedCurves.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                        Aucune courbe enregistrée pour le moment.
                    </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {savedCurves.map((c) => (
                        <CurveCard key={c.id} curve={c} onPreview={setPreviewCurve} onDelete={requestDelete} />
                    ))}
                </div>
            </div>

            <Modal
                isOpen={Boolean(previewCurve)}
                onClose={() => setPreviewCurve(null)}
                title={previewCurve?.label || 'Aperçu de la courbe'}
                size="lg"
            >
                {previewCurve && (
                    <div>
                        {previewCurve.original_image_path && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Source originale</div>
                                    <img
                                        src={uploadUrl(previewCurve.original_image_path)}
                                        alt="Source"
                                        style={{ width: '100%', maxHeight: 480, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6 }}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Reproduction (Recharts)</div>
                                    <GrowthCurveChart curve={previewCurve.curve_data} height={480} />
                                </div>
                            </div>
                        )}
                        {!previewCurve.original_image_path && (
                            <GrowthCurveChart curve={previewCurve.curve_data} height={520} />
                        )}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap' }}>
                            {previewCurve.curve_data && previewCurve.source_type !== 'reference' && (
                                <Button variant="ghost" size="sm" onClick={() => { setManualInitial(previewCurve); setPreviewCurve(null); setManualOpen(true); }}>
                                    Modifier les valeurs
                                </Button>
                            )}
                            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                {previewCurve.validation_status === 'pending_review' && (
                                    <>
                                        <Button variant="danger" onClick={() => handleApprove(previewCurve.id, 'rejected')}>Rejeter</Button>
                                        <Button onClick={() => handleApprove(previewCurve.id, 'approved')}>Approuver</Button>
                                    </>
                                )}
                                {previewCurve.validation_status === 'rejected' && previewCurve.curve_data && (
                                    <Button onClick={() => handleApprove(previewCurve.id, 'approved')}>
                                        Approuver malgré les avertissements
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ManualCurveEntryModal
                isOpen={manualOpen}
                onClose={() => setManualOpen(false)}
                onSaved={() => loadAll()}
                initialCurve={manualInitial}
            />

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => !deleting && setDeleteModalOpen(false)}
                title="Supprimer la courbe ?"
                size="sm"
            >
                <p>Cette action est irréversible.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                    <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>Annuler</Button>
                    <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                        {deleting ? 'Suppression…' : 'Supprimer'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

export default GrowthCurveManager;
