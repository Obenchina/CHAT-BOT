import { Link } from 'react-router-dom';
import '../../styles/pages.css';

const proofItems = [
    {
        value: '3',
        label: 'Espaces Interconnectés',
        detail: 'Assistant, Patient et Praticien'
    },
    {
        value: '1',
        label: 'Dossier Clinique Unifié',
        detail: 'Audio, Imagerie, PDF et Notes'
    },
    {
        value: '4',
        label: 'Phases Opérationnelles',
        detail: 'Création, Collecte, Revue et Décision'
    },
    {
        value: 'OTP',
        label: 'Sécurisation des Accès',
        detail: 'Authentification multifacteur par e-mail'
    }
];

const capabilities = [
    {
        kicker: 'Anamnèse',
        title: 'Collecte Clinique Intelligente',
        description: 'Le recueil des données commence en amont de la consultation pour optimiser le temps clinique.'
    },
    {
        kicker: 'Analyse',
        title: 'Synthèse Augmentée par IA',
        description: 'Le praticien identifie instantanément les points clés tout en gardant la pleine maîtrise décisionnelle.'
    },
    {
        kicker: 'Productivité',
        title: 'Édition Documentaire Automatisée',
        description: 'Générez vos ordonnances, bilans et comptes-rendus en un clic au format PDF.'
    },
    {
        kicker: 'Continuité',
        title: 'Centralisation des Données',
        description: 'L\'historique actif, les réponses et les pièces jointes sont consolidés dans un flux unique.'
    }
];

const roles = [
    {
        title: 'Assistant',
        description: 'Initialise le dossier, coordonne le parcours patient et assure la fluidité administrative.'
    },
    {
        title: 'Patient',
        description: 'Répond au questionnaire, transmet ses documents et arrive avec un contexte structuré.'
    },
    {
        title: 'Médecin',
        description: 'Analyse les données, valide la synthèse et rend une décision clinique éclairée et partageable.'
    }
];

const workflow = [
    {
        number: '01',
        title: 'Initialisation du Dossier',
        description: 'Le cabinet génère une nouvelle consultation et intègre le patient dans un parcours structuré.'
    },
    {
        number: '02',
        title: 'Collecte de Données',
        description: 'Le patient complète l\'anamnèse et dépose ses examens complémentaires avant l\'échange médical.'
    },
    {
        number: '03',
        title: 'Revue Clinique Assistée',
        description: 'L\'IA hiérarchise les informations critiques pendant que l\'imagerie et le contexte restent accessibles.'
    },
    {
        number: '04',
        title: 'Validation & Édition',
        description: 'Le praticien valide le diagnostic, finalise son compte-rendu et exporte les documents nécessaires.'
    }
];

const trustCards = [
    {
        title: 'Permissions Hiérarchisées',
        description: 'Des espaces de travail distincts et adaptés aux responsabilités de chaque acteur.'
    },
    {
        title: 'Authentification Sécurisée',
        description: 'Protection rigoureuse des comptes via des codes de vérification temporels (OTP).'
    },
    {
        title: 'Souveraineté Médicale',
        description: 'L\'IA agit comme un assistant à la lecture. La décision finale reste l\'apanage exclusif du médecin.'
    }
];

const showcaseStages = [
    {
        role: 'Assistant',
        state: 'Dossier Initialisé',
        description: 'Coordonnées, motif de consultation et pièces jointes sont centralisés dès l\'admission.'
    },
    {
        role: 'Patient',
        state: 'Données Renseignées',
        description: 'Les réponses vocales et les antécédents sont structurés avant l\'examen clinique.'
    },
    {
        role: 'Médecin',
        state: 'Revue Finale',
        description: 'Analyse du dossier, appui IA, validation clinique et génération documentaire immédiate.'
    }
];

const showcaseTags = ['Vocal', 'Imagerie', 'PDF', 'OTP', 'Historique'];

function LandingPagePremium() {
    return (
        <div className="landing-page landing-page-premium">
            <header className="landing-hero">
                <div className="landing-orb landing-orb-one" />
                <div className="landing-orb landing-orb-two" />
                <div className="landing-orb landing-orb-three" />

                <nav className="landing-topbar">
                    <Link to="/" className="landing-brand">
                        <span className="landing-brand-mark">MC</span>
                        <span className="landing-brand-text">MediConsult</span>
                    </Link>

                    <div className="landing-topbar-actions">
                        <a href="#workflow" className="landing-nav-link landing-nav-anchor">Méthodologie</a>
                        <a href="#trust" className="landing-nav-link landing-nav-anchor">Sécurité</a>
                        <Link to="/login" className="landing-nav-link">Connexion</Link>
                        <Link to="/register" className="landing-nav-button">Démarrer</Link>
                    </div>
                </nav>

                <div className="landing-hero-grid">
                    <div className="landing-hero-copy">
                        <div className="landing-pill">Pratique Médicale Augmentée par l'IA</div>
                        <h1 className="landing-hero-title">
                            Un flux clinique fluide, du patient au diagnostic.
                        </h1>
                        <p className="landing-hero-subtitle">
                            MediConsult harmonise l'interaction entre l'assistant, le patient et le praticien. 
                            Anamnèse vocale, imagerie et synthèse IA convergent vers une décision clinique précise.
                        </p>

                        <div className="landing-hero-actions">
                            <Link to="/register" className="landing-primary-action">
                                Créer mon Espace Praticien
                            </Link>
                            <Link to="/login" className="landing-secondary-action">
                                Accès Professionnel
                            </Link>
                        </div>

                        <ul className="landing-signal-list">
                            <li>Questionnaire vocal et gestion documentaire unifiée</li>
                            <li>Assistance au diagnostic par IA haute performance</li>
                            <li>Génération automatisée de prescriptions et comptes-rendus PDF</li>
                        </ul>
                    </div>

                    <div className="landing-showcase-card">
                        <div className="landing-showcase-head">
                            <div>
                                <span className="landing-showcase-kicker">Écosystème MediConsult</span>
                                <h2>Un flux unique pour une pratique moderne.</h2>
                            </div>
                            <span className="landing-status-chip">Processus Actif</span>
                        </div>

                        <div className="landing-showcase-body">
                            {showcaseStages.map((stage, index) => (
                                <article key={stage.role} className="landing-stage-card">
                                    <div className="landing-stage-index">{`0${index + 1}`}</div>
                                    <div className="landing-stage-content">
                                        <div className="landing-stage-heading">
                                            <strong>{stage.role}</strong>
                                            <span>{stage.state}</span>
                                        </div>
                                        <p>{stage.description}</p>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className="landing-tag-row">
                            {showcaseTags.map((tag) => (
                                <span key={tag} className="landing-tag">{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <section className="landing-proof-strip">
                <div className="landing-proof-grid">
                    {proofItems.map((item) => (
                        <article key={item.label} className="landing-proof-card">
                            <span className="landing-proof-value">{item.value}</span>
                            <strong>{item.label}</strong>
                            <p>{item.detail}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section">
                <div className="landing-section-head">
                    <div className="landing-pill landing-pill-soft">Optimisation Opérationnelle</div>
                    <h2>Gagnez en efficacité à chaque étape du parcours.</h2>
                    <p>
                        Notre plateforme répond aux défis concrets de la pratique médicale moderne : 
                        collecte structurée, aide à l'analyse et production documentaire accélérée.
                    </p>
                </div>

                <div className="landing-card-grid">
                    {capabilities.map((item) => (
                        <article key={item.title} className="landing-detail-card">
                            <span className="landing-card-kicker">{item.kicker}</span>
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section landing-section-alt">
                <div className="landing-section-head">
                    <div className="landing-pill landing-pill-soft">Collaboration Médicale</div>
                    <h2>Une ergonomie pensée pour vos impératifs cliniques.</h2>
                    <p>
                        L'assistant prépare, le patient collabore, le médecin valide. 
                        Une répartition claire des rôles pour une meilleure prise en charge.
                    </p>
                </div>

                <div className="landing-role-grid">
                    {roles.map((role) => (
                        <article key={role.title} className="landing-role-card">
                            <span className="landing-role-badge">{role.title}</span>
                            <p>{role.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section" id="workflow">
                <div className="landing-section-head">
                    <div className="landing-pill landing-pill-soft">Méthodologie Clinique</div>
                    <h2>Un flux décisionnel structuré et vérifiable.</h2>
                    <p>
                        Une traçabilité complète de l'admission à la remise des documents, 
                        pour une pratique sereine et organisée.
                    </p>
                </div>

                <div className="landing-workflow-grid">
                    {workflow.map((step) => (
                        <article key={step.number} className="landing-workflow-card">
                            <span className="landing-workflow-number">{step.number}</span>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section landing-section-alt" id="trust">
                <div className="landing-section-head">
                    <div className="landing-pill landing-pill-soft">Confiance & Sécurité</div>
                    <h2>Un cadre sécurisé pour vos données de santé.</h2>
                    <p>
                        Nous privilégions la transparence et la sécurité technologique 
                        pour protéger l'intégrité de votre pratique.
                    </p>
                </div>

                <div className="landing-trust-grid">
                    {trustCards.map((card) => (
                        <article key={card.title} className="landing-trust-card">
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-cta-band">
                <div className="landing-cta-card">
                    <div className="landing-cta-copy">
                        <div className="landing-pill">Déploiement Immédiat</div>
                        <h2>Équipez votre cabinet d'une technologie de pointe.</h2>
                        <p>
                            Créez votre espace praticien, configurez votre équipe et 
                            commencez à traiter vos dossiers avec une fluidité inégalée.
                        </p>
                    </div>

                    <div className="landing-cta-actions">
                        <Link to="/register" className="landing-primary-action">
                            Démarrer l'Expérience
                        </Link>
                        <Link to="/login" className="landing-secondary-action">
                            Accès Praticien
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="landing-footer-premium">
                <div className="landing-footer-inner">
                    <div>
                        <strong>MediConsult</strong>
                        <p>Plateforme avancée de coordination médicale et d'aide au diagnostic.</p>
                    </div>

                    <div className="landing-footer-links">
                        <Link to="/login">Connexion</Link>
                        <Link to="/register">Inscription</Link>
                        <a href="#workflow">Méthodologie</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPagePremium;
