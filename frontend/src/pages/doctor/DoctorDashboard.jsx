import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import doctorService from '../../services/doctorService';
import caseService from '../../services/caseService';
import translations from '../../constants/translations';
import { showError, showConfirm } from '../../utils/toast';
import '../../styles/dashboard.css';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InboxIcon from '@mui/icons-material/Inbox';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import Button from '../../components/common/Button';

const t = translations;

function DoctorDashboard() {
    // State
    const [stats, setStats] = useState(null);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Load data
    useEffect(() => {
        loadData();
    }, [filter]);

    async function loadData() {
        setLoading(true);
        try {
            // Load stats and cases in parallel
            // If filter is 'all', pass null to get all cases
            const casesFilter = filter === 'all' ? null : filter;

            const [statsRes, casesRes] = await Promise.all([
                doctorService.getDashboard(),
                caseService.getAll(casesFilter)
            ]);

            if (statsRes.success) {
                setStats(statsRes.data.stats);
            }

            if (casesRes.success) {
                setCases(casesRes.data);
            }
        } catch (error) {
            console.error('Load data error:', error);
        } finally {
            setLoading(false);
        }
    }

    // Delete case
    async function handleDelete(caseId) {
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer ce cas ?');
        if (!confirmed) {
            return;
        }

        try {
            const response = await caseService.deleteCase(caseId);
            if (response.success) {
                setCases(prev => prev.filter(c => c.id !== caseId));
                // Reload stats to update counts
                const statsRes = await doctorService.getDashboard();
                if (statsRes.success) {
                    setStats(statsRes.data.stats);
                }
            }
        } catch (error) {
            console.error('Delete case error:', error);
            showError('Erreur lors de la suppression');
        }
    }

    // Status badge
    function getStatusBadge(status) {
        const badges = {
            in_progress: { class: 'badge-warning', text: t.case.status.inProgress },
            submitted: { class: 'badge-info', text: t.case.status.submitted },
            reviewed: { class: 'badge-success', text: t.case.status.reviewed },
            closed: { class: 'badge-gray', text: t.case.status.closed }
        };
        const badge = badges[status] || badges.in_progress;
        return <span className={`badge ${badge.class}`}>{badge.text}</span>;
    }

    return (
        <div className="layout">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Tableau de bord</h1>
                        <p style={{ margin: 0, fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Vue d'ensemble de votre activité
                        </p>
                    </div>
                </div>

                <div className="page-content">
                    {loading && !stats ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-card-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                                        <AssignmentIcon fontSize="medium" />
                                    </div>
                                    <div className="stat-card-value">{stats?.pendingCases || 0}</div>
                                    <div className="stat-card-label">{t.doctor.pendingCases}</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                                        <CheckCircleIcon fontSize="medium" />
                                    </div>
                                    <div className="stat-card-value">{stats?.reviewedCases || 0}</div>
                                    <div className="stat-card-label">{t.doctor.reviewedCases}</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-icon" style={{ background: 'var(--secondary-100)', color: 'var(--secondary-600)' }}>
                                        <GroupsIcon fontSize="medium" />
                                    </div>
                                    <div className="stat-card-value">{stats?.totalAssistants || 0}</div>
                                    <div className="stat-card-label">{t.doctor.totalAssistants}</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-500)' }}>
                                        <PersonIcon fontSize="medium" />
                                    </div>
                                    <div className="stat-card-value">{stats?.totalPatients || 0}</div>
                                    <div className="stat-card-label">{t.patient.patients}</div>
                                </div>
                            </div>

                            {/* Case Management Section */}
                            <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
                                <div className="card-header">
                                    <div className="flex justify-between items-center flex-wrap gap-4">
                                        <h2 className="card-title">Gestion des Cas</h2>

                                        {/* Filter Tabs - Segmented */}
                                        <div className="segmented-group">
                                            {[
                                                { value: 'all', label: 'Tous' },
                                                { value: 'submitted', label: 'En attente' },
                                                { value: 'reviewed', label: 'Traités' }
                                            ].map(tab => (
                                                <button
                                                    key={tab.value}
                                                    className={`seg-btn ${filter === tab.value ? 'seg-active' : ''}`}
                                                    onClick={() => setFilter(tab.value)}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="table-container desktop-table-container">
                                    {loading ? (
                                        <div className="flex justify-center p-4">
                                            <LoadingSpinner size="md" />
                                        </div>
                                    ) : cases.length > 0 ? (
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>{t.patient.title}</th>
                                                    <th>{t.common.date}</th>
                                                    <th>{t.common.status}</th>
                                                    <th style={{ textAlign: 'right' }}>{t.common.actions}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cases.map(caseItem => (
                                                    <tr key={caseItem.id}>
                                                        <td data-label={t.patient.title}>
                                                            <div>
                                                                <strong>
                                                                    {caseItem.patient_first_name || caseItem.patient?.first_name || ''}{' '}
                                                                    {caseItem.patient_last_name || caseItem.patient?.last_name || ''}
                                                                </strong>
                                                            </div>
                                                        </td>
                                                        <td data-label={t.common.date}>
                                                            {new Date(caseItem.created_at || caseItem.createdAt).toLocaleDateString('fr-FR', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </td>
                                                        <td data-label={t.common.status}>{getStatusBadge(caseItem.status)}</td>
                                                        <td data-label={t.common.actions} className="col-actions text-right">
                                                            <div className="flex gap-sm justify-end">
                                                                <Link
                                                                    to={`/doctor/cases/${caseItem.id}`}
                                                                    state={{ from: 'dashboard' }}
                                                                    className="btn btn-primary btn-sm"
                                                                >
                                                                    <VisibilityIcon fontSize="small" /> Voir
                                                                </Link>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="btn-icon"
                                                                    onClick={() => handleDelete(caseItem.id)}
                                                                    title="Supprimer"
                                                                    style={{ color: 'var(--error)' }}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-xl)' }}>
                                            <div style={{
                                                width: 56, height: 56, borderRadius: '50%',
                                                background: 'var(--gray-100)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto var(--space-md)'
                                            }}>
                                                <InboxIcon style={{ color: 'var(--gray-400)', fontSize: 28 }} />
                                            </div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                                Aucun cas {filter === 'submitted' ? 'en attente' : filter === 'reviewed' ? 'traité' : ''}
                                            </div>
                                            <div style={{ fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                                                Les cas apparaîtront ici une fois soumis par vos assistants
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Mobile List View (Replit Style) */}
                                {!loading && cases.length > 0 && (
                                    <div className="mobile-list-container" style={{ padding: '0 0 var(--space-md) 0' }}>
                                        {cases.map(caseItem => (
                                            <Link
                                                key={`mob-${caseItem.id}`}
                                                to={`/doctor/cases/${caseItem.id}`}
                                                state={{ from: 'dashboard' }}
                                                className="mobile-list-header px-4 py-3"
                                                style={{ borderBottom: '1px solid var(--border-color)', textDecoration: 'none' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', minWidth: 0 }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {caseItem.patient_first_name || caseItem.patient?.first_name || ''}{' '}
                                                            {caseItem.patient_last_name || caseItem.patient?.last_name || ''}
                                                        </p>
                                                        <p style={{ margin: '2px 0 4px 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            {new Date(caseItem.created_at || caseItem.createdAt).toLocaleDateString()}
                                                        </p>
                                                        <div>
                                                            {getStatusBadge(caseItem.status)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexShrink: 0 }}>
                                                    <KeyboardArrowRightIcon style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default DoctorDashboard;
