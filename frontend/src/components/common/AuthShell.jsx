import { Link } from 'react-router-dom';

function AuthShell({
    badge,
    coverTitle,
    coverSubtitle,
    coverHighlights = [],
    coverStats = [],
    panelTitle,
    panelSubtitle,
    steps = [],
    activeStep = 0,
    wide = false,
    footer,
    children
}) {
    return (
        <div className="auth-page">
            <div className="auth-shell">
                <aside className="auth-cover">
                    <div className="auth-cover-top">
                        <Link to="/" className="auth-cover-brand">
                            <img src="/assets/logo.png" alt="Medi-Consult Logo" className="auth-logo-img" />
                            <span className="auth-brand-text">Medi-Consult</span>
                        </Link>

                        {badge && <div className="auth-cover-badge">{badge}</div>}

                        <h1 className="auth-cover-title">{coverTitle}</h1>
                        <p className="auth-cover-subtitle">{coverSubtitle}</p>

                        {coverHighlights.length > 0 && (
                            <div className="auth-highlight-list">
                                {coverHighlights.map((item) => (
                                    <div key={item.title} className="auth-highlight-card">
                                        <span className="auth-highlight-kicker">{item.kicker}</span>
                                        <strong>{item.title}</strong>
                                        <p>{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {coverStats.length > 0 && (
                        <div className="auth-stat-grid">
                            {coverStats.map((item) => (
                                <div key={item.label} className="auth-stat-card">
                                    <span className="auth-stat-value">{item.value}</span>
                                    <span className="auth-stat-label">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                <main className="auth-panel">
                    <div className={`auth-container${wide ? ' auth-container-wide' : ''}`}>
                        <div className="auth-mobile-intro">
                            <Link to="/" className="auth-logo">
                                <img src="/assets/logo.png" alt="Medi-Consult Logo" className="auth-logo-img" />
                                <span className="auth-brand-text">Medi-Consult</span>
                            </Link>
                            {badge && <div className="auth-mobile-badge">{badge}</div>}
                        </div>

                        <div className="auth-header">
                            {steps.length > 0 && (
                                <div className="auth-stepper" aria-label="Authentication steps">
                                    {steps.map((step, index) => {
                                        const isActive = index === activeStep;
                                        const isComplete = index < activeStep;

                                        return (
                                            <div
                                                key={step}
                                                className={`auth-step${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}
                                            >
                                                <span className="auth-step-node">{index + 1}</span>
                                                <span className="auth-step-text">{step}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <h2 className="auth-title">{panelTitle}</h2>
                            {panelSubtitle && <p className="auth-subtitle">{panelSubtitle}</p>}
                        </div>

                        {children}

                        {footer && <div className="auth-switch">{footer}</div>}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default AuthShell;
