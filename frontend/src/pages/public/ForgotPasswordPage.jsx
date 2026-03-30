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
            setError('Erreur lors du renvoi');
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                {/* Logo */}
                <div className="auth-logo">
                    <span className="logo-icon">🏥</span>
                    <span className="logo-text">MediConsult</span>
                </div>

                {/* Step 1: Email */}
                {step === 'email' && (
                    <>
                        <h1 className="auth-title">Mot de passe oublié</h1>
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Entrez votre adresse email pour recevoir un code de vérification.
                        </p>

                        {error && <div className="alert alert-error">{error}</div>}

                        <form onSubmit={handleSendOtp} className="auth-form">
                            <Input
                                label={t.auth.email}
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                placeholder="exemple@email.com"
                                required
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                loading={loading}
                                style={{ width: '100%' }}
                            >
                                Envoyer le code
                            </Button>
                        </form>
                    </>
                )}

                {/* Step 2: OTP */}
                {step === 'otp' && (
                    <>
                        <h1 className="auth-title">Vérification</h1>
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Entrez le code à 6 chiffres envoyé à <strong>{email}</strong>
                        </p>

                        {error && <div className="alert alert-error">{error}</div>}

                        <form onSubmit={handleVerifyOtp} className="auth-form">
                            <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                justifyContent: 'center',
                                marginBottom: '1.5rem'
                            }}>
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
                                        style={{
                                            width: '3rem',
                                            height: '3.5rem',
                                            textAlign: 'center',
                                            fontSize: '1.5rem',
                                            fontWeight: '600',
                                            borderRadius: '10px',
                                            border: '2px solid var(--border-color)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                ))}
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                style={{ width: '100%' }}
                            >
                                Vérifier le code
                            </Button>

                            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                {resendTimer > 0 ? (
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        Renvoyer dans {resendTimer}s
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--primary)',
                                            cursor: 'pointer',
                                            fontWeight: '500',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        Renvoyer le code
                                    </button>
                                )}
                            </div>
                        </form>
                    </>
                )}

                {/* Step 3: New Password */}
                {step === 'reset' && (
                    <>
                        <h1 className="auth-title">Nouveau mot de passe</h1>
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Choisissez votre nouveau mot de passe.
                        </p>

                        {error && <div className="alert alert-error">{error}</div>}

                        <form onSubmit={handleResetPassword} className="auth-form">
                            <Input
                                label="Nouveau mot de passe"
                                type="password"
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                placeholder="••••••••"
                                required
                            />

                            <Input
                                label="Confirmer le mot de passe"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                placeholder="••••••••"
                                required
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                loading={loading}
                                style={{ width: '100%' }}
                            >
                                Réinitialiser le mot de passe
                            </Button>
                        </form>
                    </>
                )}

                {/* Back to login */}
                <div className="auth-switch">
                    <Link to="/login">← Retour à la connexion</Link>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;
