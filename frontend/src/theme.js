import { createTheme } from '@mui/material/styles';

/**
 * Custom Material UI Theme
 * Matches the existing application color palette
 */


/**
 * Custom Material UI Theme
 * Matches the Enterprise SaaS Design System color palette
 * Supports Light and Dark modes
 */
export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
        // Light Mode
        primary: {
          main: '#3b82f6', // var(--primary-500)
          light: '#93c5fd', // var(--primary-300)
          dark: '#1d4ed8', // var(--primary-700)
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#14b8a6', // var(--secondary-500)
          light: '#5eead4', // var(--secondary-300)
          dark: '#0f766e', // var(--secondary-700)
          contrastText: '#ffffff',
        },
        background: {
          default: '#f8fafc', // var(--gray-50)
          paper: '#ffffff',
        },
        text: {
          primary: '#0f172a', // var(--gray-900)
          secondary: '#64748b', // var(--gray-500)
        },
      }
      : {
        // Dark Mode
        primary: {
          main: '#3b82f6', // var(--primary-500)
          light: '#60a5fa',
          dark: '#1d4ed8',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#2dd4bf', // var(--secondary-400)
          light: '#5eead4',
          dark: '#0f766e',
          contrastText: '#0f172a',
        },
        background: {
          default: '#0f172a', // var(--gray-50 dark)
          paper: '#1e293b', // var(--gray-100 dark)
        },
        text: {
          primary: '#f8fafc', // var(--gray-900 dark)
          secondary: '#94a3b8', // var(--gray-500 dark)
        },
        error: {
          main: '#f87171',
        },
        success: {
          main: '#34d399',
        },
        warning: {
          main: '#fbbf24',
        },
        info: {
          main: '#38bdf8',
        },
      }),
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontWeight: 600, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, letterSpacing: '-0.02em' },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px', // Match CSS variables
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: mode === 'dark'
            ? '0 1px 3px 0 rgb(0 0 0 / 0.5), 0 1px 2px -1px rgb(0 0 0 / 0.5)'
            : '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
          backgroundImage: 'none', // Remove default MUI dark mode overlay
          border: mode === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default MUI dark mode overlay
          borderRadius: '12px',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: mode === 'dark' ? '#1e293b' : '#f8fafc',
            color: mode === 'dark' ? '#94a3b8' : '#64748b',
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            borderBottom: mode === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'dark' ? '1px solid #334155' : '1px solid #f1f5f9',
          padding: '16px',
        }
      }
    }
  },
});

export default getTheme;
