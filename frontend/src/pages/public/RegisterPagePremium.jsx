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
        kicker: 'Demarrage',
        title: 'Ouvrez un espace praticien propre',
        description: 'Creez votre compte, rattachez votre equipe et posez un cadre clair au flux patient.'
    },
    {
        kicker: 'Verification',
        title: 'Activation en deux temps',
        description: 'Le compte est confirme par code OTP avant la premiere connexion.'
    },
    {
        kicker: 'Cadre',
        title: 'Le cabinet reste centre sur son rythme',
        description: 'Assistant, patient et medecin travaillent dans le meme dossier sans re-saisie inutile.'
    }
];

const coverStats = [
    { value: '2', label: 'etapes d activation' },
    { value: 'PDF', label: 'documents exportables' },
    { value: 'IA', label: 'synthese assistee' }
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
            newErrors.password = 'Minimum 6 caracteres requis';
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
            setOtpError('Veuillez entrer le code a 6 chiffres');
            return;
        }

        setVerifying(true);
        setOtpError('');

        try {
            const result = await verifyRegistration(pendingId, code);

            if (!result.success) {
                setOtpError(result.message || 'Code invalide ou expire');
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
                showSuccess('Un nouveau code a ete envoye a votre adresse email.');
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
            badge="Activation de l espace praticien"
            coverTitle="Installez le cadre du cabinet avant la premiere consultation."
            coverSubtitle="L inscription cree un point de controle unique pour le medecin, l assistant et le suivi patient."
            coverHighlights={coverHighlights}
            coverStats={coverStats}
            panelTitle={showOTP ? 'Verification de l email' : t.auth.registerTitle}
            panelSubtitle={
                showOTP
                    ? `Code envoye a ${formData.email}`
                    : 'Creez votre espace praticien securise en quelques champs.'
            }
            steps={['Profil', 'Verification']}
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
                                placeholder="exemple@cabinet.fr"
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
                                placeholder="Minimum 6 caracteres"
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
                                placeholder="Jean"
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
                                placeholder="Dupont"
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
                                    <option value="">Selectionner</option>
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
                                placeholder="06 XX XX XX XX"
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
                                    <option value="">Selectionner</option>
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
                                    placeholder="Adresse complete de votre cabinet"
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
                        Saisissez le code recu puis terminez l activation de votre espace.
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
                        Verifier et creer le compte
                    </Button>

                    <div className="auth-otp-actions">
                        <span>Vous n avez pas recu le code ?</span>
                        <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={resendTimer > 0}
                            className="auth-text-button"
                        >
                            {resendTimer > 0 ? `Renvoyer le code dans ${resendTimer}s` : 'Renvoyer le code'}
                        </button>
                    </div>
                </div>
            )}
        </AuthShell>
    );
}

export default RegisterPagePremium;
