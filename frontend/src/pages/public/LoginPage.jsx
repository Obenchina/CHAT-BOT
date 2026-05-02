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
        kicker: 'Pilotage',
        title: 'Interface de Gestion Centralisée',
        description: 'Dossiers actifs, collaborateurs et antécédents sont consolidés au sein d\'un écosystème unique.'
    },
    {
        kicker: 'Fluidité',
        title: 'Anticipation du Temps Clinique',
        description: 'L\'anamnèse et la synthèse IA sont structurées avant même l\'ouverture du dossier par le praticien.'
    },
    {
        kicker: 'Éthique',
        title: 'Souveraineté de la Décision',
        description: 'L\'IA optimise l\'analyse et la synthèse, mais la décision clinique finale demeure votre prérogative.'
    }
];

function LoginPage() {
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
            badge="Accès Praticien Sécurisé"
            coverTitle="Un environnement clinique structuré."
            coverSubtitle="Connectez-vous pour superviser vos dossiers, coordonner votre équipe et maintenir une continuité de soins sans friction."
            coverHighlights={coverHighlights}
            panelTitle="Ravi de vous revoir, Docteur"
            panelSubtitle="Accédez à votre espace professionnel MediConsult."
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
                        placeholder="votre.email@cabinet.fr"
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
                        placeholder="••••••••"
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
                L'IA agit comme un assistant à l'analyse. La validation clinique finale demeure humaine et souveraine.
            </p>
        </AuthShell>
    );
}

export default LoginPage;
