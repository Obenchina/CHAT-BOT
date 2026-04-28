/**
 * Assistant Profile Page
 * View assistant profile (read-only)
 */

import { useState, useEffect } from 'react';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import assistantService from '../../services/assistantService';
import authService from '../../services/authService';
import translations from '../../constants/translations';
import { showSuccess } from '../../utils/toast';

const t = translations;

import '../../styles/profile.css';

function AssistantProfile() {
    // State
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    const [passwordData, setPasswordData] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const [message, setMessage] = useState({ type: '', text: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    // Load profile
    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        try {
            const response = await assistantService.getProfile();
            if (response.success || response.data) {
                const data = response.data?.data || response.data || response;
                if (data) {
                    setProfile(data);
                    setFormData({
                        firstName: data.first_name || data.firstName || '',
                        lastName: data.last_name || data.lastName || '',
                        email: data.email || '',
                        phone: data.phone || ''
                    });
                }
            }
        } catch (error) {
            console.error('Load profile error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleProfileUpdate(e) {
        e.preventDefault();
        setUpdating(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await assistantService.updateProfile(formData);
            if (response.success) {
                setProfile(prev => ({
                    ...prev,
                    ...response.data,
                    first_name: response.data.firstName,
                    last_name: response.data.lastName
                }));
                setIsEditing(false);
                setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
            }
        } catch (error) {
            console.error('Update profile error:', error);
            setMessage({ type: 'danger', text: error.response?.data?.message || 'Erreur lors de la mise à jour du profil' });
        } finally {
            setUpdating(false);
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            setPasswordMessage({ type: 'danger', text: 'Les mots de passe ne correspondent pas' });
            return;
        }

        setUpdating(true);
        setPasswordMessage({ type: '', text: '' });

        try {
            const response = await authService.changePassword(passwordData.current, passwordData.new);
            if (response.success) {
                setShowPasswordModal(false);
                setPasswordData({ current: '', new: '', confirm: '' });
                showSuccess('Mot de passe modifié avec succès');
            }
        } catch (error) {
            console.error('Change password error:', error);
            setPasswordMessage({
                type: 'danger',
                text: error.response?.data?.message || 'Erreur lors du changement de mot de passe'
            });
        } finally {
            setUpdating(false);
        }
    }

    // Colors for avatar
    const getInitials = (first, last) => {
        return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();
    };

    return (
        <div className="layout internal-shell assistant-profile-shell">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Mon profil</h1>
                        <p style={{ margin: 0, fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Coordonnées personnelles et sécurité du compte assistant.
                        </p>
                    </div>
                </div>

                <div className="page-content">
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : profile ? (
                        <div className="profile-container">

                            {/* Profile Header */}
                            <div className="profile-header-card">
                                <div className="profile-avatar">
                                    {getInitials(profile.first_name || profile.firstName, profile.last_name || profile.lastName)}
                                </div>
                                <div className="profile-info">
                                    <h2>{profile.first_name || profile.firstName} {profile.last_name || profile.lastName}</h2>
                                    <span className="profile-role">Assistant Médical</span>
                                </div>
                            </div>

                            <div className="profile-content-grid">

                                {/* Personal Information */}
                                <div className="profile-section-card">
                                    <div className="section-header">
                                        <div className="section-title">
                                            Informations personnelles
                                        </div>
                                        {!isEditing && (
                                            <button
                                                className="btn-edit"
                                                onClick={() => setIsEditing(true)}
                                            >
                                                Modifier
                                            </button>
                                        )}
                                    </div>

                                    {message.text && (
                                        <div className={`alert alert-${message.type} mb-4`}>
                                            {message.text}
                                        </div>
                                    )}

                                    {isEditing ? (
                                        <form onSubmit={handleProfileUpdate}>
                                            <div className="form-grid">
                                                <div className="input-group">
                                                    <label>Prénom</label>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        value={formData.firstName}
                                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label>Nom</label>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        value={formData.lastName}
                                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>Email</label>
                                                    <input
                                                        type="email"
                                                        className="input-field"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-actions">
                                                <button
                                                    type="button"
                                                    className="btn-cancel"
                                                    onClick={() => {
                                                        setIsEditing(false);
                                                        setFormData({
                                                            firstName: profile.first_name || profile.firstName || '',
                                                            lastName: profile.last_name || profile.lastName || '',
                                                            email: profile.email || '',
                                                            phone: profile.phone || ''
                                                        });
                                                        setMessage({ type: '', text: '' });
                                                    }}
                                                    disabled={updating}
                                                >
                                                    Annuler
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="btn-save"
                                                    disabled={updating}
                                                >
                                                    {updating ? 'Enregistrement...' : 'Enregistrer les modifications'}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="form-grid">
                                            <div className="info-item">
                                                <div className="info-label">Prénom</div>
                                                <div className="info-value">{profile.first_name || profile.firstName || '-'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">Nom</div>
                                                <div className="info-value">{profile.last_name || profile.lastName || '-'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">Email</div>
                                                <div className="info-value">{profile.email || '-'}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Security Section */}
                                <div className="profile-section-card">
                                    <div className="section-header">
                                        <div className="section-title">
                                            Sécurité
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-gray-500 text-sm">
                                            Gérez votre mot de passe et la sécurité de votre compte.
                                        </p>
                                        <button
                                            className="btn-password"
                                            onClick={() => setShowPasswordModal(true)}
                                        >
                                            Changer le mot de passe
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-body text-center text-gray-500">
                                Profil non trouvé
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal-overlay">
                    <div className="modal-modern">
                        <div className="modal-header">
                            <h3 className="modal-title">Changer le mot de passe</h3>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordData({ current: '', new: '', confirm: '' });
                                    setPasswordMessage({ type: '', text: '' });
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            {passwordMessage.text && (
                                <div className={`alert alert-${passwordMessage.type} mb-4 text-sm`}>
                                    {passwordMessage.text}
                                </div>
                            )}
                            <form onSubmit={handlePasswordChange}>
                                <div className="space-y-4">
                                    <div className="input-group">
                                        <label>Mot de passe actuel</label>
                                        <input
                                            type="password"
                                            className="input-field"
                                            value={passwordData.current}
                                            onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                            required
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            className="input-field"
                                            value={passwordData.new}
                                            onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                            required
                                            minLength={6}
                                            placeholder="Minimum 6 caractères"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Confirmer le mot de passe</label>
                                        <input
                                            type="password"
                                            className="input-field"
                                            value={passwordData.confirm}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                            required
                                            minLength={6}
                                            placeholder="Répétez le mot de passe"
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => setShowPasswordModal(false)}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-save"
                                        disabled={updating}
                                    >
                                        {updating ? 'Modification...' : 'Confirmer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AssistantProfile;
