/**
 * Forgot Password Page
 * Allows users to reset their password via OTP
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import { showSuccess } from '../../utils/toast';
import authService from '../../services/authService';
import '../../styles/auth.css';

const t = translations;

function ForgotPasswordPage() {
    const navigate = useNavigate();

    // Steps: 'email' -> 'otp' -> 'reset'
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);

    const otpRefs = useRef([]);

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Step 1: Send OTP to email
    async function handleSendOtp(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authService.forgotPassword(email);
            if (response.success) {
                setStep('otp');
                setResendTimer(60);
                showSuccess('Un code de vérification a été envoyé à votre email');
            } else {
                setError(response.message || 'Erreur lors de l\'envoi');
            }
        } catch (err) {
            console.error('Error sending OTP:', err);
            setError('Erreur serveur. Réessayez.');
        } finally {
            setLoading(false);
        }
    }

    // OTP input handling
    function handleOtpChange(index, value) {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError('');

        // Auto focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    }

    function handleOtpKeyDown(index, e) {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    }

    function handleOtpPaste(e) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData.length === 6) {
            const newOtp = pastedData.split('');
            setOtp(newOtp);
            otpRefs.current[5]?.focus();
        }
    }

    // Step 2: Verify OTP and move to reset
    function handleVerifyOtp(e) {
        e.preventDefault();
        const otpCode = otp.join('');
        if (otpCode.length !== 6) {
            setError('Veuillez entrer le code complet à 6 chiffres');
            return;
        }
        setStep('reset');
        setError('');
    }

    // Step 3: Reset password
    async function handleResetPassword(e) {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        setLoading(true);

        try {
            const otpCode = otp.join('');
            const response = await authService.resetPassword(email, otpCode, newPassword);
            if (response.success) {
                showSuccess('Mot de passe réinitialisé avec succès !');
                navigate('/login');
            } else {
                setError(response.message || 'Erreur lors de la réinitialisation');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur serveur. Réessayez.');
        } finally {
            setLoading(false);
        }
    }

    // Resend OTP
    async function handleResend() {
        if (resendTimer > 0) return;
        try {
            await authService.forgotPassword(email);
            setResendTimer(60);
            showSuccess('Code renvoyé !');
        } catch (err) {
            console.error('Error resending OTP:', err);
            setError('Erreur lors du renvoi');
        }
    }

    return (
        <div className="auth-page">
            {/* Left Cover - Desktop Only */}
            <div className="auth-cover">
                <div className="auth-cover-content">
                    <h1 className="auth-cover-title">Récupération Sécurisée.</h1>
                    <p className="auth-cover-subtitle">
                        Nous accordons la plus haute importance à la protection de vos données médicales. Suivez les étapes pour retrouver l'accès à votre espace.
                    </p>
                    <div className="auth-trust-badges">
                        <span className="trust-badge">🔒 Validation Multi-étapes</span>
                        <span className="trust-badge">🛡️ Données Protégées</span>
                    </div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="auth-panel">
                <div className="auth-container">
                    {/* Logo for mobile / alternate header */}
                    <div className="auth-header">
                        <div className="auth-logo">
                            <span className="logo-icon">🏥</span>
                            <span className="logo-text">MediConsult</span>
                        </div>
                    </div>

                    {/* Step 1: Email */}
                    {step === 'email' && (
                        <div className="animate-fade-in">
                            <h2 className="auth-title" style={{ textAlign: 'center' }}>Mot de passe oublié ?</h2>
                            <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                                Entrez votre adresse email pour recevoir un code de vérification.
                            </p>

                            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

                            <form onSubmit={handleSendOtp} className="auth-form">
                                <div className="form-row">
                                    <Input
                                        label={t.auth.email}
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                        placeholder="exemple@cabinet.fr"
                                        className="input-premium"
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    loading={loading}
                                    className="btn-premium"
                                    style={{ marginTop: 'var(--space-md)' }}
                                >
                                    Envoyer le code
                                </Button>
                            </form>
                        </div>
                    )}

                    {/* Step 2: OTP */}
                    {step === 'otp' && (
                        <div className="animate-fade-in">
                            <h2 className="auth-title" style={{ textAlign: 'center' }}>Vérification</h2>
                            <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                                Entrez le code à 6 chiffres envoyé à <br /><strong>{email}</strong>
                            </p>

                            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

                            <form onSubmit={handleVerifyOtp} className="auth-form">
                                <div className="otp-inputs">
                                    {otp.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={el => otpRefs.current[i] = el}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                            onPaste={i === 0 ? handleOtpPaste : undefined}
                                            className="otp-box"
                                        />
                                    ))}
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="btn-premium"
                                    style={{ marginBottom: 'var(--space-lg)' }}
                                >
                                    Vérifier le code
                                </Button>

                                <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                                    {resendTimer > 0 ? (
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            Renvoyer le code dans {resendTimer}s
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResend}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--primary-600)',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                textDecoration: 'underline'
                                            }}
                                        >
                                            Renvoyer le code
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Step 3: New Password */}
                    {step === 'reset' && (
                        <div className="animate-fade-in">
                            <h2 className="auth-title" style={{ textAlign: 'center' }}>Nouveau mot de passe</h2>
                            <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                                Choisissez un mot de passe fort et sécurisé.
                            </p>

                            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

                            <form onSubmit={handleResetPassword} className="auth-form">
                                <div className="form-row">
                                    <Input
                                        label="Nouveau mot de passe"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                        placeholder="••••••••"
                                        className="input-premium"
                                        required
                                    />
                                </div>

                                <div className="form-row" style={{ marginBottom: 0 }}>
                                    <Input
                                        label="Confirmer le mot de passe"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                        placeholder="••••••••"
                                        className="input-premium"
                                        required
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
                                    Réinitialiser le mot de passe
                                </Button>
                            </form>
                        </div>
                    )}

                    {/* Back to login */}
                    <div className="auth-switch">
                        <Link to="/login">← Retour à la connexion</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;
