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
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SettingsIcon from '@mui/icons-material/Settings';
import ThemeToggle from './ThemeToggle';
// shell.css is now imported in App.jsx (before premium-pages.css)
// so the new flat surfaces override the legacy glass shell consistently.

const t = translations;

const ChatGPTToggleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="M9 3v18"/>
    </svg>
);

/**
 * Sidebar navigation component
 */
function Sidebar() {
    const { user, profile, logout, isDoctor, isAssistant } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Mobile menu state
    const [mobileOpen, setMobileOpen] = useState(false);

    // Collapsed desktop state
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebar_collapsed') === 'true';
    });
    const sidebarIsCollapsed = isCollapsed && !mobileOpen;

    useEffect(() => {
        localStorage.setItem('sidebar_collapsed', isCollapsed);
        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
    }, [isCollapsed]);

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
    const initials = displayName
        ?.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('') || 'MC';
    const roleLabel = isDoctor ? 'Espace Médecin' : 'Espace Assistant';
    const roleHint = isDoctor ? 'Direction Médicale' : 'Gestion des Dossiers';

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

            <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''} ${sidebarIsCollapsed ? 'collapsed' : ''}`}>
                
                {/* Header */}
                <div className="sidebar-header">
                    {/* Collapsed State: Logo becomes the toggle button */}
                    {sidebarIsCollapsed ? (
                        <div 
                            className="collapsed-logo-toggle"
                            onClick={() => setIsCollapsed(false)}
                            title="Ouvrir la barre latérale"
                        >
                            <img src="/assets/logo.png" alt="Logo" className="sidebar-collapsed-logo-img" />
                        </div>
                    ) : (
                        <>
                            {/* Expanded State: Logo on Left, Toggle on Right */}
                            <div className="sidebar-logo">
                                <img src="/assets/logo.png" alt="Medi-Consult Logo" className="sidebar-brand-logo-img" />
                                <div className="sidebar-brand-copy">
                                    <span className="sidebar-brand-name">Medi-Consult</span>
                                    <span className="sidebar-brand-subtitle">{roleLabel}</span>
                                </div>
                            </div>
                            
                            <button 
                                className="chatgpt-toggle-btn"
                                onClick={() => setIsCollapsed(true)}
                                title="Fermer la barre latérale"
                            >
                                <ChatGPTToggleIcon />
                            </button>
                        </>
                    )}
                </div>

                {/* AI Error Banner */}
                {aiErrorConfig && !sidebarIsCollapsed && (
                    <div className="sidebar-alert" style={{
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
                        <span className="sidebar-alert-message" style={{ lineHeight: '1.4' }}>{aiErrorConfig.message}</span>
                        <NavLink to="/doctor/settings" className="sidebar-alert-link" style={{ 
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

                {/* AI Error Dot for Collapsed mode */}
                {aiErrorConfig && sidebarIsCollapsed && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--error-500)', border: '2px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} title="⚠️ Configuration IA - Erreur" onClick={() => navigate('/doctor/settings')}></div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {/* Role indicator */}
                    <div className="sidebar-section-label" style={{
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
                                title={sidebarIsCollapsed ? "Tableau de bord" : ""}
                            >
                                <DashboardIcon /> <span className="sidebar-link-text">Tableau de bord</span>
                            </NavLink>

                            <NavLink
                                to="/doctor/patients"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title={sidebarIsCollapsed ? "Registre des patients" : ""}
                            >
                                <PeopleIcon /> <span className="sidebar-link-text">Registre des patients</span>
                            </NavLink>

                            <NavLink
                                to="/doctor/catalogue"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title={sidebarIsCollapsed ? t.doctor.catalogue : ""}
                            >
                                <AssignmentIcon /> <span className="sidebar-link-text">{t.doctor.catalogue}</span>
                            </NavLink>

                            <NavLink
                                to="/doctor/settings"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title={sidebarIsCollapsed ? "Paramètres" : ""}
                            >
                                <SettingsIcon /> <span className="sidebar-link-text">Paramètres</span>
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
                                title={sidebarIsCollapsed ? t.assistant.patientsList : ""}
                            >
                                <PeopleIcon /> <span className="sidebar-link-text">{t.assistant.patientsList}</span>
                            </NavLink>

                            <NavLink
                                to="/assistant/profile"
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title={sidebarIsCollapsed ? t.assistant.profile : ""}
                            >
                                <PersonIcon /> <span className="sidebar-link-text">{t.assistant.profile}</span>
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* User section */}
                <div className="sidebar-footer">
                    <div className="sidebar-user-card">
                        <span className="sidebar-user-avatar">{initials}</span>
                        <div className="sidebar-user-meta">
                            <span className="sidebar-user-name">{displayName}</span>
                            <span className="sidebar-user-role">{roleHint}</span>
                        </div>
                    </div>

                    <div className="sidebar-footer-actions">
                        <ThemeToggle isCollapsed={sidebarIsCollapsed} />

                        <button
                            onClick={handleLogout}
                            className="theme-toggle-btn"
                            title={sidebarIsCollapsed ? t.auth.logout : ""}
                        >
                            <LogoutIcon fontSize="small" /> <span className="sidebar-link-text">{t.auth.logout}</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
