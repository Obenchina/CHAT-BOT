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
import './styles/global.css';
import './styles/components.css';

// Public Pages (loaded eagerly — small, always needed)
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';

// Lazy-loaded Pages (loaded on demand)
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const CatalogueManagement = lazy(() => import('./pages/doctor/CatalogueManagement'));
const AssistantsManagement = lazy(() => import('./pages/doctor/AssistantsManagement'));
const CaseDetails = lazy(() => import('./pages/doctor/CaseDetails'));
const DoctorPatients = lazy(() => import('./pages/doctor/DoctorPatients'));
const DoctorProfile = lazy(() => import('./pages/doctor/DoctorProfile'));
const PatientsList = lazy(() => import('./pages/assistant/PatientsList'));
const QuestionnairePage = lazy(() => import('./pages/assistant/QuestionnairePage'));
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

        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
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

        <Route path="/doctor/assistants" element={
          <ProtectedRoute requiredRole="doctor">
            <AssistantsManagement />
          </ProtectedRoute>
        } />

        <Route path="/doctor/profile" element={
          <ProtectedRoute requiredRole="doctor">
            <DoctorProfile />
          </ProtectedRoute>
        } />

        <Route path="/doctor/patients" element={
          <ProtectedRoute requiredRole="doctor">
            <DoctorPatients />
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
            <QuestionnairePage />
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
            <Toaster />
            <AppRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
