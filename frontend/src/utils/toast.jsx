/**
 * Toast Notification Utilities
 * Replaces native alert() and confirm() with styled notifications
 */

import toast from 'react-hot-toast';

/**
 * Show a success notification
 */
export function showSuccess(message) {
    toast.success(message, {
        duration: 3000,
        position: 'top-center',
        style: {
            background: 'var(--success-light)',
            color: 'var(--success-dark)',
            border: '1px solid var(--success)',
            fontWeight: '500',
        },
    });
}

/**
 * Show an error notification
 */
export function showError(message) {
    toast.error(message, {
        duration: 4000,
        position: 'top-center',
        style: {
            background: 'var(--error-light)',
            color: 'var(--error-dark)',
            border: '1px solid var(--error)',
            fontWeight: '500',
        },
    });
}

/**
 * Show an info notification
 */
export function showInfo(message) {
    toast(message, {
        duration: 3000,
        position: 'top-center',
        icon: 'ℹ️',
        style: {
            background: 'var(--info-light)',
            color: 'var(--info-dark)',
            border: '1px solid var(--info)',
            fontWeight: '500',
        },
    });
}

/**
 * Show a warning notification
 */
export function showWarning(message) {
    toast(message, {
        duration: 4000,
        position: 'top-center',
        icon: '⚠️',
        style: {
            background: 'var(--warning-light)',
            color: 'var(--warning-dark)',
            border: '1px solid var(--warning)',
            fontWeight: '500',
        },
    });
}

/**
 * Show a confirm dialog using toast with action buttons
 * Returns a promise that resolves to true/false
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        toast(
            (t) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-primary)' }}>{message}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                resolve(false);
                            }}
                            style={{
                                padding: '0.375rem 1rem',
                                background: 'var(--gray-100)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                resolve(true);
                            }}
                            style={{
                                padding: '0.375rem 1rem',
                                background: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Confirmer
                        </button>
                    </div>
                </div>
            ),
            {
                duration: Infinity,
                position: 'top-center',
                style: {
                    maxWidth: '400px',
                    padding: '1rem',
                    background: 'var(--bg-card)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    borderRadius: '12px',
                },
            }
        );
    });
}
