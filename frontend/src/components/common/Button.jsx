/**
 * Button Component
 * Reusable button with variants
 */

/**
 * Button component
 * @param {Object} props - Component props
 * @param {string} props.variant - 'primary', 'secondary', 'success', 'danger', 'ghost'
 * @param {string} props.size - 'sm', 'md', 'lg'
 * @param {boolean} props.loading - Show loading state
 * @param {boolean} props.disabled - Disable button
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.type - Button type
 * @param {Function} props.onClick - Click handler
 */
import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    children,
    type = 'button',
    onClick,
    className = '',
    ...props
}) {
    // Map custom variants to MUI variants/colors
    let muiVariant = 'contained';
    let muiColor = 'primary';
    let sx = {};

    switch (variant) {
        case 'primary':
            muiVariant = 'contained';
            muiColor = 'primary';
            break;
        case 'secondary':
            muiVariant = 'outlined';
            muiColor = 'primary'; // Or 'secondary' if preferred
            break;
        case 'success':
            muiVariant = 'contained';
            muiColor = 'success';
            break;
        case 'danger':
            muiVariant = 'contained';
            muiColor = 'error';
            break;
        case 'ghost':
            muiVariant = 'text';
            muiColor = 'inherit';
            break;
        default:
            muiVariant = 'contained';
            muiColor = 'primary';
    }

    // Map sizes
    const muiSize = size === 'lg' ? 'large' : size === 'sm' ? 'small' : 'medium';

    return (
        <MuiButton
            type={type}
            variant={muiVariant}
            color={muiColor}
            size={muiSize}
            disabled={disabled || loading}
            onClick={onClick}
            className={className}
            sx={{
                textTransform: 'none',
                fontWeight: 500,
                boxShadow: variant === 'primary' ? 2 : 0,
                ...sx
            }}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            {...props}
        >
            {children}
        </MuiButton>
    );
}

export default Button;
