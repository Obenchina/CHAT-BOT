/**
 * Register Page
 * Doctor registration form with OTP Email Verification
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import { showSuccess } from '../../utils/toast';
import { SPECIALTY_OPTIONS, GENDER_OPTIONS } from '../../constants/config';
import '../../styles/auth.css';

const t = translations;

function RegisterPage() {
    // Form state
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

    // OTP State
    const [showOTP, setShowOTP] = useState(false);
    const [pendingId, setPendingId] = useState(null);
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const otpInputRefs = useRef([]);

    // Auth context
    const { register, verifyRegistration } = useAuth();

    // Timer logic for Resend OTP
    useEffect(() => {
        let timer;
        if (resendTimer > 0) {
            timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendTimer]);

    // Handle input change
    function handleChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Validate form
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

    // Handle form submit (Step 1)
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
                setResendTimer(60); // 60 seconds before able to resend
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

    // Handle OTP Box Change
    const handleOtpChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otpCode];
        newOtp[index] = value;
        setOtpCode(newOtp);
        setOtpError('');

        // Auto focus next
        if (value !== '' && index < 5 && otpInputRefs.current[index + 1]) {
            otpInputRefs.current[index + 1].focus();
        }
    };

    // Handle OTP KeyDown (for Backspace)
    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && otpCode[index] === '' && index > 0 && otpInputRefs.current[index - 1]) {
            otpInputRefs.current[index - 1].focus();
        }
    };

    // Handle OTP Submit (Step 2)
    const handleVerifyOTP = async () => {
        const code = otpCode.join('');
        if (code.length < 6) {
            setOtpError('Veuillez entrer le code à 6 chiffres');
            return;
        }

        setVerifying(true);
        setOtpError('');

        try {
            const result = await verifyRegistration(pendingId, code);
            
            if (result.success) {
                // Success! The AuthContext already handled token saving and redirecting.
            } else {
                setOtpError(result.message || 'Code invalide ou expiré');
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            setOtpError('Erreur de connexion au serveur');
        } finally {
            setVerifying(false);
        }
    };

    // Handle Resend OTP
    const handleResendOTP = async () => {
        if (resendTimer > 0) return;
        
        try {
            const result = await authService.resendOtp(pendingId);
            if (result.success) {
                setResendTimer(60);
                setOtpError('');
                showSuccess('Un nouveau code a été envoyé à votre adresse email.');
            } else {
                setOtpError(result.message || 'Erreur lors du renvoi du code');
            }
        } catch (error) {
            console.error('OTP resend error:', error);
            setOtpError('Erreur lors du renvoi du code');
        }
    };

    return (
        <div className="auth-page">
            {/* Left Cover - Desktop Only */}
            <div className="auth-cover">
                <div className="auth-cover-content">
                    <h1 className="auth-cover-title">L'Excellence Médicale,<br />Simplifiée.</h1>
                    <p className="auth-cover-subtitle">
                        Rejoignez MediConsult pour moderniser la gestion de votre cabinet et intégrer l'IA dans votre pratique quotidienne en toute simplicité.
                    </p>
                    <div className="auth-trust-badges">
                        <span className="trust-badge">🔒 Inscription 100% Sécurisée</span>
                        <span className="trust-badge">⚕️ Conformité Médicale</span>
                    </div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="auth-panel">
                <div className="auth-container auth-container-wide">
                    {/* Logo for mobile / alternate header */}
                    <div className="auth-header">
                        <div className="auth-logo">
                            <span className="logo-icon">🏥</span>
                            <span className="logo-text">MediConsult</span>
                        </div>
                        <h2 className="auth-title">{showOTP ? "Vérification de l'email" : t.auth.registerTitle}</h2>
                        <p className="auth-subtitle">
                            {showOTP ? `Code envoyé à ${formData.email}` : "Création de votre espace praticien sécurisé"}
                        </p>
                    </div>

                    {!showOTP ? (
                        <>
                            {/* Error message */}
                            {errors.general && (
                                <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                                    {errors.general}
                                </div>
                            )}

                            {/* Register form */}
                            <form onSubmit={handleSubmit} className="auth-form">
                                {/* Email & Password row */}
                                <div className="form-row">
                                    <Input
                                        label={t.auth.email}
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        error={errors.email}
                                        placeholder="exemple@cabinet.fr"
                                        className="input-premium"
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
                                        placeholder="••••••••"
                                        className="input-premium"
                                        required
                                    />

                                    <Input
                                        label={t.auth.confirmPassword}
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        error={errors.confirmPassword}
                                        placeholder="••••••••"
                                        className="input-premium"
                                        required
                                    />
                                </div>

                                {/* Name row */}
                                <div className="form-row-2" style={{ marginTop: 'var(--space-md)' }}>
                                    <Input
                                        label={t.doctor.firstName}
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        error={errors.firstName}
                                        placeholder="Jean"
                                        className="input-premium"
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
                                        className="input-premium"
                                        required
                                    />
                                </div>

                                {/* Gender & Phone row */}
                                <div className="form-row-2" style={{ marginTop: 'var(--space-md)' }}>
                                    <div className="form-group">
                                        <label className="form-label">{t.doctor.gender}</label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className="form-input form-select input-premium"
                                        >
                                            <option value="">-- Sélectionner --</option>
                                            {GENDER_OPTIONS.map(opt => (
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
                                        className="input-premium"
                                        required
                                    />
                                </div>

                                {/* Specialty */}
                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">
                                        {t.doctor.specialty} <span style={{ color: 'var(--error)' }}>*</span>
                                    </label>
                                    <select
                                        name="specialty"
                                        value={formData.specialty}
                                        onChange={handleChange}
                                        className={`form-input form-select input-premium ${errors.specialty ? 'error' : ''}`}
                                        required
                                    >
                                        <option value="">-- Sélectionner --</option>
                                        {SPECIALTY_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.specialty && <span className="form-error">{errors.specialty}</span>}
                                </div>

                                {/* Address */}
                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">{t.doctor.address}</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="form-input input-premium"
                                        rows="2"
                                        placeholder="Adresse complète de votre cabinet..."
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    loading={loading}
                                    className="btn-premium"
                                    style={{ marginTop: 'var(--space-lg)' }}
                                >
                                    {t.auth.registerButton}
                                </Button>
                            </form>

                            {/* Login link */}
                            <div className="auth-switch">
                                {t.auth.hasAccount}
                                <Link to="/login">{t.auth.login}</Link>
                            </div>
                        </>
                    ) : (
                        <div className="otp-verification-container animate-fade-in" style={{ textAlign: 'center' }}>
                            {otpError && (
                                <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>
                                    {otpError}
                                </div>
                            )}

                            <div className="otp-inputs">
                                {otpCode.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (otpInputRefs.current[index] = el)}
                                        type="text"
                                        maxLength="1"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="otp-box"
                                    />
                                ))}
                            </div>

                            <Button 
                                variant="primary" 
                                size="lg" 
                                className="btn-premium"
                                style={{ marginBottom: 'var(--space-lg)', marginTop: 'var(--space-md)' }}
                                onClick={handleVerifyOTP}
                                loading={verifying}
                            >
                                Vérifier et Créer le compte
                            </Button>

                            <div style={{ fontSize: '0.875rem' }}>
                                Vous n'avez pas reçu le code ? <br/>
                                <button 
                                    type="button" 
                                    onClick={handleResendOTP}
                                    disabled={resendTimer > 0}
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: resendTimer > 0 ? 'var(--text-secondary)' : 'var(--primary-600)', 
                                        cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        marginTop: '12px',
                                        textDecoration: resendTimer > 0 ? 'none' : 'underline'
                                    }}
                                >
                                    {resendTimer > 0 ? `Renvoyer le code dans ${resendTimer}s` : 'Renvoyer le code'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
