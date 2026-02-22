/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and shows a fallback UI
 */

import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'var(--gray-50)'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        maxWidth: '500px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h2 style={{ margin: '0 0 0.5rem', color: '#1f2937' }}>
                            Une erreur est survenue
                        </h2>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                            L'application a rencontré un problème inattendu. Veuillez rafraîchir la page.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    padding: '0.625rem 1.5rem',
                                    background: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Réessayer
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                style={{
                                    padding: '0.625rem 1.5rem',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                Accueil
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
