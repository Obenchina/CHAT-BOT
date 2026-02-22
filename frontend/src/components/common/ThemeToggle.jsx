/**
 * Theme Toggle Component
 * Allows switching between light and dark mode
 * Saves preference to localStorage
 */

import { useTheme } from '../../context/ThemeContext';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

function ThemeToggle() {
    const { mode, toggleTheme } = useTheme();
    const isDark = mode === 'dark';

    return (
        <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
            title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
            {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
    );
}

export default ThemeToggle;
