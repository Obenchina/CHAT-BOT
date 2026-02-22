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
                    <h1 className="page-title">Espace Médecin</h1>
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

                                        {/* Filter Tabs */}
                                        <div className="flex gap-sm">
                                            {[
                                                { value: 'all', label: 'Tous' },
                                                { value: 'submitted', label: 'En attente' },
                                                { value: 'reviewed', label: 'Traités' }
                                            ].map(tab => (
                                                <button
                                                    key={tab.value}
                                                    className={`btn ${filter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => setFilter(tab.value)}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="table-container">
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
                                                    <th>{t.common.actions}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cases.map(caseItem => (
                                                    <tr key={caseItem.id}>
                                                        <td>
                                                            <div>
                                                                <strong>
                                                                    {caseItem.patient_first_name || caseItem.patient?.first_name || ''}{' '}
                                                                    {caseItem.patient_last_name || caseItem.patient?.last_name || ''}
                                                                </strong>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                                                {caseItem.patient?.age || ''} ans
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {new Date(caseItem.created_at || caseItem.createdAt).toLocaleDateString('fr-FR', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </td>
                                                        <td>{getStatusBadge(caseItem.status)}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                                                <Link
                                                                    to={`/doctor/cases/${caseItem.id}`}
                                                                    state={{ from: 'dashboard' }}
                                                                    className="btn btn-primary btn-sm"
                                                                >
                                                                    Voir le cas
                                                                </Link>
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => handleDelete(caseItem.id)}
                                                                    title="Supprimer"
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="card-body text-center" style={{ color: 'var(--gray-500)' }}>
                                            Aucun cas {filter === 'submitted' ? 'en attente' : filter === 'reviewed' ? 'traité' : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default DoctorDashboard;
