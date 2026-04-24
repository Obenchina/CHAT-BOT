import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthShell from '../../components/common/AuthShell';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import { SPECIALTY_OPTIONS, GENDER_OPTIONS } from '../../constants/config';
import authService from '../../services/authService';
import { showSuccess } from '../../utils/toast';
import '../../styles/auth.css';

const t = translations;

const coverHighlights = [
    {
        kicker: 'Inauguration',
        title: 'Établissez votre cadre clinique',
        description: 'Configurez votre environnement de travail, intégrez vos collaborateurs et structurez votre flux patient dès aujourd\'hui.'
    },
    {
        kicker: 'Sécurité',
        title: 'Protocole d\'Activation Sécurisé',
        description: 'Chaque compte fait l\'objet d\'une validation par code OTP garantissant l\'intégrité de vos accès.'
    },
    {
        kicker: 'Performance',
        title: 'Un écosystème centré sur le patient',
        description: 'Assistant, patient et praticien collaborent au sein d\'un dossier unique pour éliminer toute redondance.'
    }
];

const coverStats = [
    { value: '2', label: 'Étapes de Validation' },
    { value: 'PDF', label: 'Édition de Rapports' },
    { value: 'IA', label: 'Synthèse Clinique' }
];

function RegisterPagePremium() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        gender: '',
        phone: '',
        address: '',
        specialty: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showOTP, setShowOTP] = useState(false);
    const [pendingId, setPendingId] = useState(null);
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    const otpInputRefs = useRef([]);
    const { register, verifyRegistration } = useAuth();

    useEffect(() => {
        let timer;

        if (resendTimer > 0) {
            timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
        }

        return () => clearTimeout(timer);
    }, [resendTimer]);

    function handleChange(e) {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    function validate() {
        const newErrors = {};

        if (!formData.email) newErrors.email = t.errors.required;
        if (!formData.password) newErrors.password = t.errors.required;
        if (formData.password.length < 6) {
            newErrors.password = 'Minimum 6 caractères requis';
        }
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = t.errors.passwordMismatch;
        }
        if (!formData.firstName) newErrors.firstName = t.errors.required;
        if (!formData.lastName) newErrors.lastName = t.errors.required;
        if (!formData.phone) newErrors.phone = t.errors.required;
        if (!formData.specialty) newErrors.specialty = t.errors.required;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        setErrors({});

        try {
            const result = await register(formData);

            if (result.success && result.data?.pendingId) {
                setPendingId(result.data.pendingId);
                setShowOTP(true);
                setResendTimer(60);
            } else {
                setErrors({ general: result.message || 'Une erreur est survenue' });
            }
        } catch (err) {
            console.error('Registration error:', err);
            setErrors({ general: t.errors.serverError });
        } finally {
            setLoading(false);
        }
    }

    function handleOtpChange(index, value) {
        if (!/^\d?$/.test(value)) return;

        const newOtp = [...otpCode];
        newOtp[index] = value;
        setOtpCode(newOtp);
        setOtpError('');

        if (value && index < otpCode.length - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
    }

    function handleOtpKeyDown(index, e) {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    }

    function handleOtpPaste(e) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

        if (pastedData.length === 6) {
            setOtpCode(pastedData.split(''));
            otpInputRefs.current[5]?.focus();
            setOtpError('');
        }
    }

    async function handleVerifyOTP() {
        const code = otpCode.join('');

        if (code.length < 6) {
            setOtpError('Veuillez entrer le code à 6 chiffres');
            return;
        }

        setVerifying(true);
        setOtpError('');

        try {
            const result = await verifyRegistration(pendingId, code);

            if (!result.success) {
                setOtpError(result.message || 'Code invalide ou expiré');
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            setOtpError('Erreur de connexion au serveur');
        } finally {
            setVerifying(false);
        }
    }

    async function handleResendOTP() {
        if (resendTimer > 0) return;

        try {
            const result = await authService.resendOtp(pendingId);

            if (result.success) {
                setResendTimer(60);
                setOtpError('');
                showSuccess('Un nouveau code a été envoyé à votre adresse e-mail.');
            } else {
                setOtpError(result.message || 'Erreur lors du renvoi du code');
            }
        } catch (error) {
            console.error('OTP resend error:', error);
            setOtpError('Erreur lors du renvoi du code');
        }
    }

    return (
        <AuthShell
            badge="Ouverture de Compte Praticien"
            coverTitle="Définissez votre cadre clinique en quelques clics."
            coverSubtitle="L'inscription initialise un point de contrôle unique pour la coordination de vos soins et le pilotage de votre équipe."
            coverHighlights={coverHighlights}
            coverStats={coverStats}
            panelTitle={showOTP ? 'Vérification de l\'adresse e-mail' : t.auth.registerTitle}
            panelSubtitle={
                showOTP
                    ? `Code d'activation transmis à ${formData.email}`
                    : 'Initialisez votre infrastructure numérique sécurisée.'
            }
            steps={['Profil Professionnel', 'Vérification']}
            activeStep={showOTP ? 1 : 0}
            wide
            footer={
                <>
                    {t.auth.hasAccount} <Link to="/login">{t.auth.login}</Link>
                </>
            }
        >
            {!showOTP ? (
                <>
                    {errors.general && <div className="alert alert-error auth-alert">{errors.general}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-row">
                            <Input
                                label={t.auth.email}
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                error={errors.email}
                                placeholder="votre.email@cabinet.fr"
                                autoComplete="email"
                                className="auth-input"
                                required
                            />
                        </div>

                        <div className="form-row-2">
                            <Input
                                label={t.auth.password}
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                error={errors.password}
                                placeholder="Minimum 6 caractères"
                                autoComplete="new-password"
                                className="auth-input"
                                required
                            />

                            <Input
                                label={t.auth.confirmPassword}
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                error={errors.confirmPassword}
                                placeholder="Confirmez le mot de passe"
                                autoComplete="new-password"
                                className="auth-input"
                                required
                            />
                        </div>

                        <div className="form-row-2">
                            <Input
                                label={t.doctor.firstName}
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                error={errors.firstName}
                                placeholder="Prénom"
                                autoComplete="given-name"
                                className="auth-input"
                                required
                            />

                            <Input
                                label={t.doctor.lastName}
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                error={errors.lastName}
                                placeholder="Nom"
                                autoComplete="family-name"
                                className="auth-input"
                                required
                            />
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label className="form-label">{t.doctor.gender}</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className="form-input form-select auth-input"
                                >
                                    <option value="">Sélectionner</option>
                                    {GENDER_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Input
                                label={t.doctor.phone}
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                error={errors.phone}
                                placeholder="Numéro de contact"
                                autoComplete="tel"
                                className="auth-input"
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    {t.doctor.specialty} <span className="auth-required">*</span>
                                </label>
                                <select
                                    name="specialty"
                                    value={formData.specialty}
                                    onChange={handleChange}
                                    className={`form-input form-select auth-input${errors.specialty ? ' error' : ''}`}
                                    required
                                >
                                    <option value="">Sélectionner une spécialité</option>
                                    {SPECIALTY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.specialty && <span className="form-error">{errors.specialty}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t.doctor.address}</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="form-input auth-input auth-textarea"
                                    rows="3"
                                    placeholder="Adresse complète du cabinet"
                                    autoComplete="street-address"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={loading}
                            className="auth-submit"
                        >
                            {t.auth.registerButton}
                        </Button>
                    </form>
                </>
            ) : (
                <div className="auth-otp-stage">
                    {otpError && <div className="alert alert-error auth-alert">{otpError}</div>}

                    <p className="auth-otp-note">
                        Veuillez saisir le code d'activation reçu par e-mail pour finaliser la création de votre espace.
                    </p>

                    <div className="otp-inputs">
                        {otpCode.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => {
                                    otpInputRefs.current[index] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                onPaste={index === 0 ? handleOtpPaste : undefined}
                                className="otp-box"
                            />
                        ))}
                    </div>

                    <Button
                        variant="primary"
                        size="lg"
                        className="auth-submit"
                        onClick={handleVerifyOTP}
                        loading={verifying}
                    >
                        Confirmer l'Activation
                    </Button>

                    <div className="auth-otp-actions">
                        <span>Aucun code reçu ?</span>
                        <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={resendTimer > 0}
                            className="auth-text-button"
                        >
                            {resendTimer > 0 ? `Demander un nouveau code dans ${resendTimer}s` : 'Demander un nouveau code'}
                        </button>
                    </div>
                </div>
            )}
        </AuthShell>
    );
}

export default RegisterPagePremium;
