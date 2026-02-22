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
                    <div className="hero-badge">🚀 Plateforme Médicale Intelligente</div>
                    <h1 className="hero-title">
                        <span className="hero-gradient-text">{t.landing.title}</span>
                    </h1>
                    <p className="hero-subtitle">{t.landing.subtitle}</p>

                    <div className="hero-cta">
                        <Link to="/register" className="btn btn-primary btn-lg hero-btn-primary">
                            {t.landing.cta}
                        </Link>
                        <Link to="/login" className="btn btn-secondary btn-lg hero-btn-secondary">
                            Accéder à mon compte
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
                            <span className="feature-icon">🤖</span>
                        </div>
                        <h3>{t.landing.features.aiAnalysis}</h3>
                        <p>Analyse automatique des symptômes par intelligence artificielle pour aider au diagnostic.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-voice">
                            <span className="feature-icon">🎤</span>
                        </div>
                        <h3>{t.landing.features.voiceRecording}</h3>
                        <p>Enregistrement vocal des réponses des patients avec transcription automatique.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-pdf">
                            <span className="feature-icon">📄</span>
                        </div>
                        <h3>{t.landing.features.pdfGeneration}</h3>
                        <p>Génération automatique d'ordonnances et rapports médicaux au format PDF.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrapper feature-icon-security">
                            <span className="feature-icon">🔒</span>
                        </div>
                        <h3>{t.landing.features.secureData}</h3>
                        <p>Stockage sécurisé de toutes les données médicales des patients.</p>
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
                <h2 className="section-title">Ce que disent nos utilisateurs</h2>
                <p className="section-subtitle">La confiance de professionnels de santé</p>

                <div className="testimonials-grid">
                    <div className="testimonial-card">
                        <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
                        <p className="testimonial-text">
                            "MediConsult a transformé ma façon de gérer les consultations. Le gain de temps est considérable."
                        </p>
                        <div className="testimonial-author">
                            <div className="testimonial-avatar">👨‍⚕️</div>
                            <div>
                                <div className="testimonial-name">Dr. Ahmed B.</div>
                                <div className="testimonial-role">Médecin Généraliste</div>
                            </div>
                        </div>
                    </div>

                    <div className="testimonial-card">
                        <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
                        <p className="testimonial-text">
                            "L'enregistrement vocal simplifie énormément la prise de notes. Les patients apprécient."
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
                            "Interface intuitive et sécurisée. Exactement ce dont notre cabinet avait besoin."
                        </p>
                        <div className="testimonial-author">
                            <div className="testimonial-avatar">👨‍💼</div>
                            <div>
                                <div className="testimonial-name">Karim L.</div>
                                <div className="testimonial-role">Assistant Médical</div>
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
