import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthShell from '../../components/common/AuthShell';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import '../../styles/auth.css';

const t = translations;

const coverHighlights = [
    {
        kicker: 'Vision',
        title: 'Un seul cockpit pour le cabinet',
        description: 'Cas actifs, assistants, patients et historique restent visibles dans le meme espace.'
    },
    {
        kicker: 'Rythme',
        title: 'Le dossier avance avant la consultation',
        description: 'Questionnaire, documents et synthese IA arrivent deja structures quand le medecin ouvre le cas.'
    },
    {
        kicker: 'Controle',
        title: 'La validation clinique reste humaine',
        description: 'L IA accelere la lecture et la synthese, mais la decision medicale finale reste la votre.'
    }
];

const coverStats = [
    { value: '3', label: 'espaces relies' },
    { value: '1', label: 'dossier continu' },
    { value: 'OTP', label: 'verification securisee' }
];

function LoginPagePremium() {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();

    function handleChange(e) {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError('');
    }

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
        <AuthShell
            badge="Espace praticien securise"
            coverTitle="Entrez dans un espace clinique plus net."
            coverSubtitle="Connectez-vous pour suivre les dossiers, piloter votre equipe et garder le flux patient sous controle sans bruit inutile."
            coverHighlights={coverHighlights}
            coverStats={coverStats}
            panelTitle="Bienvenue docteur"
            panelSubtitle="Connectez-vous a votre espace MediConsult."
            footer={
                <>
                    {t.auth.noAccount} <Link to="/register">{t.auth.register}</Link>
                </>
            }
        >
            {error && <div className="alert alert-error auth-alert">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-row">
                    <Input
                        label={t.auth.email}
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="exemple@cabinet.fr"
                        autoComplete="email"
                        required
                        className="auth-input"
                    />
                </div>

                <div className="form-row">
                    <Input
                        label={t.auth.password}
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Mot de passe"
                        autoComplete="current-password"
                        required
                        className="auth-input"
                    />
                </div>

                <div className="auth-row-end">
                    <Link to="/forgot-password" className="auth-inline-link">
                        {t.auth.forgotPassword}
                    </Link>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="auth-submit"
                    loading={loading}
                >
                    {t.auth.loginButton}
                </Button>
            </form>

            <p className="auth-panel-note">
                L IA assiste la lecture du dossier. La validation clinique finale reste humaine.
            </p>
        </AuthShell>
    );
}

export default LoginPagePremium;
