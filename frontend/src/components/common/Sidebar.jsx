/**
 * Sidebar Component
 * Navigation sidebar for doctor/assistant dashboards
 */

import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import translations from '../../constants/translations';
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
                    <div style={{
                        marginTop: 'var(--space-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--gray-400)'
                    }}>
                        {isDoctor ? 'Espace Médecin' : 'Espace Assistant'}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {/* Doctor Navigation */}
                    {isDoctor && (
                        <>
                            <NavLink
                                to="/doctor/dashboard"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <DashboardIcon /> Espace Médecin
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
                                to="/doctor/assistants"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <GroupIcon /> {t.doctor.assistants}
                            </NavLink>

                            <NavLink
                                to="/doctor/profile"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <PersonIcon /> {t.doctor.profile}
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
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 'var(--space-md)',
                    borderTop: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{
                        marginBottom: 'var(--space-sm)',
                        fontSize: '0.875rem',
                        color: 'var(--gray-300)'
                    }}>
                        {displayName}
                    </div>

                    <ThemeToggle />

                    <button
                        onClick={handleLogout}
                        className="btn btn-ghost"
                        style={{
                            width: '100%',
                            color: 'var(--gray-400)',
                            justifyContent: 'flex-start'
                        }}
                    >
                        <LogoutIcon fontSize="small" style={{ marginRight: '0.5rem' }} /> {t.auth.logout}
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
