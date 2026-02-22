import { createTheme } from '@mui/material/styles';

/**
 * Custom Material UI Theme
 * Matches the existing application color palette
 */


/**
 * Custom Material UI Theme
 * Matches the existing application color palette
 * Supports Light and Dark modes with Google Cloud Console style
 */
export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
        // Light Mode
        primary: {
          main: '#0066e6', // var(--primary-500)
          light: '#4d9cff', // var(--primary-300)
          dark: '#003d80', // var(--primary-700)
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#00bfa5', // var(--secondary-500)
          light: '#4ddcce', // var(--secondary-300)
          dark: '#007360', // var(--secondary-700)
          contrastText: '#ffffff',
        },
        background: {
          default: '#f8fafc', // var(--gray-50)
          paper: '#ffffff',
        },
        text: {
          primary: '#1e293b', // var(--gray-800)
          secondary: '#64748b', // var(--gray-500)
        },
      }
      : {
        // Dark Mode (Google Cloud Style)
        primary: {
          main: '#8ab4f8', // Google Blue Light
          light: '#aecbfa',
          dark: '#4285f4', // Google Blue
          contrastText: '#1d1d1d',
        },
        secondary: {
          main: '#81c995', // Google Green Light
          light: '#b7e1cd',
          dark: '#34a853',
          contrastText: '#1d1d1d',
        },
        background: {
          default: '#1d1d1d', // Google Dark Background
          paper: '#292a2d', // Google Dark Surface
        },
        text: {
          primary: '#e8eaed', // Google Light Text
          secondary: '#9aa0a6', // Google Secondary Text
        },
        error: {
          main: '#f28b82', // Google Red Light
        },
        success: {
          main: '#81c995',
        },
        warning: {
          main: '#fdd663',
        },
        info: {
          main: '#8ab4f8',
        },
      }),
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          boxShadow: mode === 'dark'
            ? '0 1px 3px 0 rgba(0,0,0,0.5), 0 1px 2px -1px rgba(0,0,0,0.5)'
            : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          backgroundImage: 'none', // Remove default MUI dark mode overlay
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default MUI dark mode overlay
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: mode === 'dark' ? '#292a2d' : '#f8fafc',
            color: mode === 'dark' ? '#bdc1c6' : '#64748b',
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'dark' ? '1px solid #3c4043' : '1px solid #e2e8f0',
        }
      }
    }
  },
});

export default getTheme;
