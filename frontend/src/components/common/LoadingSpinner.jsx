/**
 * Loading Spinner Component
 * Displays a loading indicator
 */

/**
 * Loading spinner with optional text
 * @param {Object} props - Component props
 * @param {string} props.size - Size: 'sm', 'md', 'lg'
 * @param {string} props.text - Optional loading text
 */
function LoadingSpinner({ size = 'md', text = null }) {
    // Size styles
    const sizeStyles = {
        sm: { width: '16px', height: '16px', borderWidth: '2px' },
        md: { width: '24px', height: '24px', borderWidth: '3px' },
        lg: { width: '40px', height: '40px', borderWidth: '4px' }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-md">
            {/* Spinner */}
            <div
                className="spinner"
                style={sizeStyles[size]}
                aria-label="Chargement"
            />

            {/* Optional text */}
            {text && (
                <span style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                    {text}
                </span>
            )}
        </div>
    );
}

export default LoadingSpinner;
