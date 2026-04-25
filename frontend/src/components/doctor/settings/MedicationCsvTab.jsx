import React, { useState, useEffect } from 'react';
import doctorService from '../../../services/doctorService';
import { showSuccess, showError } from '../../../utils/toast';

function MedicationCsvTab() {
    const [medications, setMedications] = useState([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadMedications();
    }, []);

    async function loadMedications() {
        setLoading(true);
        try {
            const res = await doctorService.getMedications();
            if (res.success) {
                setMedications(res.data || []);
                setCount(res.count || 0);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function handleUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const fd = new FormData();
        fd.append('csv', file);

        try {
            const res = await doctorService.uploadMedicationCSV(fd);
            if (res.success) {
                showSuccess(res.message || 'CSV importé');
                loadMedications();
            } else {
                showError(res.message || 'Erreur d\'import');
            }
        } catch (err) {
            showError(err.message || 'Erreur d\'import');
        }
        setUploading(false);
        e.target.value = '';
    }

    async function handleDelete() {
        if (!window.confirm('Supprimer tous les médicaments importés ?')) return;
        try {
            const res = await doctorService.deleteMedications();
            if (res.success) {
                showSuccess('Médicaments supprimés');
                setMedications([]);
                setCount(0);
            }
        } catch (e) { showError('Erreur'); }
    }

    return (
        <div>
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">💊 Base de médicaments (CSV)</div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Importez un fichier CSV contenant vos médicaments. La colonne "nom" ou "name" est obligatoire.
                    Colonnes optionnelles : forme, dosage, fréquence, notes.
                </p>

                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{
                        padding: 'var(--space-sm) var(--space-lg)',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: 'var(--radius-md)',
                        cursor: uploading ? 'wait' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                    }}>
                        {uploading ? '⏳ Import en cours...' : '📁 Importer CSV'}
                        <input type="file" accept=".csv,.txt" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
                    </label>

                    {count > 0 && (
                        <button onClick={handleDelete} style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            border: '1px solid var(--error)',
                            color: 'var(--error)',
                            backgroundColor: 'transparent',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}>
                            🗑 Tout supprimer
                        </button>
                    )}

                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {count > 0 ? `${count} médicaments dans votre base` : 'Aucun médicament importé'}
                    </span>
                </div>
            </div>

            {/* Preview of medications */}
            {medications.length > 0 && (
                <div className="profile-section-card">
                    <div className="section-header">
                        <div className="section-title">Aperçu ({medications.length} premiers)</div>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '6px 8px' }}>Nom</th>
                                    <th style={{ padding: '6px 8px' }}>Forme</th>
                                    <th style={{ padding: '6px 8px' }}>Dosage</th>
                                    <th style={{ padding: '6px 8px' }}>Fréq.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {medications.slice(0, 50).map(med => (
                                    <tr key={med.id} style={{ borderBottom: '1px solid var(--border-light, #eee)' }}>
                                        <td style={{ padding: '6px 8px', fontWeight: '500' }}>{med.name}</td>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{med.dosage_form || '—'}</td>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{med.default_dosage || '—'}</td>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{med.default_frequency || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MedicationCsvTab;
