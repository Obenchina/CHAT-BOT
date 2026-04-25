/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context
 * Manages user authentication state across the application
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

// Create context
const AuthContext = createContext(null);

/**
 * Authentication Provider Component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export function AuthProvider({ children }) {
    // State
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Check for existing session on mount
    useEffect(() => {
        checkAuth();
    }, []);

    /**
     * Check if user is authenticated
     */
    async function checkAuth() {
        try {
            // Verify token (via HttpOnly cookie) and get user info
            const response = await authService.getCurrentUser();

            if (response.success) {
                setUser(response.data.user);
                setProfile(response.data.profile);
            } else {
                setUser(null);
                setProfile(null);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            setUser(null);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login result
     */
    async function login(email, password) {
        try {
            const response = await authService.login(email, password);

            if (response.success) {
                // Token is now set in HttpOnly cookie by backend

                // Update state
                setUser(response.data.user);
                setProfile(response.data.profile);

                // Redirect based on role
                if (response.data.user.role === 'doctor') {
                    navigate('/doctor/dashboard');
                } else {
                    navigate('/assistant/patients');
                }
            }

            return response;
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Erreur de connexion'
            };
        }
    }

    /**
     * Register new doctor (Step 1: Get Pending ID)
     * @param {Object} data - Registration data
     * @returns {Promise<Object>} Registration result
     */
    async function register(data) {
        try {
            const response = await authService.register(data);
            return response;
        } catch (error) {
            console.error('Register error:', error);
            return {
                success: false,
                message: error.message || 'Erreur d\'inscription'
            };
        }
    }

    /**
     * Verify registration OTP (Step 2: Actual Login)
     * @param {string} pendingId - Pending registration ID
     * @param {string} code - OTP code
     * @returns {Promise<Object>} Verification result
     */
    async function verifyRegistration(pendingId, code) {
        try {
            const response = await authService.verifyRegistration(pendingId, code);

            if (response.success) {
                // Token is now set in HttpOnly cookie by backend

                // Update state
                setUser(response.data.user);
                setProfile(response.data.doctor);

                // Redirect to dashboard
                navigate('/doctor/dashboard');
            }

            return response;
        } catch (error) {
            console.error('Verify registration error:', error);
            return {
                success: false,
                message: error.message || 'Code de vérification invalide ou expiré'
            };
        }
    }

    /**
     * Logout user
     */
    async function logout() {
        // Clear all persistent toasts
        import('react-hot-toast').then(module => module.default.dismiss());
        
        try {
            // Call API to clear HttpOnly cookie
            await authService.logout();
        } catch (err) {
            console.error('Logout error:', err);
        }

        // Clear fallback localStorage just in case
        localStorage.removeItem('token');

        // Clear state
        setUser(null);
        setProfile(null);

        // Redirect to login
        navigate('/login');
    }

    /**
     * Update profile in state
     * @param {Object} newProfile - Updated profile data
     */
    function updateProfile(newProfile) {
        setProfile(prev => ({ ...prev, ...newProfile }));
    }

    // Context value
    const value = {
        user,
        profile,
        loading,
        isAuthenticated: !!user,
        isDoctor: user?.role === 'doctor',
        isAssistant: user?.role === 'assistant',
        login,
        register,
        verifyRegistration,
        logout,
        updateProfile,
        checkAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Custom hook to use auth context
 * @returns {Object} Auth context value
 */
export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}

export default AuthContext;
