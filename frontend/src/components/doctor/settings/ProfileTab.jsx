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

import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

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
export default ProfileTab;