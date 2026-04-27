import React, { useMemo, useState, useEffect } from 'react';
import doctorService from '../../../services/doctorService';
import { showSuccess, showError } from '../../../utils/toast';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

function MedicationCsvTab() {
    const [medications, setMedications] = useState([]);
    const [count, setCount] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [lastImportReport, setLastImportReport] = useState(null);

    useEffect(() => {
        loadMedications();
    }, []);

    const sampleCsv = useMemo(() => {
        // Same fields used by the prescription editor in CaseDetails.
        return [
            'nom du médicament;dosage;fréq;durée',
            '"Paracétamol";"15 mg/kg";"Toutes les 6h";"3 jours"',
            '"Amoxicilline";"500 mg";"3 fois/jour";"7 jours"',
            '"Ibuprofène";"10 mg/kg";"Toutes les 8h";"2 jours"'
        ].join('\n');
    }, []);

    async function loadMedications() {
        try {
            const res = await doctorService.getMedications();
            if (res.success) {
                setMedications(res.data || []);
                setCount(res.count || 0);
            }
        } catch (e) { console.error(e); }
    }

    async function handleUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setLastImportReport(null);
        const fd = new FormData();
        fd.append('csv', file);

        try {
            const res = await doctorService.uploadMedicationCSV(fd);
            if (res.success) {
                const inserted = Number(res.inserted ?? res.count ?? 0);
                const skipped = Number(res.skipped ?? 0);
                const errors = Array.isArray(res.errors) ? res.errors : [];
                setLastImportReport({ inserted, skipped, errors });
                showSuccess(`Import terminé: ${inserted} ajouté(s), ${skipped} ignoré(s)`);
                loadMedications();
            } else {
                showError(res.message || 'Erreur d\'import');
            }
        } catch (err) {
            showError(err?.response?.data?.message || err?.message || 'Erreur d\'import');
        }
        setUploading(false);
        e.target.value = '';
    }

    async function handleDelete() {
        setDeleteModalOpen(true);
    }

    async function confirmDeleteAll() {
        setDeleting(true);
        try {
            const res = await doctorService.deleteMedications();
            if (res.success) {
                showSuccess('Médicaments supprimés');
                setMedications([]);
                setCount(0);
                setDeleteModalOpen(false);
            } else {
                showError(res.message || 'Erreur');
            }
        } catch (e) {
            console.error('deleteMedications error:', e);
            showError(e?.response?.data?.message || e?.message || 'Erreur de connexion');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div>
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                        <div className="section-title">Base de médicaments (CSV)</div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Importez un fichier CSV contenant vos médicaments. La colonne "nom du médicament" est obligatoire.
                    Colonnes conseillées : nom du médicament, dosage, fréq, durée.
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
                        {uploading ? 'Import en cours...' : 'Importer CSV'}
                        <input type="file" accept=".csv,.txt" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'medicaments_exemple.csv';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                        }}
                        style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            backgroundColor: 'transparent',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        Télécharger un exemple CSV
                    </button>

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
                            Tout supprimer
                        </button>
                    )}

                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {count > 0 ? `${count} médicaments dans votre base` : 'Aucun médicament importé'}
                    </span>
                </div>

                {lastImportReport && (
                    <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Résultat import</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Ajoutés: <b>{lastImportReport.inserted}</b> · Ignorés: <b>{lastImportReport.skipped}</b>
                        </div>
                        {lastImportReport.errors?.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--error)' }}>
                                    Erreurs ({lastImportReport.errors.length})
                                </div>
                                <div style={{ maxHeight: '160px', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
                                    {lastImportReport.errors.slice(0, 50).map((er, idx) => (
                                        <div key={idx} style={{ padding: '6px 10px', borderBottom: idx < Math.min(50, lastImportReport.errors.length) - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <b>Ligne {er.line}:</b> {er.reason}
                                        </div>
                                    ))}
                                </div>
                                {lastImportReport.errors.length > 50 && (
                                    <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        (Affichage limité à 50 erreurs)
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
                                    <th style={{ padding: '6px 8px' }}>Dosage</th>
                                    <th style={{ padding: '6px 8px' }}>Fréq.</th>
                                    <th style={{ padding: '6px 8px' }}>Durée</th>
                                </tr>
                            </thead>
                            <tbody>
                                {medications.slice(0, 50).map(med => (
                                    <tr key={med.id} style={{ borderBottom: '1px solid var(--border-light, #eee)' }}>
                                        <td style={{ padding: '6px 8px', fontWeight: '500' }}>{med.name}</td>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{med.default_dosage || '-'}</td>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{med.default_frequency || '-'}</td>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{med.default_duration || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => (deleting ? null : setDeleteModalOpen(false))}
                title="Supprimer tous les médicaments ?"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
                        <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                            Annuler
                        </Button>
                        <Button variant="danger" onClick={confirmDeleteAll} loading={deleting}>
                            Supprimer
                        </Button>
                    </div>
                )}
            >
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    Cette action supprimera définitivement tous les médicaments importés de votre base.
                </p>
            </Modal>
        </div>
    );
}

export default MedicationCsvTab;
