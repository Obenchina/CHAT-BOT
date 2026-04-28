import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../common/LoadingSpinner';
import doctorService from '../../../services/doctorService';
import translations from '../../../constants/translations';
import '../../../styles/profile.css';

const t = translations;

import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

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

    const AI_PROVIDERS = [
        {
            id: 'gemini',
            name: 'Google Gemini',
            icon: 'G',
            description: 'Google AI',
            models: [
                { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
                { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash' },
                { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
            ]
        },
        {
            id: 'openai',
            name: 'OpenAI ChatGPT',
            icon: 'AI',
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
                    model: provConfigs[active]?.model || (active === 'gemini' ? 'gemini-2.5-flash' : 'gpt-5.4-mini')
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
export default AiConfigTab;
