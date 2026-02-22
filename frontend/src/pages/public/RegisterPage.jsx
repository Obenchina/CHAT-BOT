/**
 * Register Page
 * Doctor registration form
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import translations from '../../constants/translations';
import { SPECIALTY_OPTIONS, GENDER_OPTIONS } from '../../constants/config';
import '../../styles/auth.css';

const t = translations;

function RegisterPage() {
    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        gender: '',
        phone: '',
        address: '',
        specialty: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Auth context
    const { register } = useAuth();

    // Handle input change
    function handleChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Validate form
    function validate() {
        const newErrors = {};

        if (!formData.email) newErrors.email = t.errors.required;
        if (!formData.password) newErrors.password = t.errors.required;
        if (formData.password.length < 6) {
            newErrors.password = 'Minimum 6 caractères requis';
        }
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = t.errors.passwordMismatch;
        }
        if (!formData.firstName) newErrors.firstName = t.errors.required;
        if (!formData.lastName) newErrors.lastName = t.errors.required;
        if (!formData.phone) newErrors.phone = t.errors.required;
        if (!formData.specialty) newErrors.specialty = t.errors.required;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    // Handle form submit
    async function handleSubmit(e) {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);

        try {
            const result = await register(formData);

            if (!result.success) {
                setErrors({ general: result.message });
            }
        } catch (err) {
            setErrors({ general: t.errors.serverError });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container auth-container-wide">
                {/* Logo */}
                <div className="auth-logo">
                    <span className="logo-icon">🏥</span>
                    <span className="logo-text">MediConsult</span>
                </div>

                {/* Title */}
                <h1 className="auth-title">{t.auth.registerTitle}</h1>

                {/* Error message */}
                {errors.general && (
                    <div className="alert alert-error">
                        {errors.general}
                    </div>
                )}

                {/* Register form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    {/* Email & Password row */}
                    <div className="form-row">
                        <Input
                            label={t.auth.email}
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            error={errors.email}
                            required
                        />
                    </div>

                    <div className="form-row form-row-2">
                        <Input
                            label={t.auth.password}
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            error={errors.password}
                            required
                        />

                        <Input
                            label={t.auth.confirmPassword}
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            error={errors.confirmPassword}
                            required
                        />
                    </div>

                    {/* Name row */}
                    <div className="form-row form-row-2">
                        <Input
                            label={t.doctor.firstName}
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            error={errors.firstName}
                            required
                        />

                        <Input
                            label={t.doctor.lastName}
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            error={errors.lastName}
                            required
                        />
                    </div>

                    {/* Gender & Phone row */}
                    <div className="form-row form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t.doctor.gender}</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="form-input form-select"
                            >
                                <option value="">-- Sélectionner --</option>
                                {GENDER_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Input
                            label={t.doctor.phone}
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            error={errors.phone}
                            required
                        />
                    </div>

                    {/* Specialty */}
                    <div className="form-group">
                        <label className="form-label">
                            {t.doctor.specialty} <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <select
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                            className={`form-input form-select ${errors.specialty ? 'error' : ''}`}
                            required
                        >
                            <option value="">-- Sélectionner --</option>
                            {SPECIALTY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        {errors.specialty && <span className="form-error">{errors.specialty}</span>}
                    </div>

                    {/* Address */}
                    <div className="form-group">
                        <label className="form-label">{t.doctor.address}</label>
                        <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className="form-input"
                            rows="2"
                            placeholder="Adresse de votre cabinet..."
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={loading}
                        style={{ width: '100%' }}
                    >
                        {t.auth.registerButton}
                    </Button>
                </form>

                {/* Login link */}
                <div className="auth-switch">
                    {t.auth.hasAccount}{' '}
                    <Link to="/login">{t.auth.login}</Link>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
