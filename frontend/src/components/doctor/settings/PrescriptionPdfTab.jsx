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
import GrowthCurveManager from './GrowthCurveManager';

const t = translations;

import SmartToyIcon from '@mui/icons-material/SmartToy';
import DescriptionIcon from '@mui/icons-material/Description';

function PrescriptionPdfTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAnalyses, setSavingAnalyses] = useState(false);
    const [savingLetter, setSavingLetter] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [analysesMessage, setAnalysesMessage] = useState({ type: '', text: '' });
    const [letterMessage, setLetterMessage] = useState({ type: '', text: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [formData, setFormData] = useState(DEFAULT_PRESCRIPTION_CONFIG);
    const [analysesList, setAnalysesList] = useState('');
    const [letterTemplate, setLetterTemplate] = useState('');
    const [activePdfTab, setActivePdfTab] = useState('ordonnance');

    const DEFAULT_ANALYSES = `Glycemie\nNFS + equilibre leucocytaire\nReticulocytes Frottis sanguin\nTest de COOMBS\nTP - TCK\nDosage IgE seriques\nASLO\nVS\nC-proteine reactive\nDosage ponderal des Ig\nHb A1C\nTSH\nFT3\nFT4\nPTH\nTransaminases (ASAT, ALAT)\nGamma GT\nEBV / MNI test\nRubeole\nCMV\nSerologie coeliaque\nGroupage Sg ABO/Rhesus D\nFer\nFerritine\nElectrophorese de l'Hb\nBilirubineTDI\nCalcium\nIonogramme sanguin\nUree - creatinine\nMicro albuminurie\nECBU\nDosage GH / iGf1\nCortisol\nPhosphatase alcaline\nCPK\nHepatite A - B - C\nVIH\nToxoplasmose\nAC anti-Transglutaminase\nAC IgG - A anti-Gliadine\nAC IgA anti-Endomysium\nAC Anti reticuline`;

    const DEFAULT_LETTER = `Cher confrère,\n\nPermettez-moi de vous adresser le patient susnommé(e), âgé(e) de [Âge], aux ATCDs de ......\n\nQui présente .......\n.....\n......\n\nA l'examen clinique ...\n......\n.......\n\nJe vous le confie pour .....\n\n                                        Confraternellement.`;

    useEffect(() => {
        loadAllConfigs();
    }, []);

    async function loadAllConfigs() {
        try {
            const [prescRes, analysesRes, letterRes] = await Promise.all([
                doctorService.getPrescriptionConfig(),
                doctorService.getAnalysesConfig(),
                doctorService.getLetterConfig()
            ]);

            if (prescRes.success && prescRes.data) {
                const nextConfig = {
                    ...DEFAULT_PRESCRIPTION_CONFIG,
                    ...prescRes.data,
                    primaryColor: prescRes.data.primaryColor || DEFAULT_PRESCRIPTION_CONFIG.primaryColor,
                    accentColor: prescRes.data.accentColor || DEFAULT_PRESCRIPTION_CONFIG.accentColor
                };

                setFormData(nextConfig);
                setLogoPreview(getUploadAssetUrl(nextConfig.logoPath));
            }

            if (analysesRes.success && analysesRes.data) {
                setAnalysesList(analysesRes.data.analysesList || DEFAULT_ANALYSES);
            } else {
                setAnalysesList(DEFAULT_ANALYSES);
            }

            if (letterRes.success && letterRes.data) {
                setLetterTemplate(letterRes.data.letterTemplate || DEFAULT_LETTER);
            } else {
                setLetterTemplate(DEFAULT_LETTER);
            }
        } catch (error) {
            console.error('Load configs error:', error);
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
            payload.append('specialtyText', formData.specialtyText);
            payload.append('servicesText', formData.servicesText);

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
                setMessage({ type: 'success', text: "Configuration de l'ordonnance enregistrée avec succès." });
            }
        } catch (error) {
            setMessage({ type: 'danger', text: error.message || 'Erreur lors de la sauvegarde de l ordonnance.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveAnalyses(event) {
        event.preventDefault();
        setSavingAnalyses(true);
        setAnalysesMessage({ type: '', text: '' });

        try {
            const response = await doctorService.updateAnalysesConfig({ analysesList });
            if (response.success) {
                setAnalysesMessage({ type: 'success', text: 'Liste des bilans enregistrée avec succès.' });
            }
        } catch (error) {
            setAnalysesMessage({ type: 'danger', text: error.message || 'Erreur lors de la sauvegarde.' });
        } finally {
            setSavingAnalyses(false);
        }
    }

    async function handleSaveLetter(event) {
        event.preventDefault();
        setSavingLetter(true);
        setLetterMessage({ type: '', text: '' });

        try {
            const response = await doctorService.updateLetterConfig({ letterTemplate });
            if (response.success) {
                setLetterMessage({ type: 'success', text: 'Modèle de lettre enregistré avec succès.' });
            }
        } catch (error) {
            setLetterMessage({ type: 'danger', text: error.message || 'Erreur lors de la sauvegarde.' });
        } finally {
            setSavingLetter(false);
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
            <div className="prescription-settings-left">
                {/* Horizontal Tab Selector */}
                <div style={{ display: 'flex', gap: '0', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', width: 'fit-content', marginBottom: 'var(--space-lg)' }}>
                    {[
                        { key: 'ordonnance', icon: '🎨', label: 'En-t\u00eate & Couleurs' },
                        { key: 'analyses', icon: '🔬', label: 'Analyses' },
                        { key: 'lettre', icon: '✉️', label: 'Lettre' },
                        { key: 'curves', icon: '📈', label: 'Courbes OMS' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActivePdfTab(tab.key)}
                            style={{
                                padding: 'var(--space-sm) var(--space-lg)',
                                border: 'none',
                                background: activePdfTab === tab.key ? 'var(--primary)' : 'var(--bg-card)',
                                color: activePdfTab === tab.key ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: activePdfTab === tab.key ? '600' : '400',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>

                {activePdfTab === 'ordonnance' && (
                    <div className="profile-section-card">
                        <div className="section-header">
                            <div className="section-title">
                                <span>🎨</span> Configuration de l'ordonnance
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
                                    <label>Spécialité affichée</label>
                                    <input
                                        type="text"
                                        value={formData.specialtyText}
                                        onChange={(e) => handleFieldChange('specialtyText', e.target.value)}
                                        className="input-field"
                                        maxLength={180}
                                        placeholder="Urologue, Médecin généraliste, Nutritionniste..."
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Registre des services</label>
                                    <textarea
                                        value={formData.servicesText}
                                        onChange={(e) => handleFieldChange('servicesText', e.target.value)}
                                        className="input-field"
                                        rows="6"
                                        maxLength={1200}
                                        placeholder={'Un service par ligne\\nÉchographie\\nTraitement des calculs urinaires\\nSuivi nutritionnel'}
                                    />
                                    <p className="prescription-help-text">
                                        Saisissez chaque service sur une ligne distincte. Ils apparaîtront dans l'en-tête du PDF.
                                    </p>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-save" disabled={saving}>
                                    {saving ? 'Enregistrement...' : 'Enregistrer la personnalisation'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ====== SECTION 2: Analyses PDF Customization ====== */}
                {activePdfTab === 'analyses' && (
                    <div className="profile-section-card">
                        <div className="section-header">
                            <div className="section-title">
                                <span>🔬</span> Personnalisation PDF des analyses
                            </div>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            L'en-tête du PDF utilise la même configuration que l'ordonnance (logo, couleurs, spécialité).
                            Configurez ici la liste des bilans biologiques que vous utilisez.
                        </p>

                        {analysesMessage.text && (
                            <div className={`alert alert-${analysesMessage.type}`} style={{ marginBottom: 'var(--space-md)' }}>
                                {analysesMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleSaveAnalyses}>
                            <div className="input-group">
                                <label>Liste des analyses (une par ligne)</label>
                                <textarea
                                    value={analysesList}
                                    onChange={(e) => setAnalysesList(e.target.value)}
                                    className="input-field"
                                    rows="12"
                                    maxLength={5000}
                                    placeholder={'Glycémie\nNFS\nTP - TCK\n...'}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.6' }}
                                />
                                <p className="prescription-help-text">
                                    Saisissez chaque analyse sur une ligne distincte. Cette liste apparaîtra dans la page de détails du dossier.
                                </p>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-save" disabled={savingAnalyses}>
                                    {savingAnalyses ? 'Enregistrement...' : 'Enregistrer la liste des analyses'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ====== SECTION 3: Letter Template Customization ====== */}
                {activePdfTab === 'lettre' && (
                    <div className="profile-section-card">
                        <div className="section-header">
                            <div className="section-title">
                                <span>✉️</span> Personnalisation de la lettre
                            </div>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            L'en-tête du PDF utilise la même configuration que l'ordonnance.
                            Configurez ici le modèle de lettre d'orientation pré-rempli.
                        </p>

                        {letterMessage.text && (
                            <div className={`alert alert-${letterMessage.type}`} style={{ marginBottom: 'var(--space-md)' }}>
                                {letterMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleSaveLetter}>
                            <div className="input-group">
                                <label>Modèle de lettre d'orientation</label>
                                <textarea
                                    value={letterTemplate}
                                    onChange={(e) => setLetterTemplate(e.target.value)}
                                    className="input-field"
                                    rows="12"
                                    maxLength={5000}
                                    placeholder={'Cher confrère,\n\nPermettez-moi de vous adresser le patient...'}
                                    style={{ fontSize: '0.9rem', lineHeight: '1.7' }}
                                />
                                <p className="prescription-help-text">
                                    Ce texte sera pré-rempli dans la page de consultation. Vous pourrez le modifier avant de générer le PDF.
                                </p>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-save" disabled={savingLetter}>
                                    {savingLetter ? 'Enregistrement...' : 'Enregistrer le modele de lettre'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activePdfTab === 'curves' && (
                    <GrowthCurveManager />
                )}
            </div>

            {/* ====== Preview Card ====== */}
            <div className="prescription-settings-right">
                <div className="profile-section-card">
                    <div className="section-header">
                        <div className="section-title">
                            <span>Vue</span> Aperçu rapide
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

                            <div className="prescription-preview-header" style={{
                                paddingBottom: '14px',
                                borderBottom: '1px solid #e3edf4',
                                marginBottom: '14px'
                            }}>
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
                                        <span>{formData.specialtyText || 'Medecine generale'}</span>
                                        {(formData.servicesText || 'Echographie\nSuivi nutritionnel')
                                            .split('\n')
                                            .map(line => line.trim())
                                            .filter(Boolean)
                                            .slice(0, 3)
                                            .map(service => (
                                                <small key={service}>- {service}</small>
                                            ))}
                                    </div>
                                </div>
                                <div className="prescription-preview-date">17/04/2026</div>
                            </div>

                            {/* Contact Box placed directly below header just like the generated PDF */}
                            <div className="prescription-preview-contact" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none', marginBottom: '20px' }}>
                                Mobile: 06 00 00 00 00 | Email: cabinet@example.com | Adresse: Votre cabinet
                            </div>

                            <div className="prescription-preview-patient">
                                <div>
                                    <span>Nom</span>
                                    <strong>PATIENT</strong>
                                </div>
                                <div>
                                    <span>Prénom</span>
                                    <strong>EXEMPLE</strong>
                                </div>
                                <div>
                                    <span>Âge</span>
                                    <strong>45 ans</strong>
                                </div>
                            </div>

                            {activePdfTab === 'ordonnance' && (
                                <>
                                    <h3>ORDONNANCE</h3>
                                    <div className="prescription-preview-med">
                                        <strong>1. Paracetamol</strong>
                                        <span>500mg - 3x/jour - 5 jours</span>
                                    </div>
                                    <div className="prescription-preview-med">
                                        <strong>2. Ibuprofene</strong>
                                        <span>400mg - 2x/jour - 3 jours</span>
                                    </div>
                                </>
                            )}

                            {activePdfTab === 'analyses' && (
                                <>
                                    <h3>BILAN BIOLOGIQUE</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 16px', color: '#1c2b39', fontSize: '0.88rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '1rem', width: '20px' }}>-</span>
                                            <span>Glycemie</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '1rem', width: '20px' }}>-</span>
                                            <span>NFS + equilibre leucocytaire</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '1rem', width: '20px' }}>-</span>
                                            <span>Dosage IgE seriques</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activePdfTab === 'lettre' && (
                                <>
                                    <h3>LETTRE D'ORIENTATION</h3>
                                    <div style={{ padding: '16px', borderRadius: '18px', border: '1px solid #d7e5f0', fontSize: '0.85rem', color: '#1c2b39', lineHeight: '1.6' }}>
                                        <p>Cher confrere,</p>
                                        <br />
                                        <p>Permettez moi de vous adresser le patient sus nomme(e), sus age(e)...</p>
                                        <p>A l'examen clinique ...</p>
                                        <br />
                                        <div style={{ textAlign: 'right' }}>confraternellement.</div>
                                    </div>
                                </>
                            )}

                            <div className="prescription-preview-signature">
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
export default PrescriptionPdfTab;