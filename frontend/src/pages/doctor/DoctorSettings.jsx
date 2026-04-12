/**
 * Doctor Settings Page
 * Unified settings with tabs: Profile, Assistants, AI Configuration
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import doctorService from '../../services/doctorService';
import authService from '../../services/authService';
import translations from '../../constants/translations';
import { showSuccess, showError, showConfirm } from '../../utils/toast';
import { SPECIALTY_OPTIONS, GENDER_OPTIONS, UPLOAD_URL } from '../../constants/config';
import '../../styles/profile.css';

// MUI Icons
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InboxIcon from '@mui/icons-material/Inbox';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';

const t = translations;
const DEFAULT_PRESCRIPTION_CONFIG = {
    logoPath: '',
    primaryColor: '#163A5F',
    accentColor: '#67C7D8',
    headerNote: '',
    footerText: ''
};

function getUploadAssetUrl(filePath) {
    if (!filePath) {
        return '';
    }

    const normalizedPath = String(filePath)
        .replace(/^uploads[\\/]/, '')
        .replace(/\\/g, '/');

    return `${UPLOAD_URL}/${normalizedPath}`;
}

// ============================================================
// AI MODEL OPTIONS
// ============================================================
const AI_PROVIDERS = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        icon: '✨',
        description: 'Google AI',
        models: [
            { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
            { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash' },
            { value: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro' },
            { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash' },
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
            { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI ChatGPT',
        icon: '🤖',
        description: 'OpenAI',
        models: [
            { value: 'gpt-5.4', label: 'GPT-5.4' },
            { value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
            { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
            { value: 'gpt-5.2', label: 'GPT-5.2' },
            { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
            { value: 'gpt-5.1', label: 'GPT-5.1' },
            { value: 'gpt-5', label: 'GPT-5' },
            { value: 'gpt-4.5-turbo', label: 'GPT-4.5 Turbo' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
        ]
    }
];

// ============================================================
// TAB DEFINITIONS
// ============================================================
const TABS = [
    { id: 'profile', label: 'Profil', icon: <PersonIcon fontSize="small" /> },
    { id: 'assistants', label: 'Assistants', icon: <GroupIcon fontSize="small" /> },
    { id: 'ai', label: 'Configuration IA', icon: <SmartToyIcon fontSize="small" /> },
    { id: 'prescription', label: 'Ordonnance PDF', icon: <DescriptionIcon fontSize="small" /> },
];

function DoctorSettings() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('profile');

    // Detect initial tab from URL hash or referrer
    useEffect(() => {
        const hash = location.hash;
        const tab = location.state?.tab;
        let nextTab = null;

        if (hash === '#assistants' || tab === 'assistants') {
            nextTab = 'assistants';
        } else if (hash === '#ai' || tab === 'ai') {
            nextTab = 'ai';
        } else if (hash === '#prescription' || tab === 'prescription') {
            nextTab = 'prescription';
        }

        if (!nextTab) {
            return;
        }

        queueMicrotask(() => {
            setActiveTab(prev => (prev !== nextTab ? nextTab : prev));
        });
    }, [location]);

    return (
        <div className="layout internal-shell doctor-settings-shell">
            <Sidebar />
            <main className="main-content">
                <div className="page-content">
                    {/* Page Header */}
                    <div className="page-header">
                        <h1 className="page-title">⚙️ Paramètres</h1>
                    </div>

                    {/* Tab Navigation */}
                    <div className="settings-tabs" style={{
                        display: 'flex',
                        gap: 'var(--space-xs)',
                        marginBottom: 'var(--space-lg)',
                        borderBottom: '2px solid var(--border-color)',
                        paddingBottom: '0',
                        overflowX: 'auto'
                    }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`settings-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    border: 'none',
                                    borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                                    background: 'transparent',
                                    color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: activeTab === tab.id ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '0.9rem',
                                    whiteSpace: 'nowrap',
                                    marginBottom: '-2px'
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'profile' && <ProfileTab />}
                    {activeTab === 'assistants' && <AssistantsTab />}
                    {activeTab === 'ai' && <AiConfigTab />}
                    {activeTab === 'prescription' && <PrescriptionPdfTab />}
                </div>
            </main>
        </div>
    );
}

// ============================================================
// PROFILE TAB (adapted from DoctorProfile.jsx)
// ============================================================
function ProfileTab() {
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', gender: '', phone: '', email: '', address: '', specialty: ''
    });
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const { updateProfile } = useAuth();

    useEffect(() => { loadProfile(); }, []);

    async function loadProfile() {
        try {
            const response = await doctorService.getProfile();
            if (response.success) {
                const data = response.data;
                setFormData({
                    firstName: data.first_name || data.firstName || '',
                    lastName: data.last_name || data.lastName || '',
                    gender: data.gender || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    address: data.address || '',
                    specialty: data.specialty || ''
                });
            }
        } catch (error) {
            console.error('Load profile error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const response = await doctorService.updateProfile(formData);
            if (response.success) {
                updateProfile(response.data);
                setIsEditing(false);
                setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
            }
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || t.errors.serverError });
        } finally {
            setSaving(false);
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            setPasswordMessage({ type: 'danger', text: 'Les mots de passe ne correspondent pas' });
            return;
        }
        setSaving(true);
        setPasswordMessage({ type: '', text: '' });
        try {
            const response = await authService.changePassword(passwordData.current, passwordData.new);
            if (response.success) {
                setShowPasswordModal(false);
                setPasswordData({ current: '', new: '', confirm: '' });
                showSuccess('Mot de passe modifié avec succès');
            }
        } catch (error) {
            setPasswordMessage({
                type: 'danger',
                text: error.response?.data?.message || 'Erreur lors du changement de mot de passe'
            });
        } finally {
            setSaving(false);
        }
    }

    const getInitials = (first, last) => `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();
    const getSpecialtyLabel = (value) => SPECIALTY_OPTIONS.find(o => o.value === value)?.label || value;
    const getGenderLabel = (value) => GENDER_OPTIONS.find(o => o.value === value)?.label || value;

    if (loading) return <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}><LoadingSpinner size="lg" text={t.common.loading} /></div>;

    return (
        <>
            <div className="profile-container">
                <div className="profile-header-card">
                    <div className="profile-avatar">{getInitials(formData.firstName, formData.lastName)}</div>
                    <div className="profile-info">
                        <h2>{formData.firstName} {formData.lastName}</h2>
                        <span className="profile-role">Médecin - {getSpecialtyLabel(formData.specialty)}</span>
                    </div>
                </div>

                <div className="profile-content-grid">
                    <div className="profile-section-card">
                        <div className="section-header">
                            <div className="section-title"><span>👤</span> Informations Personnelles</div>
                            {!isEditing && <button className="btn-edit" onClick={() => setIsEditing(true)}>✏️ Modifier</button>}
                        </div>

                        {message.text && <div className={`alert alert-${message.type} mb-4`}>{message.text}</div>}

                        {isEditing ? (
                            <form onSubmit={handleSubmit}>
                                <div className="form-grid">
                                    <div className="input-group">
                                        <label>{t.doctor.firstName}</label>
                                        <input type="text" className="input-field" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
                                    </div>
                                    <div className="input-group">
                                        <label>{t.doctor.lastName}</label>
                                        <input type="text" className="input-field" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
                                    </div>
                                    <div className="input-group">
                                        <label>{t.doctor.gender}</label>
                                        <select className="input-field" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                                            <option value="">-- Sélectionner --</option>
                                            {GENDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>{t.doctor.phone}</label>
                                        <input type="tel" className="input-field" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                                    </div>
                                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>{t.doctor.specialty}</label>
                                        <select className="input-field" value={formData.specialty} onChange={(e) => setFormData({ ...formData, specialty: e.target.value })} required>
                                            <option value="">-- Sélectionner --</option>
                                            {SPECIALTY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Email</label>
                                        <input type="email" className="input-field" value={formData.email} disabled />
                                    </div>
                                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>{t.doctor.address}</label>
                                        <textarea className="input-field" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows="3" />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="btn-cancel" onClick={() => { setIsEditing(false); loadProfile(); }} disabled={saving}>Annuler</button>
                                    <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                                </div>
                            </form>
                        ) : (
                            <div className="form-grid">
                                <div className="info-item"><div className="info-label">{t.doctor.firstName}</div><div className="info-value">{formData.firstName}</div></div>
                                <div className="info-item"><div className="info-label">{t.doctor.lastName}</div><div className="info-value">{formData.lastName}</div></div>
                                <div className="info-item"><div className="info-label">{t.doctor.gender}</div><div className="info-value">{getGenderLabel(formData.gender) || '-'}</div></div>
                                <div className="info-item"><div className="info-label">{t.doctor.phone}</div><div className="info-value">{formData.phone || '-'}</div></div>
                                <div className="info-item"><div className="info-label">{t.doctor.specialty}</div><div className="info-value">{getSpecialtyLabel(formData.specialty)}</div></div>
                                <div className="info-item"><div className="info-label">Email</div><div className="info-value">{formData.email}</div></div>
                                <div className="info-item" style={{ gridColumn: '1 / -1' }}><div className="info-label">{t.doctor.address}</div><div className="info-value">{formData.address || '-'}</div></div>
                            </div>
                        )}
                    </div>

                    <div className="profile-section-card">
                        <div className="section-header">
                            <div className="section-title"><span>🔒</span> Sécurité</div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-gray-500 text-sm">Gérez votre mot de passe et la sécurité de votre compte.</p>
                            <button className="btn-password" onClick={() => setShowPasswordModal(true)}>🔑 Changer le mot de passe</button>
                        </div>
                    </div>
                </div>
            </div>

            {showPasswordModal && (
                <div className="modal-overlay">
                    <div className="modal-modern">
                        <div className="modal-header">
                            <h3 className="modal-title">Changer le mot de passe</h3>
                            <button className="modal-close" onClick={() => { setShowPasswordModal(false); setPasswordData({ current: '', new: '', confirm: '' }); setPasswordMessage({ type: '', text: '' }); }}>×</button>
                        </div>
                        <div className="modal-body">
                            {passwordMessage.text && <div className={`alert alert-${passwordMessage.type} mb-4 text-sm`}>{passwordMessage.text}</div>}
                            <form onSubmit={handlePasswordChange}>
                                <div className="space-y-4">
                                    <div className="input-group"><label>Mot de passe actuel</label><input type="password" className="input-field" value={passwordData.current} onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })} required placeholder="••••••••" /></div>
                                    <div className="input-group"><label>Nouveau mot de passe</label><input type="password" className="input-field" value={passwordData.new} onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })} required minLength={6} placeholder="Minimum 6 caractères" /></div>
                                    <div className="input-group"><label>Confirmer le mot de passe</label><input type="password" className="input-field" value={passwordData.confirm} onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })} required minLength={6} placeholder="Répétez le mot de passe" /></div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowPasswordModal(false)}>Annuler</button>
                                    <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Modification...' : 'Confirmer'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ============================================================
// ASSISTANTS TAB (adapted from AssistantsManagement.jsx)
// ============================================================
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
function PrescriptionPdfTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [formData, setFormData] = useState(DEFAULT_PRESCRIPTION_CONFIG);

    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        try {
            const response = await doctorService.getPrescriptionConfig();
            if (response.success && response.data) {
                const nextConfig = {
                    ...DEFAULT_PRESCRIPTION_CONFIG,
                    ...response.data,
                    primaryColor: response.data.primaryColor || DEFAULT_PRESCRIPTION_CONFIG.primaryColor,
                    accentColor: response.data.accentColor || DEFAULT_PRESCRIPTION_CONFIG.accentColor
                };

                setFormData(nextConfig);
                setLogoPreview(getUploadAssetUrl(nextConfig.logoPath));
            }
        } catch (error) {
            console.error('Load prescription config error:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleFieldChange(field, value) {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }

    function handleLogoChange(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (logoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview);
        }

        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    }

    async function handleSave(event) {
        event.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const payload = new FormData();
            payload.append('primaryColor', formData.primaryColor);
            payload.append('accentColor', formData.accentColor);
            payload.append('headerNote', formData.headerNote);
            payload.append('footerText', formData.footerText);

            if (logoFile) {
                payload.append('logo', logoFile);
            }

            const response = await doctorService.updatePrescriptionConfig(payload);
            if (response.success) {
                const nextConfig = {
                    ...DEFAULT_PRESCRIPTION_CONFIG,
                    ...response.data,
                    primaryColor: response.data.primaryColor || DEFAULT_PRESCRIPTION_CONFIG.primaryColor,
                    accentColor: response.data.accentColor || DEFAULT_PRESCRIPTION_CONFIG.accentColor
                };

                if (logoPreview.startsWith('blob:')) {
                    URL.revokeObjectURL(logoPreview);
                }

                setFormData(nextConfig);
                setLogoFile(null);
                setLogoPreview(getUploadAssetUrl(nextConfig.logoPath));
                setMessage({ type: 'success', text: 'Configuration de l ordonnance enregistree avec succes.' });
            }
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || 'Erreur lors de la sauvegarde de l ordonnance.' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                <LoadingSpinner size="lg" text={t.common.loading} />
            </div>
        );
    }

    return (
        <div className="prescription-settings-grid">
            <div className="profile-section-card">
                <div className="section-header">
                    <div className="section-title">
                        <span>PDF</span> Personnalisation de l ordonnance
                    </div>
                </div>

                {message.text && (
                    <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-md)' }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSave}>
                    <div className="prescription-form-stack">
                        <div className="input-group">
                            <label>Logo du cabinet</label>
                            <div className="prescription-logo-field">
                                <div className="prescription-logo-preview">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo ordonnance" />
                                    ) : (
                                        <span>MC</span>
                                    )}
                                </div>
                                <div className="prescription-logo-inputs">
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleLogoChange}
                                        className="input-field"
                                    />
                                    <p className="prescription-help-text">
                                        JPG, PNG ou WebP. Le nouveau logo remplacera celui utilise dans le PDF.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="input-group">
                                <label>Couleur principale</label>
                                <div className="prescription-color-row">
                                    <input
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={(e) => handleFieldChange('primaryColor', e.target.value)}
                                        className="prescription-color-input"
                                    />
                                    <input
                                        type="text"
                                        value={formData.primaryColor}
                                        onChange={(e) => handleFieldChange('primaryColor', e.target.value)}
                                        className="input-field"
                                        placeholder="#163A5F"
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Couleur secondaire</label>
                                <div className="prescription-color-row">
                                    <input
                                        type="color"
                                        value={formData.accentColor}
                                        onChange={(e) => handleFieldChange('accentColor', e.target.value)}
                                        className="prescription-color-input"
                                    />
                                    <input
                                        type="text"
                                        value={formData.accentColor}
                                        onChange={(e) => handleFieldChange('accentColor', e.target.value)}
                                        className="input-field"
                                        placeholder="#67C7D8"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Texte sous le nom du medecin</label>
                            <input
                                type="text"
                                value={formData.headerNote}
                                onChange={(e) => handleFieldChange('headerNote', e.target.value)}
                                className="input-field"
                                maxLength={180}
                                placeholder="Cabinet medical, rendez-vous, slogan..."
                            />
                        </div>

                        <div className="input-group">
                            <label>Texte du pied de page</label>
                            <textarea
                                value={formData.footerText}
                                onChange={(e) => handleFieldChange('footerText', e.target.value)}
                                className="input-field"
                                rows="4"
                                maxLength={500}
                                placeholder="Informations legales, horaires, message de suivi..."
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-save" disabled={saving}>
                            {saving ? 'Enregistrement...' : 'Enregistrer la personnalisation'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="profile-section-card">
                <div className="section-header">
                    <div className="section-title">
                        <span>Vue</span> Apercu rapide
                    </div>
                </div>

                <div
                    className="prescription-preview-card"
                    style={{
                        '--preview-primary': formData.primaryColor,
                        '--preview-accent': formData.accentColor
                    }}
                >
                    <div className="prescription-preview-sheet">
                        <div className="prescription-preview-topline" />

                        <div className="prescription-preview-header">
                            <div className="prescription-preview-brand">
                                <div className="prescription-preview-brand-logo">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo preview" />
                                    ) : (
                                        <span>MC</span>
                                    )}
                                </div>
                                <div>
                                    <strong>Dr Votre Nom</strong>
                                    <span>Medecine generale</span>
                                    {formData.headerNote && <small>{formData.headerNote}</small>}
                                </div>
                            </div>
                            <div className="prescription-preview-date">12/04/2026</div>
                        </div>

                        <div className="prescription-preview-patient">
                            <div>
                                <span>Nom</span>
                                <strong>PATIENT</strong>
                            </div>
                            <div>
                                <span>Prenom</span>
                                <strong>EXEMPLE</strong>
                            </div>
                            <div>
                                <span>Age</span>
                                <strong>45 ans</strong>
                            </div>
                        </div>

                        <h3>ORDONNANCE</h3>

                        <div className="prescription-preview-med">
                            <strong>1. Paracetamol</strong>
                            <span>500mg - 3x/jour - 5 jours</span>
                        </div>

                        <div className="prescription-preview-med">
                            <strong>2. Ibuprofene</strong>
                            <span>400mg - 2x/jour - 3 jours</span>
                        </div>

                        <div className="prescription-preview-footer">
                            <p>{formData.footerText || 'Le texte de pied de page apparaitra ici.'}</p>
                            <div>
                                <span>Signature</span>
                                <strong>Dr Votre Nom</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// AI CONFIGURATION TAB
// ============================================================
function AiConfigTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [formData, setFormData] = useState({
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-2.5-flash-lite'
    });

    const [configs, setConfigs] = useState({ gemini: {}, openai: {} });

    useEffect(() => { loadConfig(); }, []);

    async function loadConfig() {
        try {
            const response = await doctorService.getAiConfig();
            if (response.success && response.data) {
                const active = response.data.activeProvider || 'gemini';
                const provConfigs = response.data.configs || {};
                
                setConfigs(provConfigs);
                
                setFormData({
                    provider: active,
                    apiKey: provConfigs[active]?.apiKey || '',
                    model: provConfigs[active]?.model || (active === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini')
                });
            }
        } catch (error) {
            console.error('Load AI config error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleProviderChange(providerId) {
        const provider = AI_PROVIDERS.find(p => p.id === providerId);
        
        // Update local state immediately for fast UI
        setFormData({
            ...formData,
            provider: providerId,
            model: configs[providerId]?.model || provider?.models[0]?.value || '',
            apiKey: configs[providerId]?.apiKey || ''
        });

        // Trigger backend activation silently
        try {
            await doctorService.activateAiConfig(providerId);
        } catch (error) {
            console.error('Failed to activate AI provider:', error);
            // Optionally could revert UI or show error toast here, but silent is fine for this 
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await doctorService.updateAiConfig(formData);
            if (response.success) {
                setMessage({ type: 'success', text: 'Configuration IA enregistrée avec succès ✓' });
                // Reload to get masked key
                await loadConfig();
            }
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || 'Erreur lors de la sauvegarde' });
        } finally {
            setSaving(false);
        }
    }

    const currentProviderData = AI_PROVIDERS.find(p => p.id === formData.provider);

    if (loading) return <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}><LoadingSpinner size="lg" text={t.common.loading} /></div>;

    return (
        <div style={{ maxWidth: '700px' }}>
            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-md)' }}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave}>
                {/* Provider Selection */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Fournisseur d'IA
                    </label>
                    <div className="ai-provider-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
                        {AI_PROVIDERS.map(provider => (
                            <button
                                key={provider.id}
                                type="button"
                                onClick={() => handleProviderChange(provider.id)}
                                className={`ai-provider-card ${formData.provider === provider.id ? 'is-active' : ''}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: 'var(--space-xs)',
                                    padding: 'var(--space-lg)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: formData.provider === provider.id
                                        ? '2px solid var(--primary)'
                                        : '2px solid var(--border-color)',
                                    background: formData.provider === provider.id
                                        ? 'var(--primary-50, rgba(59, 130, 246, 0.05))'
                                        : 'var(--bg-card)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                            >
                                {formData.provider === provider.id && (
                                    <CheckCircleIcon style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        color: 'var(--primary)',
                                        fontSize: '1.2rem'
                                    }} />
                                )}
                                <span style={{ fontSize: '1.5rem' }}>{provider.icon}</span>
                                <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{provider.name}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{provider.description}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Key */}
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-xs)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Clé API {currentProviderData?.name}
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                        {formData.provider === 'gemini'
                            ? 'Obtenez votre clé sur aistudio.google.com'
                            : 'Obtenez votre clé sur platform.openai.com'}
                    </p>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            className="form-input"
                            value={formData.apiKey}
                            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                            placeholder={`Entrez votre clé API ${currentProviderData?.name || ''}`}
                            style={{
                                width: '100%',
                                paddingRight: '44px',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '4px'
                            }}
                        >
                            {showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </button>
                    </div>
                </div>

                {/* Model Selection */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-xs)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Modèle
                    </label>
                    <select
                        className="input-field"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        style={{ width: '100%', fontSize: '0.9rem', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}
                    >
                        {currentProviderData?.models.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>

                {/* Save Button */}
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <SaveIcon fontSize="small" />
                    {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
                </button>
            </form>

            {/* Info Card */}
            <div className="card" style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-md)', background: 'var(--bg-elevated)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>ℹ️ À propos de la configuration IA</h4>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.8', paddingLeft: 'var(--space-md)', margin: 0 }}>
                    <li>L'IA analyse les cas médicaux soumis par vos assistants</li>
                    <li><strong>Gemini</strong> supporte l'analyse d'images médicales (radiographies, photos, etc.)</li>
                    <li><strong>ChatGPT</strong> fournit une analyse textuelle uniquement</li>
                    <li>Votre clé API est stockée de manière sécurisée et n'est jamais partagée</li>
                    <li>Si aucune clé n'est configurée, la configuration par défaut du serveur sera utilisée</li>
                </ul>
            </div>
        </div>
    );
}

export default DoctorSettings;
