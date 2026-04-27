import React, { useState, useEffect } from 'react';
import doctorService from '../../../services/doctorService';
import { getAuthUploadUrl } from '../../../constants/config';
import { showSuccess, showError } from '../../../utils/toast';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

function GrowthCurveManager() {
    const [curves, setCurves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [measureKey, setMeasureKey] = useState('weight');
    const [gender, setGender] = useState('both');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [curveToDelete, setCurveToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [previewCurve, setPreviewCurve] = useState(null);

    useEffect(() => {
        loadCurves();
    }, []);

    async function loadCurves() {
        setLoading(true);
        try {
            const res = await doctorService.getGrowthCurves();
            if (res.success) setCurves(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function handleUpload() {
        if (!selectedFile) return showError("Sélectionnez un fichier");
        setUploading(true);
        const fd = new FormData();
        fd.append('curve', selectedFile);
        fd.append('measureKey', measureKey);
        fd.append('gender', gender);
        
        try {
            const res = await doctorService.uploadGrowthCurve(fd);
            if (res.success) {
                setSelectedFile(null);
                await loadCurves();
                const count = Array.isArray(res.data) ? res.data.length : 1;
                showSuccess(count > 1 ? `${count} courbes extraites du PDF.` : (res.message || "Référence personnalisée ajoutée."));
            }
        } catch (e) { showError(e.message); }
        setUploading(false);
    }

    function requestDeleteCurve(curve) {
        setCurveToDelete(curve);
        setDeleteModalOpen(true);
    }

    function openPreviewCurve(curve) {
        setPreviewCurve(curve);
    }

    async function confirmDeleteCurve() {
        if (!curveToDelete) return;
        setDeleting(true);
        try {
            const res = await doctorService.deleteGrowthCurve(curveToDelete.id);
            if (res?.success) {
                showSuccess('Courbe supprimée');
                setDeleteModalOpen(false);
                setCurveToDelete(null);
                await loadCurves();
            } else {
                showError(res?.message || 'Erreur lors de la suppression');
            }
        } catch (e) {
            console.error('deleteGrowthCurve error:', e);
            showError(e?.response?.data?.message || e?.message || 'Erreur de connexion');
        } finally {
            setDeleting(false);
        }
    }

    const MEASURE_LABELS = {
        weight: 'Poids (kg)',
        height: 'Taille (cm)',
        head: 'PC (cm)',
        bmi: 'IMC'
    };

    const GENDER_LABELS = {
        male: 'Garcon',
        female: 'Fille',
        both: 'Mixte'
    };

    const officialCurves = (curves || []).filter(c => c.source_type === 'official');
    const customCurves = (curves || []).filter(c => c.source_type !== 'official');

    return (
        <div className="growth-curve-manager">
            {/* Official templates */}
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">Templates officiels pre-calibres</div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Ces templates sont calibres cote developpeur. Aucune calibration manuelle n'est autorisee cote medecin.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
                    {officialCurves.map(c => (
                        <div key={c.id} className="profile-section-card" style={{ padding: 'var(--space-md)', border: '1px solid var(--success)' }}>
                            <div style={{ fontWeight: 'bold' }}>{c.display_name || c.template_key}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Type: {MEASURE_LABELS[c.measure_key] || c.measure_key}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Sexe: {GENDER_LABELS[c.gender] || c.gender}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '6px' }}>
                                Trace patient autorise (template officiel)
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Personal uploads */}
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">Reference personnalisee (PDF/Image)</div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Uploadez un PDF ou une image. Pour les PDF AFPA propres, MediConsult extrait les courbes et autorise le trace patient automatiquement. Sinon le fichier reste une reference visuelle.
                </p>

                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                        <label>Type de mesure</label>
                        <select className="input-field" value={measureKey} onChange={e => setMeasureKey(e.target.value)}>
                            <option value="weight">Poids</option>
                            <option value="height">Taille</option>
                            <option value="head">Perimetre cranien</option>
                            <option value="bmi">IMC</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Sexe</label>
                        <select className="input-field" value={gender} onChange={e => setGender(e.target.value)}>
                            <option value="both">Mixte</option>
                            <option value="male">Garcon</option>
                            <option value="female">Fille</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Fichier (JPG/PNG/PDF)</label>
                        <input type="file" className="input-field" accept="image/*,application/pdf" onChange={e => setSelectedFile(e.target.files[0])} />
                    </div>
                </div>

                <button
                    className="btn-save"
                    style={{ marginTop: 'var(--space-md)', width: '100%' }}
                    onClick={handleUpload}
                    disabled={uploading}
                >
                    {uploading ? 'Upload...' : 'Uploader reference personnelle'}
                </button>
            </div>

            <div className="curves-list">
                <h4 style={{ marginBottom: 'var(--space-md)' }}>Mes references personnalisees</h4>
                {customCurves.length === 0 && !loading && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                        Aucune reference personnalisee.
                    </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
                    {customCurves.map(c => (
                        <div key={c.id} className="profile-section-card" style={{ padding: 'var(--space-md)', border: `1px solid ${c.is_plot_enabled ? 'var(--success)' : 'var(--warning)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        {MEASURE_LABELS[c.measure_key] || c.measure_key} - {GENDER_LABELS[c.gender] || c.gender}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: c.is_plot_enabled ? 'var(--success)' : 'var(--warning)' }}>
                                        {c.is_plot_enabled ? 'Trace patient autorise' : 'Reference visuelle seulement'}
                                    </div>
                                    {c.template_config?.source && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                            Calibration: {c.template_config.source === 'ai_calibrated' ? 'IA' : 'automatique'}
                                            {c.template_config.auto_confidence ? ` (${Math.round(c.template_config.auto_confidence * 100)}%)` : ''}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => requestDeleteCurve(c)}
                                    style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer', fontSize: '1.2rem' }}
                                    aria-label="Supprimer la courbe"
                                >
                                    X
                                </button>
                            </div>
                            <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)' }}>
                                <button
                                    type="button"
                                    onClick={() => openPreviewCurve(c)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        padding: 0,
                                        color: 'var(--primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 600
                                    }}
                                >
                                    Voir fichier
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => (deleting ? null : setDeleteModalOpen(false))}
                title="Supprimer la courbe ?"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
                        <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                            Annuler
                        </Button>
                        <Button variant="danger" onClick={confirmDeleteCurve} loading={deleting}>
                            Supprimer
                        </Button>
                    </div>
                )}
            >
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    Cette action supprimera definitivement cette courbe.
                </p>
            </Modal>

            <Modal
                isOpen={Boolean(previewCurve)}
                onClose={() => setPreviewCurve(null)}
                title={previewCurve ? `${MEASURE_LABELS[previewCurve.measure_key] || previewCurve.measure_key} - ${GENDER_LABELS[previewCurve.gender] || previewCurve.gender}` : 'Courbe'}
                fullscreen
                bodyStyle={{ padding: 0, overflow: 'hidden' }}
                modalStyle={{ background: 'var(--bg-card)' }}
            >
                {previewCurve && (
                    <div style={{
                        height: 'calc(100vh - 76px)',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        background: 'var(--bg-app)',
                        boxSizing: 'border-box'
                    }}>
                        {String(previewCurve.file_path || '').toLowerCase().endsWith('.pdf') ? (
                            <iframe
                                title="Apercu de la courbe"
                                src={getAuthUploadUrl(previewCurve.file_path)}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    background: '#fff'
                                }}
                            />
                        ) : (
                            <img
                                src={getAuthUploadUrl(previewCurve.file_path)}
                                alt="Courbe de croissance"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    boxShadow: 'var(--shadow-lg)'
                                }}
                            />
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default GrowthCurveManager;
