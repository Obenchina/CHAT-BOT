/**
 * API Service
 * Base configuration for API calls using Axios
 */

import axios from 'axios';
import { API_URL } from '../constants/config';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
    (config) => {
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

            // Unauthorized - redirect to login (unless we are already logging in)
            if (status === 401 && !error.config.url.includes('/auth/login')) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }

            // Return error response
            return Promise.reject(error.response.data);
        }

        // Network error
        return Promise.reject({
            success: false,
            message: 'Erreur de connexion au serveur'
        });
    }
);

export default api;
