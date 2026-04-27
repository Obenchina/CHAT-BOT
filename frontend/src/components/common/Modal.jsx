import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function Modal({
    isOpen,
    onClose,
    title,
    children,
    footer,
    maxWidth,
    overlayStyle,
    modalStyle,
    bodyStyle,
    fullscreen = false
}) {
    useEffect(() => {
        function handleEscape(e) {
            if (e.key === 'Escape') onClose();
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

    if (!isOpen) return null;

    const resolvedOverlayStyle = fullscreen
        ? {
            position: 'fixed',
            inset: 0,
            padding: 0,
            alignItems: 'stretch',
            justifyContent: 'stretch',
            zIndex: 9999,
            ...overlayStyle
        }
        : overlayStyle;

    const resolvedModalStyle = fullscreen
        ? {
            width: '100vw',
            maxWidth: '100vw',
            height: '100vh',
            maxHeight: '100vh',
            borderRadius: 0,
            ...modalStyle
        }
        : {
            ...(maxWidth ? { maxWidth } : {}),
            ...modalStyle
        };

    return createPortal((
        <div
            className={`modal-overlay ${fullscreen ? 'modal-overlay-fullscreen' : ''}`}
            style={resolvedOverlayStyle}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`modal ${fullscreen ? 'modal-fullscreen' : ''}`}
                role="dialog"
                aria-modal="true"
                style={resolvedModalStyle}
            >
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Fermer"
                    >
                        X
                    </button>
                </div>

                <div className="modal-body" style={bodyStyle}>
                    {children}
                </div>

                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    ), document.body);
}

export default Modal;
