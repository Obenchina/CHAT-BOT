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
            setError(t.errors.serverError);
        } finally {
            setLoading(false);
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

                {/* Title */}
                <h1 className="auth-title">{t.auth.loginTitle}</h1>

                {/* Error message */}
                {error && (
                    <div className="alert alert-error">
                        {error}
                    </div>
                )}

                {/* Login form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    <Input
                        label={t.auth.email}
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="exemple@email.com"
                        required
                    />

                    <Input
                        label={t.auth.password}
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                    />

                    <div className="auth-forgot">
                        <Link to="/forgot-password">{t.auth.forgotPassword}</Link>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={loading}
                        style={{ width: '100%' }}
                    >
                        {t.auth.loginButton}
                    </Button>
                </form>

                {/* Register link */}
                <div className="auth-switch">
                    {t.auth.noAccount}{' '}
                    <Link to="/register">{t.auth.register}</Link>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
