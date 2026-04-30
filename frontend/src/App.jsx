/**
 * Main App Component
 * Root component with routing configuration
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';

// Import styles
// Foundation
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';

// Legacy page-specific styles (loaded BEFORE premium-pages.css so the
// new flat surfaces win the cascade. Otherwise lazy routes inject these
// later and shadow the redesign.)
import './styles/shell.css';
import './styles/profile.css';
import './styles/pages.css';
import './styles/auth.css';
import './styles/entretien.css';

// New unified design layer — must be LAST.
import './styles/premium-pages.css';
import './styles/dashboard.css';
import './styles/patients.css';
import './styles/settings.css';
import './styles/catalogue.css';

// Public Pages (loaded eagerly — small, always needed)
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';

// Lazy-loaded Pages (loaded on demand)
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const CatalogueManagement = lazy(() => import('./pages/doctor/CatalogueManagement'));

const CaseDetails = lazy(() => import('./pages/doctor/CaseDetails'));
const DoctorPatients = lazy(() => import('./pages/doctor/DoctorPatients'));

const DoctorSettings = lazy(() => import('./pages/doctor/DoctorSettings'));
const PatientsList = lazy(() => import('./pages/assistant/PatientsList'));
const Entretien = lazy(() => import('./pages/assistant/Entretien'));
const CaseReviewPage = lazy(() => import('./pages/assistant/CaseReviewPage'));
const AssistantProfile = lazy(() => import('./pages/assistant/AssistantProfile'));

// System Pages
import NotFoundPage from './pages/system/NotFoundPage';

/**
 * Lazy loading fallback
 */
function LazyFallback() {
  return (
    <div className="loading-overlay">
      <LoadingSpinner size="lg" text="Chargement..." />
    </div>
  );
}

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, loading, user } = useAuth();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="loading-overlay">
        <LoadingSpinner size="lg" text="Chargement..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to appropriate dashboard
    return <Navigate to={user?.role === 'doctor' ? '/doctor/dashboard' : '/assistant/patients'} replace />;
  }

  return children;
}

/**
 * Public Route Component
 * Redirects to dashboard if already authenticated
 */
function PublicRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay">
        <LoadingSpinner size="lg" text="Chargement..." />
      </div>
    );
  }

  // Redirect to dashboard if authenticated
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'doctor' ? '/doctor/dashboard' : '/assistant/patients'} replace />;
  }

  return children;
}

/**
 * App Routes
 */
function AppRoutes() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        } />

        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />

        {/* Register */}
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />

        {/* Forgot Password */}
        <Route path="/forgot-password" element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        } />

        {/* Doctor Routes */}
        <Route path="/doctor/dashboard" element={
          <ProtectedRoute requiredRole="doctor">
            <DoctorDashboard />
          </ProtectedRoute>
        } />

        <Route path="/doctor/cases/:id" element={
          <ProtectedRoute requiredRole="doctor">
            <CaseDetails />
          </ProtectedRoute>
        } />

        <Route path="/doctor/catalogue" element={
          <ProtectedRoute requiredRole="doctor">
            <CatalogueManagement />
          </ProtectedRoute>
        } />

        <Route path="/doctor/settings" element={
          <ProtectedRoute requiredRole="doctor">
            <DoctorSettings />
          </ProtectedRoute>
        } />

        <Route path="/doctor/patients" element={
          <ProtectedRoute requiredRole="doctor">
            <DoctorPatients />
          </ProtectedRoute>
        } />

        {/* Redirects for old routes */}
        <Route path="/doctor/profile" element={
          <ProtectedRoute requiredRole="doctor">
            <Navigate to="/doctor/settings" replace />
          </ProtectedRoute>
        } />

        <Route path="/doctor/assistants" element={
          <ProtectedRoute requiredRole="doctor">
            <Navigate to="/doctor/settings#assistants" replace />
          </ProtectedRoute>
        } />

        {/* Assistant Routes */}
        <Route path="/assistant/patients" element={
          <ProtectedRoute requiredRole="assistant">
            <PatientsList />
          </ProtectedRoute>
        } />

        <Route path="/assistant/case/new/:patientId" element={
          <ProtectedRoute requiredRole="assistant">
            <Entretien />
          </ProtectedRoute>
        } />

        <Route path="/assistant/case/:caseId/review" element={
          <ProtectedRoute requiredRole="assistant">
            <CaseReviewPage />
          </ProtectedRoute>
        } />

        <Route path="/assistant/profile" element={
          <ProtectedRoute requiredRole="assistant">
            <AssistantProfile />
          </ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Main App Component
 */
function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <CssBaseline />
        <ErrorBoundary>
          <AuthProvider>
            <Toaster
              position="top-right"
              gutter={10}
              toastOptions={{
                duration: 3500,
                style: {
                  background: 'var(--color-surface-1)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                  boxShadow: 'var(--shadow-3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  maxWidth: 420,
                },
                success: {
                  iconTheme: {
                    primary: 'var(--color-success-500)',
                    secondary: 'var(--color-surface-1)',
                  },
                  style: {
                    borderLeft: '4px solid var(--color-success-500)',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'var(--color-danger-500)',
                    secondary: 'var(--color-surface-1)',
                  },
                  style: {
                    borderLeft: '4px solid var(--color-danger-500)',
                  },
                },
                loading: {
                  iconTheme: {
                    primary: 'var(--color-brand-500)',
                    secondary: 'var(--color-surface-1)',
                  },
                },
              }}
            />
            <AppRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
