/**
 * Assistants Management Page
 * Doctor can manage assistant accounts
 */

import { useState, useEffect } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import doctorService from '../../services/doctorService';
import translations from '../../constants/translations';
import { showConfirm } from '../../utils/toast';
import AddIcon from '@mui/icons-material/Add';
import InboxIcon from '@mui/icons-material/Inbox';

const t = translations;

function AssistantsManagement() {
    // State
    const [assistants, setAssistants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAssistant, setEditingAssistant] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: ''
    });
    const [formErrors, setFormErrors] = useState({});

    // Load assistants
    useEffect(() => {
        loadAssistants();
    }, []);

    async function loadAssistants() {
        try {
            const response = await doctorService.getAssistants();
            if (response.success) {
                setAssistants(response.data);
            }
        } catch (error) {
            console.error('Load assistants error:', error);
        } finally {
            setLoading(false);
        }
    }

    // Handle form change
    function handleFormChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setFormErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Validate form
    function validateForm() {
        const errors = {};
        if (!formData.email.trim()) errors.email = t.errors.required;
        if (!editingAssistant && !formData.password) errors.password = t.errors.required;
        if (!formData.firstName.trim()) errors.firstName = t.errors.required;
        if (!formData.lastName.trim()) errors.lastName = t.errors.required;
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    // Submit
    async function handleSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;

        setSaving(true);
        try {
            if (editingAssistant) {
                // Update
                const response = await doctorService.updateAssistant(editingAssistant.id, formData);
                if (response.success) {
                    setAssistants(prev => prev.map(a =>
                        a.id === editingAssistant.id ? response.data : a
                    ));
                    closeModal();
                }
            } else {
                // Create
                const response = await doctorService.createAssistant(formData);
                if (response.success) {
                    setAssistants(prev => [...prev, response.data]);
                    closeModal();
                }
            }
        } catch (error) {
            console.error('Save assistant error:', error);
            setFormErrors({ general: error.message || t.errors.serverError });
        } finally {
            setSaving(false);
        }
    }

    // Toggle status
    async function handleToggle(assistantId) {
        try {
            const response = await doctorService.toggleAssistant(assistantId);
            if (response.success) {
                setAssistants(prev => prev.map(a =>
                    a.id === assistantId ? { ...a, is_active: !a.is_active } : a
                ));
            }
        } catch (error) {
            console.error('Toggle error:', error);
        }
    }

    // Delete
    async function handleDelete(assistantId) {
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer cet assistant ?');
        if (!confirmed) return;

        try {
            const response = await doctorService.deleteAssistant(assistantId);
            if (response.success) {
                setAssistants(prev => prev.filter(a => a.id !== assistantId));
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    }

    // Open add modal
    function openAddModal() {
        setFormData({ email: '', password: '', firstName: '', lastName: '' });
        setFormErrors({});
        setEditingAssistant(null);
        setShowModal(true);
    }

    // Open edit modal
    function openEditModal(assistant) {
        setFormData({
            email: assistant.email || assistant.user?.email || '',
            password: '',
            firstName: assistant.first_name || assistant.firstName || '',
            lastName: assistant.last_name || assistant.lastName || ''
        });
        setFormErrors({});
        setEditingAssistant(assistant);
        setShowModal(true);
    }

    // Close modal
    function closeModal() {
        setShowModal(false);
        setEditingAssistant(null);
    }

    return (
        <div className="layout">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t.doctor.assistants}</h1>
                        <p style={{ margin: 0, fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Gérez les comptes de vos assistants
                        </p>
                    </div>
                    <Button variant="primary" onClick={openAddModal}>
                        <AddIcon fontSize="small" /> Ajouter un assistant
                    </Button>
                </div>

                <div className="page-content">
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : assistants.length > 0 ? (
                        <div className="card">
                            {/* Desktop Table */}
                            <div className="table-container desktop-table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '25%' }}>Nom</th>
                                            <th>Email</th>
                                            <th style={{ width: '10%' }}>{t.common.status}</th>
                                            <th className="col-actions" style={{ width: '200px', textAlign: 'right' }}>{t.common.actions}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assistants.map(assistant => (
                                            <tr key={assistant.id}>
                                                <td data-label="Nom" style={{ fontWeight: 500 }}>
                                                    {assistant.first_name || assistant.firstName} {assistant.last_name || assistant.lastName}
                                                </td>
                                                <td data-label="Email" className="col-truncate">{assistant.email || assistant.user?.email}</td>
                                                <td data-label={t.common.status}>
                                                    <span className={`badge ${assistant.is_active ? 'badge-success' : 'badge-gray'}`}>
                                                        {assistant.is_active ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </td>
                                                <td data-label={t.common.actions} className="col-actions text-right">
                                                    <div className="flex gap-sm justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="btn-icon"
                                                            onClick={() => openEditModal(assistant)}
                                                            title="Modifier"
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </Button>
                                                        <Button
                                                            variant={assistant.is_active ? 'secondary' : 'success'}
                                                            size="sm"
                                                            onClick={() => handleToggle(assistant.id)}
                                                        >
                                                            {assistant.is_active ? 'Désactiver' : 'Activer'}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="btn-icon"
                                                            onClick={() => handleDelete(assistant.id)}
                                                            title="Supprimer"
                                                            style={{ color: 'var(--error)' }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile List View */}
                            <div className="mobile-list-container" style={{ padding: 'var(--space-md)' }}>
                                {assistants.map(assistant => (
                                    <div key={`mob-${assistant.id}`} className="mobile-list-item">
                                        <div className="mobile-list-header" style={{ cursor: 'default' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', minWidth: 0, width: '100%' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: assistant.is_active ? 'rgba(34, 197, 94, 0.1)' : 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ color: assistant.is_active ? 'var(--success)' : 'var(--gray-500)', fontWeight: 600, fontSize: '1.2rem' }}>
                                                        {(assistant.first_name || assistant.firstName || '?')[0].toUpperCase()}
                                                    </span>
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {assistant.first_name || assistant.firstName} {assistant.last_name || assistant.lastName}
                                                        </p>
                                                        <span className={`badge ${assistant.is_active ? 'badge-success' : 'badge-gray'}`} style={{ transform: 'scale(0.8)', transformOrigin: 'top right' }}>
                                                            {assistant.is_active ? 'Actif' : 'Inactif'}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {assistant.email || assistant.user?.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mobile-list-content" style={{ display: 'flex', gap: 'var(--space-sm)', paddingTop: 'var(--space-md)' }}>
                                            <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => openEditModal(assistant)}>
                                                <EditIcon fontSize="small" style={{ marginRight: '4px' }} /> Modifier
                                            </Button>
                                            <Button variant={assistant.is_active ? 'secondary' : 'success'} size="sm" style={{ flex: 1 }} onClick={() => handleToggle(assistant.id)}>
                                                {assistant.is_active ? 'Désactiver' : 'Activer'}
                                            </Button>
                                            <Button variant="ghost" size="sm" className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDelete(assistant.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-xl)' }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: 'var(--gray-100)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto var(--space-md)'
                                }}>
                                    <InboxIcon style={{ color: 'var(--gray-400)', fontSize: 28 }} />
                                </div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    Aucun assistant
                                </div>
                                <div style={{ fontSize: '0.813rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                                    Ajoutez votre premier assistant pour commencer
                                </div>
                                <Button variant="primary" size="sm" onClick={openAddModal}>
                                    <AddIcon fontSize="small" /> Ajouter un assistant
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Add/Edit Assistant Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingAssistant ? 'Modifier l\'assistant' : 'Ajouter un assistant'}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeModal}>
                            {t.common.cancel}
                        </Button>
                        <Button variant="primary" onClick={handleSubmit} loading={saving}>
                            {t.common.save}
                        </Button>
                    </>
                }
            >
                {formErrors.general && (
                    <div className="alert alert-error">{formErrors.general}</div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                        <Input
                            label={t.doctor.firstName}
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleFormChange}
                            error={formErrors.firstName}
                            required
                        />

                        <Input
                            label={t.doctor.lastName}
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleFormChange}
                            error={formErrors.lastName}
                            required
                        />
                    </div>

                    <Input
                        label="Email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleFormChange}
                        error={formErrors.email}
                        required
                    />

                    <Input
                        label={editingAssistant ? 'Nouveau mot de passe (laisser vide pour garder l\'actuel)' : 'Mot de passe'}
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleFormChange}
                        error={formErrors.password}
                        required={!editingAssistant}
                    />
                </form>
            </Modal>
        </div>
    );
}

export default AssistantsManagement;
