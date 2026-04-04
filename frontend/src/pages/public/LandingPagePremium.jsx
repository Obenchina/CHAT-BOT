import { Link } from 'react-router-dom';
import '../../styles/pages.css';

const proofItems = [
    {
        value: '3',
        label: 'espaces relies',
        detail: 'assistant, patient, medecin'
    },
    {
        value: '1',
        label: 'dossier continu',
        detail: 'audio, images, PDF et notes'
    },
    {
        value: '4',
        label: 'etapes nettes',
        detail: 'creation, collecte, revue, decision'
    },
    {
        value: 'OTP',
        label: 'verification securisee',
        detail: 'activation et recuperation du compte'
    }
];

const capabilities = [
    {
        kicker: 'Collecte',
        title: 'Questionnaire patient intelligent',
        description: 'Le recueil des informations commence avant la consultation pour faire gagner du temps clinique.'
    },
    {
        kicker: 'Lecture',
        title: 'Synthese IA exploitable',
        description: 'Le medecin retrouve plus vite les elements clefs sans perdre la maitrise de la decision finale.'
    },
    {
        kicker: 'Sortie',
        title: 'Documents prets a partager',
        description: 'Ordonnances, bilans et comptes rendus peuvent etre exportes en PDF depuis le meme flux.'
    },
    {
        kicker: 'Continuite',
        title: 'Reprise du cas sans perte',
        description: 'Le dossier actif, les reponses et les pieces jointes restent centralises dans une seule trajectoire.'
    }
];

const roles = [
    {
        title: 'Assistant',
        description: 'Cree le dossier, relance le parcours patient et maintient la consultation dans un cadre propre.'
    },
    {
        title: 'Patient',
        description: 'Repond aux questions, partage ses documents et arrive avec un contexte deja structure.'
    },
    {
        title: 'Medecin',
        description: 'Analyse le cas, valide la synthese et rend une decision plus rapide, lisible et partageable.'
    }
];

const workflow = [
    {
        number: '01',
        title: 'Ouverture du cas',
        description: 'Le cabinet cree un dossier propre et rattache le patient a un parcours actif.'
    },
    {
        number: '02',
        title: 'Collecte clinique',
        description: 'Le patient complete les questions et depose ses documents avant l echange medical.'
    },
    {
        number: '03',
        title: 'Revue assistee',
        description: 'L IA aide a trier et synthetiser pendant que photos, PDF et contexte restent visibles en un point.'
    },
    {
        number: '04',
        title: 'Validation finale',
        description: 'Le medecin tranche, complete son compte rendu et exporte les documents necessaires.'
    }
];

const trustCards = [
    {
        title: 'Roles et permissions',
        description: 'Chaque espace reste centre sur sa responsabilite: cabinet, patient et medecin.'
    },
    {
        title: 'Verification par OTP',
        description: 'Inscription et recuperation du mot de passe passent par une verification email temporelle.'
    },
    {
        title: 'Validation humaine',
        description: 'L IA assiste la lecture et la synthese. La decision clinique finale reste humaine.'
    }
];

const showcaseStages = [
    {
        role: 'Assistant',
        state: 'Dossier ouvert',
        description: 'Coordonnees, contexte de visite et pieces jointes sont centralises des le depart.'
    },
    {
        role: 'Patient',
        state: 'Questionnaire renseigne',
        description: 'Reponses vocales et informations pre consultation sont structurees avant la venue.'
    },
    {
        role: 'Medecin',
        state: 'Revue finale',
        description: 'Lecture du dossier, appui IA, validation clinique et export des documents dans le meme fil.'
    }
];

const showcaseTags = ['Vocal', 'Images', 'PDF', 'OTP', 'Historique'];

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
                        <a href="#workflow" className="landing-nav-link landing-nav-anchor">Workflow</a>
                        <a href="#trust" className="landing-nav-link landing-nav-anchor">Confiance</a>
                        <Link to="/login" className="landing-nav-link">Connexion</Link>
                        <Link to="/register" className="landing-nav-button">Demarrer</Link>
                    </div>
                </nav>

                <div className="landing-hero-grid">
                    <div className="landing-hero-copy">
                        <div className="landing-pill">Cabinet medical assiste par IA</div>
                        <h1 className="landing-hero-title">
                            Un flux clinique net, du patient au diagnostic.
                        </h1>
                        <p className="landing-hero-subtitle">
                            MediConsult relie l assistant, le patient et le medecin dans un dossier unique.
                            Questionnaire vocal, documents, synthese IA et validation finale restent alignes du debut a la fin.
                        </p>

                        <div className="landing-hero-actions">
                            <Link to="/register" className="landing-primary-action">
                                Creer l espace praticien
                            </Link>
                            <Link to="/login" className="landing-secondary-action">
                                Acces praticien
                            </Link>
                        </div>

                        <ul className="landing-signal-list">
                            <li>Questionnaire vocal et depot de pieces dans le meme dossier</li>
                            <li>Analyse IA pour accelerer la lecture, jamais pour remplacer la decision clinique</li>
                            <li>Ordonnances, bilans et comptes rendus exportables en PDF</li>
                        </ul>
                    </div>

                    <div className="landing-showcase-card">
                        <div className="landing-showcase-head">
                            <div>
                                <span className="landing-showcase-kicker">Parcours MediConsult</span>
                                <h2>Un dossier unique, trois espaces relies.</h2>
                            </div>
                            <span className="landing-status-chip">Flux actif</span>
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
                    <div className="landing-pill landing-pill-soft">Ce que la plateforme fait vraiment</div>
                    <h2>Des gains visibles dans le flux, pas juste dans la promesse.</h2>
                    <p>
                        Chaque bloc repond a une etape concrete du parcours patient: collecte, lecture,
                        production documentaire et reprise du cas.
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
                    <div className="landing-pill landing-pill-soft">Concu pour trois espaces</div>
                    <h2>Le produit suit le rythme du cabinet, pas l inverse.</h2>
                    <p>
                        L assistant prepare, le patient complete, le medecin valide. Chacun voit ce qui l aide a avancer.
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
                    <div className="landing-pill landing-pill-soft">Workflow clinique</div>
                    <h2>Quatre mouvements lisibles du debut a la remise des documents.</h2>
                    <p>
                        La plateforme reste utile parce que le parcours est simple a suivre, a reprendre et a verifier.
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
                    <div className="landing-pill landing-pill-soft">Confiance produit</div>
                    <h2>La confiance vient du cadre visible dans le flux.</h2>
                    <p>
                        Aucune statistique decorative ici. Seulement les garde fous et mecanismes qui renforcent le parcours reel.
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
                        <div className="landing-pill">Demarrage guide</div>
                        <h2>Equipez le cabinet sans casser le rythme de consultation.</h2>
                        <p>
                            Creez votre espace praticien, rattachez votre equipe et faites circuler les dossiers
                            dans un cadre plus net des le premier patient.
                        </p>
                    </div>

                    <div className="landing-cta-actions">
                        <Link to="/register" className="landing-primary-action">
                            Demarrer maintenant
                        </Link>
                        <Link to="/login" className="landing-secondary-action">
                            Se connecter
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="landing-footer-premium">
                <div className="landing-footer-inner">
                    <div>
                        <strong>MediConsult</strong>
                        <p>Plateforme de consultation medicale structuree autour du cabinet.</p>
                    </div>

                    <div className="landing-footer-links">
                        <Link to="/login">Connexion</Link>
                        <Link to="/register">Inscription</Link>
                        <a href="#workflow">Workflow</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPagePremium;
