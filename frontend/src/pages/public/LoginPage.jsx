/**
 * Login Page
 * User authentication page
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import '../../styles/auth.css';

const t = translations;

function LoginPage() {
    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Auth context
    const { login } = useAuth();

    // Handle input change
    function handleChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    }

    // Handle form submit
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(formData.email, formData.password);

            if (!result.success) {
                setError(result.message || t.auth.invalidCredentials);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(t.errors.serverError);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            {/* Left Cover - Desktop Only */}
            <div className="auth-cover">
                <div className="auth-cover-content">
                    <h1 className="auth-cover-title">L'Excellence Médicale,<br />Simplifiée.</h1>
                    <p className="auth-cover-subtitle">
                        Accédez à votre espace sécurisé pour gérer vos assistants, suivre vos patients et tirer parti de l'intelligence artificielle.
                    </p>
                    <div className="auth-trust-badges">
                        <span className="trust-badge">🔒 Connexion Sécurisée</span>
                        <span className="trust-badge">⚕️ Conformité Médicale</span>
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
                        <h2 className="auth-title">Bienvenue Docteur</h2>
                        <p className="auth-subtitle">Veuillez vous connecter à votre compte</p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                            {error}
                        </div>
                    )}

                    {/* Login form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-row">
                            <Input
                                label={t.auth.email}
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="exemple@cabinet.fr"
                                required
                                className="input-premium"
                            />
                        </div>

                        <div className="form-row" style={{ marginBottom: 0 }}>
                            <Input
                                label={t.auth.password}
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                className="input-premium"
                            />
                        </div>

                        <div className="auth-forgot">
                            <Link to="/forgot-password">{t.auth.forgotPassword}</Link>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="btn-premium"
                            loading={loading}
                        >
                            {t.auth.loginButton}
                        </Button>
                    </form>

                    {/* Register link */}
                    <div className="auth-switch">
                        {t.auth.noAccount}
                        <Link to="/register">{t.auth.register}</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
