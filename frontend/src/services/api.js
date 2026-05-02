/**
 * API Service
 * Base configuration for API calls using Axios
 */

import axios from 'axios';
import { API_URL } from '../constants/config';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
    (config) => {
        // Fallback for legacy code that still sets token in localStorage
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle common errors
api.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        // Handle specific error codes
        if (error.response) {
            const { status } = error.response;
            const responseData = error.response.data || {
                success: false,
                message: 'Erreur de connexion au serveur'
            };

            // Unauthorized - redirect to login (unless we are already logging in or checking session)
            const requestUrl = error.config?.url || '';
            const isLoginRequest = requestUrl.includes('/auth/login');
            const isMeRequest = requestUrl.includes('/auth/me');
            const isLoginPage = window.location.pathname === '/login';

            if (status === 401 && !isLoginRequest && !isMeRequest && !isLoginPage) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }

            // Return error response
            return Promise.reject({ ...responseData, status });
        }

        // Network error
        return Promise.reject({
            success: false,
            message: 'Erreur de connexion au serveur'
        });
    }
);

export default api;
