/* eslint-disable react-refresh/only-export-components */
/**
 * Theme Context
 * Manages the application theme (light/dark) and integrates with Material UI
 */
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { getTheme } from '../theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    // Initialize theme from localStorage or system preference
    const [mode, setMode] = useState(() => {
        const saved = localStorage.getItem('mc.theme') || localStorage.getItem('theme');
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // Update effect
    useEffect(() => {
        // 1. Save to local storage
        localStorage.setItem('mc.theme', mode);
        localStorage.setItem('theme', mode);

        // 2. Update HTML attribute for CSS variables
        document.documentElement.setAttribute('data-theme', mode);

        document.body.style.backgroundColor = '';
        document.body.style.color = '';
    }, [mode]);

    const toggleTheme = () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
    };

    // Generate MUI theme from mode
    const theme = useMemo(() => getTheme(mode), [mode]);

    const value = {
        mode,
        toggleTheme,
        setMode
    };

    return (
        <ThemeContext.Provider value={value}>
            <MuiThemeProvider theme={theme}>
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
