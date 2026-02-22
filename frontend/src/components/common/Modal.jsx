/**
 * Modal Component
 * Reusable modal dialog
 */

import { useEffect } from 'react';

/**
 * Modal component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Show modal
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal content
 * @param {React.ReactNode} props.footer - Modal footer
 */
function Modal({ isOpen, onClose, title, children, footer }) {
    // Close on escape key
    useEffect(() => {
        function handleEscape(e) {
            if (e.key === 'Escape') {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal" role="dialog" aria-modal="true">
                {/* Header */}
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Fermer"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Modal;
