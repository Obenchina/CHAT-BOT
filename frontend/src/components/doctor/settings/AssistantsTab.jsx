import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../common/LoadingSpinner';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Modal from '../../common/Modal';
import { useAuth } from '../../../context/AuthContext';
import doctorService from '../../../services/doctorService';
import authService from '../../../services/authService';
import translations from '../../../constants/translations';
import { showSuccess, showError, showConfirm } from '../../../utils/toast';
import { SPECIALTY_OPTIONS, GENDER_OPTIONS, UPLOAD_URL, getAuthUploadUrl } from '../../../constants/config';
import '../../../styles/profile.css';

const t = translations;

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function AssistantsTab() {
    const [assistants, setAssistants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAssistant, setEditingAssistant] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '' });

    useEffect(() => { loadAssistants(); }, []);

    async function loadAssistants() {
        try {
            const response = await doctorService.getAssistants();
            if (response.success) {
                setAssistants(response.data || []);
            }
        } catch (error) {
            console.error('Load assistants error:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleEdit(assistant) {
        setEditingAssistant(assistant);
        setFormData({
            firstName: assistant.first_name || assistant.firstName || '',
            lastName: assistant.last_name || assistant.lastName || '',
            email: assistant.email || '',
            password: ''
        });
        setShowModal(true);
    }

    function handleAdd() {
        setEditingAssistant(null);
        setFormData({ firstName: '', lastName: '', email: '', password: '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingAssistant) {
                await doctorService.updateAssistant(editingAssistant.id, formData);
                showSuccess('Assistant modifié avec succès');
            } else {
                await doctorService.createAssistant(formData);
                showSuccess('Assistant créé avec succès');
            }
            setShowModal(false);
            loadAssistants();
        } catch (error) {
            console.error('Save assistant error:', error);
            showError(error.message || 'Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    }

    async function handleToggle(id) {
        try {
            await doctorService.toggleAssistant(id);
            loadAssistants();
        } catch (error) {
            console.error('Toggle assistant error:', error);
        }
    }

    async function handleDelete(id) {
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer cet assistant ?');
        if (confirmed) {
            try {
                await doctorService.deleteAssistant(id);
                showSuccess('Assistant supprimé');
                loadAssistants();
            } catch (error) {
                console.error('Delete assistant error:', error);
                showError('Erreur lors de la suppression');
            }
        }
    }

    if (loading) return <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}><LoadingSpinner size="lg" text={t.common.loading} /></div>;

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <GroupIcon fontSize="small" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {t.doctor.assistants} ({assistants.length})
                </h2>
                <Button variant="primary" size="sm" onClick={handleAdd}>
                    <AddIcon fontSize="small" /> Ajouter
                </Button>
            </div>

            {assistants.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <InboxIcon style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Aucun assistant pour le moment</p>
                    <Button variant="primary" size="sm" onClick={handleAdd} style={{ marginTop: 'var(--space-md)' }}>
                        <AddIcon fontSize="small" /> Créer un assistant
                    </Button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {assistants.map(assistant => (
                        <div key={assistant.id} className="card" style={{ padding: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                        {assistant.first_name || assistant.firstName} {assistant.last_name || assistant.lastName}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{assistant.email}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleToggle(assistant.id)}
                                        className={`badge ${assistant.is_active ? 'badge-green' : 'badge-gray'}`}
                                        style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
                                    >
                                        {assistant.is_active ? 'Actif' : 'Inactif'}
                                    </button>
                                    <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleEdit(assistant)}>
                                        <EditIcon fontSize="small" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDelete(assistant.id)}>
                                        <DeleteIcon fontSize="small" color="error" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <Modal
                    isOpen={true}
                    title={editingAssistant ? 'Modifier l\'assistant' : 'Nouvel assistant'}
                    onClose={() => setShowModal(false)}
                >
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <Input label="Prénom" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
                            <Input label="Nom" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
                            <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={!!editingAssistant} />
                            {!editingAssistant && (
                                <Input label="Mot de passe" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
                            )}
                        </div>
                        <div className="modal-footer" style={{ marginTop: 'var(--space-lg)' }}>
                            <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
                            <Button variant="primary" type="submit" disabled={saving}>
                                {saving ? 'Enregistrement...' : (editingAssistant ? 'Modifier' : 'Créer')}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}

// ============================================================
// PRESCRIPTION PDF CUSTOMIZATION TAB
// ============================================================
export default AssistantsTab;