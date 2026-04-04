/**
 * Landing Page
 * Public landing page with introduction to the platform
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import translations from '../../constants/translations';
import '../../styles/pages.css';

const t = translations;

/**
 * Animated counter component
 */
function AnimatedCounter({ target, duration = 2000, suffix = '' }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const startTime = Date.now();
                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        // Ease-out cubic
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setCount(Math.floor(eased * target));
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target, duration]);

    return <span ref={ref}>{count}{suffix}</span>;
}

function LandingPage() {
    return (
        <div className="landing-page">
            {/* Hero Section */}
            <header className="landing-header">
                <nav className="landing-nav">
                    <div className="landing-logo">🏥 MediConsult</div>
                    <div className="landing-nav-links">
                        <Link to="/login" className="btn btn-ghost">
                            {t.auth.login}
                        </Link>
                        <Link to="/register" className="btn btn-primary">
                            {t.auth.register}
                        </Link>
                    </div>
                </nav>

                <div className="hero-content">
                    <div className="hero-badge animate-fade-in" style={{ animationDelay: '0.1s' }}>🌟 L'assistant IA des professionnels de santé</div>
                    <h1 className="hero-title animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <span className="hero-gradient-text">Excellence Diagnostique,<br/>Soutenue par l'IA.</span>
                    </h1>
                    <p className="hero-subtitle animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        Modernisez votre pratique avec MediConsult. Collectez les constantes via un questionnaire vocal intelligent, gagnez du temps sur vos comptes-rendus, et obtenez une analyse augmentée pour sécuriser vos diagnostics.
                    </p>

                    <div className="hero-cta animate-slide-up" style={{ animationDelay: '0.4s' }}>
                        <Link to="/register" className="btn btn-primary btn-lg hero-btn-primary">
                            Commencer l'essai gratuit
                        </Link>
                        <Link to="/login" className="btn btn-secondary btn-lg hero-btn-secondary">
                            Accès Praticien
                        </Link>
                    </div>
                </div>
            </header>

            {/* Stats Section */}
            <section className="stats-section">
                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-number">
                            <AnimatedCounter target={500} suffix="+" />
                        </div>
                        <div className="stat-label-landing">Patients suivis</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">
                            <AnimatedCounter target={98} suffix="%" />
                        </div>
                        <div className="stat-label-landing">Satisfaction</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">
                            <AnimatedCounter target={1200} suffix="+" />
                        </div>
                        <div className="stat-label-landing">Consultations</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">
                            <AnimatedCounter target={24} suffix="/7" />
                        </div>
                        <div className="stat-label-landing">Disponibilité</div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <h2 className="section-title">{t.landing.features.title}</h2>
                <p className="section-subtitle">Des outils puissants pour moderniser votre pratique médicale</p>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-ai">
                            <span className="feature-icon">🧠</span>
                        </div>
                        <h3>Analyse IA Avancée</h3>
                        <p>Obtenez des suggestions de diagnostic basées sur l'état de l'art médical, pour un deuxième avis fiable et rapide.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-voice">
                            <span className="feature-icon">🎙️</span>
                        </div>
                        <h3>Questionnaire Vocal</h3>
                        <p>Vos patients répondent oralement aux questions préparatoires. L'IA transcrit et structure automatiquement leurs réponses.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-pdf">
                            <span className="feature-icon">📑</span>
                        </div>
                        <h3>Édition Automatisée</h3>
                        <p>Générez instantanément des ordonnances, bilans et certificats au format PDF, prêts à être imprimés ou envoyés.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-security">
                            <span className="feature-icon">🛡️</span>
                        </div>
                        <h3>Sécurité Médicale</h3>
                        <p>Conformité stricte aux normes de santé (HDS). Vos données et celles de vos patients sont chiffrées de bout en bout.</p>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="how-it-works-section">
                <h2 className="section-title">Comment ça marche ?</h2>
                <p className="section-subtitle">Un processus simple en trois étapes</p>

                <div className="steps-grid">
                    <div className="step-card">
                        <div className="step-number">1</div>
                        <h3>Enregistrez le patient</h3>
                        <p>L'assistant crée le dossier du patient avec ses informations personnelles.</p>
                    </div>
                    <div className="step-connector">→</div>
                    <div className="step-card">
                        <div className="step-number">2</div>
                        <h3>Passez le questionnaire</h3>
                        <p>Le patient répond aux questions avec enregistrement vocal automatique.</p>
                    </div>
                    <div className="step-connector">→</div>
                    <div className="step-card">
                        <div className="step-number">3</div>
                        <h3>Le médecin analyse</h3>
                        <p>Le médecin consulte les réponses, écoute les enregistrements et rédige son diagnostic.</p>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="testimonials-section">
                <h2 className="section-title">Confiance & Excellence</h2>
                <p className="section-subtitle">Découvrez pourquoi nos confrères choisissent MediConsult</p>

                <div className="testimonials-grid">
                    <div className="testimonial-card">
                        <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
                        <p className="testimonial-text">
                            "L'intelligence artificielle de MediConsult m'offre un gain de temps inestimable. Je peux enfin me recentrer sur l'écoute active de mes patients, l'IA s'occupe de la structure et des suggestions de diagnostic avec une précision remarquable."
                        </p>
                        <div className="testimonial-author">
                            <div className="testimonial-avatar">👨‍⚕️</div>
                            <div>
                                <div className="testimonial-name">Dr. Julien L.</div>
                                <div className="testimonial-role">Médecin Généraliste</div>
                            </div>
                        </div>
                    </div>

                    <div className="testimonial-card">
                        <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
                        <p className="testimonial-text">
                            "Le questionnaire vocal est une révolution. Mes patients remplissent leurs antécédents de manière très naturelle dans la salle d'attente, et j'arrive en consultation avec une synthèse déjà prête et analysée."
                        </p>
                        <div className="testimonial-author">
                            <div className="testimonial-avatar">👩‍⚕️</div>
                            <div>
                                <div className="testimonial-name">Dr. Sarah M.</div>
                                <div className="testimonial-role">Cardiologue</div>
                            </div>
                        </div>
                    </div>

                    <div className="testimonial-card">
                        <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
                        <p className="testimonial-text">
                            "Une plateforme ultra-sécurisée, facile à prendre en main. En tant qu'assistante, la gestion des dossiers et la création automatique des PDF d'ordonnances simplifient tout le workflow du cabinet."
                        </p>
                        <div className="testimonial-author">
                            <div className="testimonial-avatar">👩‍💼</div>
                            <div>
                                <div className="testimonial-name">Sophie T.</div>
                                <div className="testimonial-role">Assistante Médicale</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2>Prêt à moderniser votre cabinet ?</h2>
                    <p>Rejoignez les professionnels de santé qui font confiance à MediConsult</p>
                    <Link to="/register" className="btn btn-primary btn-lg cta-btn">
                        Commencer gratuitement →
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <p>© 2026 MediConsult - Plateforme de Consultation Médicale</p>
            </footer>
        </div>
    );
}

export default LandingPage;
