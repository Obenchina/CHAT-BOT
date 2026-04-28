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
        primary: {
          main: '#1E88E5',
          light: '#7CC0FF',
          dark: '#0D47A1',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#14A37D',
          light: '#5DD3B8',
          dark: '#0A6450',
          contrastText: '#ffffff',
        },
        background: {
          default: '#F7F9FC',
          paper: '#ffffff',
        },
        text: {
          primary: '#0E1A2B',
          secondary: '#38465A',
        },
      }
      : {
        primary: {
          main: '#6BA7E8',
          light: '#8BBFF0',
          dark: '#2D6AB0',
          contrastText: '#071122',
        },
        secondary: {
          main: '#5DD3B8',
          light: '#8FE6D2',
          dark: '#14A37D',
          contrastText: '#071122',
        },
        background: {
          default: '#0B1424',
          paper: '#111E33',
        },
        text: {
          primary: '#F2F6FC',
          secondary: '#BFCBE0',
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
          borderRadius: '8px',
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          }
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: mode === 'dark'
            ? '0 1px 3px rgb(0 0 0 / 0.28)'
            : '0 1px 3px rgb(14 26 43 / 0.08)',
          backgroundImage: 'none',
          border: mode === 'dark' ? '1px solid #233857' : '1px solid #D9E0EA',
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
            backgroundColor: mode === 'dark' ? '#16263F' : '#F1F4F8',
            color: mode === 'dark' ? '#8595B0' : '#6A788D',
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: 0,
            borderBottom: mode === 'dark' ? '1px solid #233857' : '1px solid #D9E0EA',
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'dark' ? '1px solid #1B2C46' : '1px solid #ECEFF4',
          padding: '16px',
        }
      }
    }
  },
});

export default getTheme;
