/**
 * Sidebar Component
 * Navigation sidebar for doctor/assistant dashboards
 */

import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import translations from '../../constants/translations';
import doctorService from '../../services/doctorService';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ThemeToggle from './ThemeToggle';

const t = translations;

/**
 * Sidebar navigation component
 */
function Sidebar() {
    const { user, profile, logout, isDoctor, isAssistant } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Mobile menu state
    const [mobileOpen, setMobileOpen] = useState(false);

    // Handle logout
    function handleLogout() {
        logout();
        navigate('/login');
    }

    // Close sidebar on mobile when navigating
    function handleNavClick() {
        setMobileOpen(false);
    }

    // Global AI Status Banner state
    const [aiErrorConfig, setAiErrorConfig] = useState(null);

    useEffect(() => {
        // Only run for doctors
        if (isDoctor) {
            doctorService.getAiStatus()
                .then(res => {
                    if (res && res.data && res.data.hasError) {
                        setAiErrorConfig(res.data);
                    } else if (res && res.hasError) {
                        setAiErrorConfig(res); // fallback if axios unwrap differs
                    } else {
                        setAiErrorConfig(null);
                    }
                })
                .catch(err => {
                    console.error('Failed to get AI status for sidebar:', err);
                });
        }
    }, [isDoctor, location.pathname]); // refetch slightly on page change to catch updates

    // Profile name
    const displayName = profile
        ? `${profile.firstName || profile.first_name} ${profile.lastName || profile.last_name}`
        : user?.email;

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                className="sidebar-hamburger"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
            >
                {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
                {/* Header */}
                <div className="sidebar-header">
                    <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <LocalHospitalIcon fontSize="large" /> MediConsult
                    </div>
                </div>

                {/* AI Error Banner */}
                {aiErrorConfig && (
                    <div style={{
                        background: 'var(--error-500)',
                        color: 'white',
                        padding: 'var(--space-md) var(--space-md)',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        textAlign: 'center',
                        margin: '0',
                        borderBottom: '1px solid var(--error-600)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                    }}>
                        <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 'bold' }}>⚠️ Configuration IA</span>
                        <span style={{ lineHeight: '1.4' }}>{aiErrorConfig.message}</span>
                        <NavLink to="/doctor/settings" style={{ 
                            color: 'white', 
                            textDecoration: 'underline', 
                            marginTop: '0.3rem', 
                            fontSize: '0.8rem',
                            fontWeight: '600'
                        }} onClick={handleNavClick}>
                            Vérifier l'abonnement
                        </NavLink>
                    </div>
                )}

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {/* Role indicator */}
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'rgba(148, 163, 184, 0.6)',
                        padding: '0 var(--space-md)',
                        marginBottom: 'var(--space-sm)'
                    }}>
                        {isDoctor ? 'Médecin' : 'Assistant'}
                    </div>

                    {/* Doctor Navigation */}
                    {isDoctor && (
                        <>
                            <NavLink
                                to="/doctor/dashboard"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <DashboardIcon /> Tableau de bord
                            </NavLink>

                            <NavLink
                                to="/doctor/patients"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <PeopleIcon /> Liste des patients
                            </NavLink>

                            <NavLink
                                to="/doctor/catalogue"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <AssignmentIcon /> {t.doctor.catalogue}
                            </NavLink>

                            <NavLink
                                to="/doctor/settings"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <PersonIcon /> Paramètres
                            </NavLink>
                        </>
                    )}

                    {/* Assistant Navigation */}
                    {isAssistant && (
                        <>
                            <NavLink
                                to="/assistant/patients"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <PeopleIcon /> {t.assistant.patientsList}
                            </NavLink>

                            <NavLink
                                to="/assistant/profile"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <PersonIcon /> {t.assistant.profile}
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* User section */}
                <div className="sidebar-footer">
                    <div style={{
                        marginBottom: 'var(--space-sm)',
                        fontSize: '0.813rem',
                        color: 'rgba(226, 232, 240, 0.7)',
                        fontWeight: 500
                    }}>
                        {displayName}
                    </div>

                    <ThemeToggle />

                    <button
                        onClick={handleLogout}
                        className="theme-toggle-btn"
                    >
                        <LogoutIcon fontSize="small" /> {t.auth.logout}
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
