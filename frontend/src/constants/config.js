/**
 * API Configuration Constants
 */

// Backend API URL (reads from .env, fallback for local dev)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Uploads base URL
export const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5000/uploads';

// API Endpoints
export const ENDPOINTS = {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    VERIFY_REGISTRATION: '/auth/verify-registration',
    RESEND_OTP: '/auth/resend-otp',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CURRENT_USER: '/auth/me',

    // Doctor
    DOCTOR_DASHBOARD: '/doctor/dashboard',
    DOCTOR_PROFILE: '/doctor/profile',
    DOCTOR_AI_CONFIG: '/doctor/ai-config',
    DOCTOR_PRESCRIPTION_CONFIG: '/doctor/prescription-config',

    // Assistant
    ASSISTANTS: '/assistant',
    ASSISTANT_PROFILE: '/assistant/profile',

    // Patients
    PATIENTS: '/patients',
    PATIENTS_SEARCH: '/patients/search',

    // Catalogue
    CATALOGUE: '/catalogue',

    // Cases
    CASES: '/cases'
};

// User roles
export const ROLES = {
    DOCTOR: 'doctor',
    ASSISTANT: 'assistant'
};

// Case statuses
export const CASE_STATUS = {
    IN_PROGRESS: 'in_progress',
    SUBMITTED: 'submitted',
    REVIEWED: 'reviewed',
    CLOSED: 'closed'
};

// Answer types
export const ANSWER_TYPES = {
    YES_NO: 'yes_no',
    VOICE: 'voice',
    CHOICES: 'choices'
};

// Document types
export const DOCUMENT_TYPES = {
    ANALYSIS: 'analysis',
    IMAGERY: 'imagery',
    PRESCRIPTION: 'prescription',
    REPORT: 'report'
};

// Gender options
export const GENDER_OPTIONS = [
    { value: 'male', label: 'Homme' },
    { value: 'female', label: 'Femme' }
];

// Specialty options
export const SPECIALTY_OPTIONS = [
    { value: 'general_medicine', label: 'Médecine générale' },
    { value: 'cardiology', label: 'Cardiologie' },
    { value: 'dermatology', label: 'Dermatologie' },
    { value: 'neurology', label: 'Neurologie' },
    { value: 'pediatrics', label: 'Pédiatrie' },
    { value: 'psychiatry', label: 'Psychiatrie' },
    { value: 'surgery', label: 'Chirurgie' },
    { value: 'gynecology', label: 'Gynécologie' },
    { value: 'ophthalmology', label: 'Ophtalmologie' },
    { value: 'orthopedics', label: 'Orthopédie' }
];
