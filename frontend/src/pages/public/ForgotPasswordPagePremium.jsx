import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/common/AuthShell';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import { showSuccess } from '../../utils/toast';
import authService from '../../services/authService';
import '../../styles/auth.css';

const t = translations;

const coverHighlights = [
    {
        kicker: 'Recuperation',
        title: 'Acces retrouve sans casser la securite',
        description: 'Le reset suit un parcours clair avec verification email et nouveau mot de passe.'
    },
    {
        kicker: 'Protection',
        title: 'Code temporaire a usage court',
        description: 'Le compte n est jamais reouvert sans verification OTP prealable.'
    },
    {
        kicker: 'Continuite',
        title: 'Le cabinet reprend sans perte de contexte',
        description: 'Une fois reconnecte, le praticien retrouve le meme espace de travail et le meme historique.'
    }
];

const coverStats = [
    { value: '3', label: 'etapes de recuperation' },
    { value: '60s', label: 'fenetre de renvoi' },
    { value: 'OTP', label: 'controle email' }
];

function ForgotPasswordPagePremium() {
    const navigate = useNavigate();
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);

    const otpRefs = useRef([]);

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    async function handleSendOtp(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authService.forgotPassword(email);

            if (response.success) {
                setStep('otp');
                setResendTimer(60);
                showSuccess('Un code de verification a ete envoye a votre email');
            } else {
                setError(response.message || 'Erreur lors de l envoi');
            }
        } catch (err) {
            console.error('Error sending OTP:', err);
            setError('Erreur serveur. Reessayez.');
        } finally {
            setLoading(false);
        }
    }

    function handleOtpChange(index, value) {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError('');

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
            setOtp(pastedData.split(''));
            otpRefs.current[5]?.focus();
        }
    }

    function handleVerifyOtp(e) {
        e.preventDefault();
        const otpCode = otp.join('');

        if (otpCode.length !== 6) {
            setError('Veuillez entrer le code complet a 6 chiffres');
            return;
        }

        setStep('reset');
        setError('');
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caracteres');
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
                showSuccess('Mot de passe reinitialise avec succes');
                navigate('/login');
            } else {
                setError(response.message || 'Erreur lors de la reinitialisation');
            }
        } catch (err) {
            console.error('Reset password error:', err);
            setError(err.response?.data?.message || 'Erreur serveur. Reessayez.');
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        if (resendTimer > 0) return;

        try {
            await authService.forgotPassword(email);
            setResendTimer(60);
            showSuccess('Code renvoye');
        } catch (err) {
            console.error('Error resending OTP:', err);
            setError('Erreur lors du renvoi');
        }
    }

    const panelTitle =
        step === 'email'
            ? 'Mot de passe oublie ?'
            : step === 'otp'
                ? 'Verification'
                : 'Nouveau mot de passe';

    const panelSubtitle =
        step === 'email'
            ? 'Entrez votre adresse email pour recevoir un code de verification.'
            : step === 'otp'
                ? `Saisissez le code envoye a ${email}`
                : 'Choisissez un mot de passe fort pour reprendre l acces.';

    const activeStep = step === 'email' ? 0 : step === 'otp' ? 1 : 2;

    return (
        <AuthShell
            badge="Recuperation de compte"
            coverTitle="Retrouvez l acces sans fragiliser le compte."
            coverSubtitle="Le parcours de recuperation garde la meme logique que le produit: verification claire, action tracee et retour rapide a l espace praticien."
            coverHighlights={coverHighlights}
            coverStats={coverStats}
            panelTitle={panelTitle}
            panelSubtitle={panelSubtitle}
            steps={['Email', 'Code', 'Mot de passe']}
            activeStep={activeStep}
            footer={<Link to="/login">Retour a la connexion</Link>}
        >
            {error && <div className="alert alert-error auth-alert">{error}</div>}

            {step === 'email' && (
                <form onSubmit={handleSendOtp} className="auth-form">
                    <div className="form-row">
                        <Input
                            label={t.auth.email}
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError('');
                            }}
                            placeholder="exemple@cabinet.fr"
                            autoComplete="email"
                            className="auth-input"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={loading}
                        className="auth-submit"
                    >
                        Envoyer le code
                    </Button>
                </form>
            )}

            {step === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="auth-form auth-otp-stage">
                    <p className="auth-otp-note">
                        Collez ou saisissez les 6 chiffres recus pour poursuivre la reinitialisation.
                    </p>

                    <div className="otp-inputs">
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => {
                                    otpRefs.current[i] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength="1"
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
                        className="auth-submit"
                    >
                        Verifier le code
                    </Button>

                    <div className="auth-otp-actions">
                        {resendTimer > 0 ? (
                            <span>Renvoyer le code dans {resendTimer}s</span>
                        ) : (
                            <button type="button" onClick={handleResend} className="auth-text-button">
                                Renvoyer le code
                            </button>
                        )}
                    </div>
                </form>
            )}

            {step === 'reset' && (
                <form onSubmit={handleResetPassword} className="auth-form">
                    <div className="form-row">
                        <Input
                            label="Nouveau mot de passe"
                            type="password"
                            value={newPassword}
                            onChange={(e) => {
                                setNewPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="Minimum 6 caracteres"
                            autoComplete="new-password"
                            className="auth-input"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <Input
                            label="Confirmer le mot de passe"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="Confirmez le mot de passe"
                            autoComplete="new-password"
                            className="auth-input"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={loading}
                        className="auth-submit"
                    >
                        Reinitialiser le mot de passe
                    </Button>
                </form>
            )}
        </AuthShell>
    );
}

export default ForgotPasswordPagePremium;
