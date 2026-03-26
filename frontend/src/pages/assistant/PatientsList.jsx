/**
 * Patients List Page
 * Assistant main page showing patient list
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import patientService from '../../services/patientService';
import caseService from '../../services/caseService';
import translations from '../../constants/translations';
import { showError, showConfirm } from '../../utils/toast';
import { GENDER_OPTIONS } from '../../constants/config';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import GroupOffIcon from '@mui/icons-material/GroupOff';

const t = translations;

function PatientsList() {
    // State
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    // Filter/Sort/Pagination State
    const [genderFilter, setGenderFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'name_asc', 'age_desc', 'age_asc'
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // History State
    const [expandedPatientId, setExpandedPatientId] = useState(null);
    const [historyData, setHistoryData] = useState({});
    const [historyLoading, setHistoryLoading] = useState({});

    // Patient form
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        gender: 'male',
        age: '',
        phone: ''
    });
    const [formErrors, setFormErrors] = useState({});

    const navigate = useNavigate();

    // Load patients
    useEffect(() => {
        loadPatients();
    }, []);

    async function loadPatients() {
        try {
            const response = await patientService.getAll();
            if (response.success) {
                setPatients(response.data);
            }
        } catch (error) {
            console.error('Load patients error:', error);
        } finally {
            setLoading(false);
        }
    }

    // Handle search (Server-side API or Client-side depending on length)
    async function handleSearch(e) {
        const query = e.target.value;
        setSearchQuery(query);
        setCurrentPage(1); // Reset to first page on search

        if (query.length >= 2) {
            try {
                const response = await patientService.search(query);
                if (response.success) {
                    setPatients(response.data);
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        } else if (query.length === 0) {
            loadPatients();
        }
    }

    function clearSearch() {
        setSearchQuery('');
        loadPatients();
    }

    // Data Processing (Filter, Sort, Paginate)
    const processedPatients = useMemo(() => {
        let result = [...patients];

        // 1. Filter
        if (genderFilter !== 'all') {
            result = result.filter(p => p.gender === genderFilter);
        }

        // 2. Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name_asc':
                    const nameA = (a.firstName || a.first_name || '').toLowerCase();
                    const nameB = (b.firstName || b.first_name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                case 'age_desc':
                    return (b.age || 0) - (a.age || 0);
                case 'age_asc':
                    return (a.age || 0) - (b.age || 0);
                case 'newest':
                default:
                    // Assuming id represents insertion order roughly if created_at isn't fetched initially
                    return b.id - a.id;
            }
        });

        return result;
    }, [patients, genderFilter, sortBy]);

    const paginatedPatients = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return processedPatients.slice(startIndex, startIndex + rowsPerPage);
    }, [processedPatients, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(processedPatients.length / rowsPerPage);

    // Handle form change
    function handleFormChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setFormErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Validate form
    function validateForm() {
        const errors = {};
        if (!formData.firstName.trim()) errors.firstName = t.errors.required;
        if (!formData.lastName.trim()) errors.lastName = t.errors.required;
        if (!formData.age || formData.age < 0) errors.age = t.errors.required;
        if (!formData.phone.trim()) errors.phone = t.errors.required;
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    // Submit patient (Create or Update)
    async function handleSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;

        setModalLoading(true);
        try {
            let response;
            if (selectedPatient) {
                response = await patientService.update(selectedPatient.id, formData);
                if (response.success) {
                    setPatients(prev => prev.map(p =>
                        p.id === selectedPatient.id ? { ...p, ...formData } : p
                    ));
                    closeModal();
                }
            } else {
                response = await patientService.create(formData);
                if (response.success) {
                    setPatients(prev => [response.data, ...prev]);
                    closeModal();
                }
            }
        } catch (error) {
            console.error('Save patient error:', error);
            setFormErrors({ general: error.message || t.errors.serverError });
        } finally {
            setModalLoading(false);
        }
    }

    // Open modal for New Patient
    function openNewPatientModal() {
        setFormData({ firstName: '', lastName: '', gender: 'male', age: '', phone: '' });
        setFormErrors({});
        setSelectedPatient(null);
        setShowModal(true);
    }

    // Open modal for Edit Patient
    function handleEditClick(e, patient) {
        e.stopPropagation();
        setSelectedPatient(patient);
        setFormData({
            firstName: patient.firstName || patient.first_name || '',
            lastName: patient.lastName || patient.last_name || '',
            gender: patient.gender || 'male',
            age: patient.age || '',
            phone: patient.phone || ''
        });
        setFormErrors({});
        setShowModal(true);
    }

    // Close modal
    function closeModal() {
        setShowModal(false);
        setFormData({ firstName: '', lastName: '', gender: 'male', age: '', phone: '' });
        setFormErrors({});
        setSelectedPatient(null);
    }

    function startCase(patient) {
        navigate(`/assistant/case/new/${patient.id}`);
    }

    // Toggle History
    async function toggleHistory(patientId) {
        if (expandedPatientId === patientId) {
            setExpandedPatientId(null);
            return;
        }

        setExpandedPatientId(patientId);

        // Load if not loaded
        setHistoryLoading(prev => ({ ...prev, [patientId]: true }));
        try {
            const response = await patientService.getById(patientId);
            if (response.success && response.data.cases) {
                // Sort by date (newest to oldest)
                const sortedCases = response.data.cases.sort((a, b) =>
                    new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
                );
                setHistoryData(prev => ({ ...prev, [patientId]: sortedCases }));
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setHistoryLoading(prev => ({ ...prev, [patientId]: false }));
        }
    }

    // Handle Delete Case
    async function handleDeleteCase(e, caseId, patientId) {
        e.stopPropagation();
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer cette visite en cours ?');
        if (!confirmed) {
            return;
        }

        try {
            const response = await caseService.deleteCase(caseId);
            if (response.success) {
                setHistoryData(prev => ({
                    ...prev,
                    [patientId]: prev[patientId].filter(c => c.id !== caseId)
                }));
            }
        } catch (error) {
            console.error('Delete case error:', error);
            showError('Erreur lors de la suppression de la visite');
        }
    }

    return (
        <div className="layout">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t.assistant.patientsList}</h1>
                        <p style={{ margin: 0, fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Gérez vos patients et démarrez de nouvelles consultations.
                        </p>
                    </div>
                    <Button variant="primary" onClick={openNewPatientModal}>
                        <AddIcon fontSize="small" /> {t.assistant.newPatient}
                    </Button>
                </div>

                <div className="page-content">
                    {/* SaaS Toolbar */}
                    <div className="card" style={{ marginBottom: 'var(--space-lg)', border: 'none', background: 'transparent', boxShadow: 'none' }}>
                        <div className="flex justify-between items-center flex-wrap gap-md" style={{ padding: '0' }}>
                            {/* Search */}
                            <div className="form-group" style={{ marginBottom: 0, flex: '1', minWidth: '180px', position: 'relative' }}>
                                <SearchIcon style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ paddingLeft: '40px', paddingRight: '40px' }}
                                    placeholder={t.patient.searchPatient}
                                    value={searchQuery}
                                    onChange={handleSearch}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={clearSearch}
                                        style={{
                                            position: 'absolute', right: '12px', top: '10px',
                                            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                                        }}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </button>
                                )}
                            </div>

                            {/* Filters & Sort */}
                            <div className="flex gap-sm">
                                <select
                                    className="form-input form-select"
                                    style={{ width: 'auto' }}
                                    value={genderFilter}
                                    onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
                                >
                                    <option value="all">Tous les genres</option>
                                    <option value="male">Homme</option>
                                    <option value="female">Femme</option>
                                </select>

                                <select
                                    className="form-input form-select"
                                    style={{ width: 'auto' }}
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="newest">Plus récents</option>
                                    <option value="name_asc">Nom (A-Z)</option>
                                    <option value="age_desc">Âge (Décroissant)</option>
                                    <option value="age_asc">Âge (Croissant)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    {loading ? (
                        <div className="skeleton-card-container" style={{ minHeight: '400px' }}>
                            <div className="skeleton skeleton-text" style={{ height: '40px', marginBottom: '20px' }}></div>
                            <div className="skeleton skeleton-text" style={{ height: '40px', marginBottom: '10px' }}></div>
                            <div className="skeleton skeleton-text" style={{ height: '40px', marginBottom: '10px' }}></div>
                            <div className="skeleton skeleton-text" style={{ height: '40px', marginBottom: '10px' }}></div>
                        </div>
                    ) : processedPatients.length > 0 ? (
                        <div className="card">
                            {/* Desktop Table */}
                            <div className="table-container desktop-table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '32px' }}></th>
                                            <th className="col-hide-md" style={{ width: '12%' }}>Date</th>
                                            <th>Patient</th>
                                            <th style={{ width: '10%' }}>{t.patient.gender}</th>
                                            <th style={{ width: '8%' }}>{t.patient.age}</th>
                                            <th className="col-hide-md" style={{ width: '14%' }}>{t.patient.phone}</th>
                                            <th className="col-actions" style={{ width: '160px' }}>{t.common.actions}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPatients.map(patient => (
                                            <React.Fragment key={patient.id}>
                                                {/* Main Row */}
                                                <tr style={{ cursor: 'pointer' }} onClick={() => toggleHistory(patient.id)}>
                                                    <td style={{ color: 'var(--text-muted)' }}>
                                                        <KeyboardArrowRightIcon
                                                            style={{
                                                                transform: expandedPatientId === patient.id ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                transition: 'transform var(--transition-base)',
                                                                fontSize: '20px'
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="col-hide-md" style={{ color: 'var(--text-secondary)' }}>
                                                        {new Date(patient.createdAt || Date.now()).toLocaleDateString()}
                                                    </td>
                                                    <td className="col-truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }} title={`${patient.firstName || patient.first_name} ${patient.lastName || patient.last_name}`}>
                                                        {patient.firstName || patient.first_name} {patient.lastName || patient.last_name}
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-gray">
                                                            {patient.gender === 'male' ? t.patient.male :
                                                                patient.gender === 'female' ? t.patient.female : t.patient.other}
                                                        </span>
                                                    </td>
                                                    <td>{patient.age} ans</td>
                                                    <td className="col-hide-md" style={{ color: 'var(--text-secondary)' }}>{patient.phone || '-'}</td>
                                                    <td className="col-actions">
                                                        <div>
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    startCase(patient);
                                                                }}
                                                                title={t.assistant.startCase}
                                                            >
                                                                <PlayArrowIcon fontSize="small" /> <span style={{ marginLeft: '4px' }}>Démarrer</span>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="btn-icon"
                                                                onClick={(e) => handleEditClick(e, patient)}
                                                                title="Modifier"
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded History Row (SaaS Sub-card) */}
                                                {expandedPatientId === patient.id && (
                                                    <tr style={{ backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--border-color)' }}>
                                                        <td colSpan="7" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
                                                            <div className="card" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                                                                <div className="card-header" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Historique des visites</h4>
                                                                        <span className="badge badge-info">Patient ID: {patient.id}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="card-body" style={{ padding: '0' }}>
                                                                    {historyLoading[patient.id] ? (
                                                                        <div className="flex justify-center" style={{ padding: 'var(--space-xl)' }}>
                                                                            <LoadingSpinner size="sm" />
                                                                        </div>
                                                                    ) : historyData[patient.id] && historyData[patient.id].length > 0 ? (
                                                                        <table className="table" style={{ margin: 0 }}>
                                                                            <thead style={{ background: 'transparent' }}>
                                                                                <tr>
                                                                                    <th style={{ padding: 'var(--space-sm) var(--space-lg)' }}>Visite</th>
                                                                                    <th style={{ padding: 'var(--space-sm) var(--space-lg)' }}>Date</th>
                                                                                    <th style={{ padding: 'var(--space-sm) var(--space-lg)' }}>Statut</th>
                                                                                    <th style={{ padding: 'var(--space-sm) var(--space-lg)', textAlign: 'right' }}>Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {historyData[patient.id].map((cse, index) => (
                                                                                    <tr key={cse.id} style={{ background: 'transparent' }}>
                                                                                        <td style={{ padding: 'var(--space-sm) var(--space-lg)' }}>
                                                                                            <strong>Visite #{historyData[patient.id].length - index}</strong>
                                                                                        </td>
                                                                                        <td style={{ padding: 'var(--space-sm) var(--space-lg)', color: 'var(--text-secondary)' }}>
                                                                                            {new Date(cse.createdAt || cse.created_at).toLocaleString()}
                                                                                        </td>
                                                                                        <td style={{ padding: 'var(--space-sm) var(--space-lg)' }}>
                                                                                            <span className={`badge badge-${cse.status === 'in_progress' ? 'warning' :
                                                                                                cse.status === 'submitted' ? 'info' :
                                                                                                    cse.status === 'reviewed' ? 'success' : 'gray'
                                                                                                }`}>
                                                                                                {cse.status === 'in_progress' ? 'En cours' :
                                                                                                    cse.status === 'submitted' ? 'En attente' :
                                                                                                        cse.status === 'reviewed' ? 'Traité' : 'Clôturé'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td style={{ padding: 'var(--space-sm) var(--space-lg)' }}>
                                                                                            <div className="flex gap-2 justify-right" style={{ justifyContent: 'flex-end' }}>
                                                                                                {cse.status === 'in_progress' && (
                                                                                                    <>
                                                                                                        <Button
                                                                                                            variant="secondary"
                                                                                                            size="sm"
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                navigate(`/assistant/case/new/${patient.id}`);
                                                                                                            }}
                                                                                                        >
                                                                                                            Reprendre
                                                                                                        </Button>
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="sm"
                                                                                                            className="btn-icon"
                                                                                                            onClick={(e) => handleDeleteCase(e, cse.id, patient.id)}
                                                                                                            title="Supprimer"
                                                                                                            style={{ color: 'var(--error)' }}
                                                                                                        >
                                                                                                            <DeleteIcon fontSize="small" />
                                                                                                        </Button>
                                                                                                    </>
                                                                                                )}
                                                                                                {cse.status === 'reviewed' && (
                                                                                                    <Button
                                                                                                        variant="secondary"
                                                                                                        size="sm"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            navigate(`/assistant/case/${cse.id}/review`);
                                                                                                        }}
                                                                                                    >
                                                                                                        <VisibilityIcon fontSize="small" style={{ marginRight: '4px' }} /> Voir
                                                                                                    </Button>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    ) : (
                                                                        <div className="text-center" style={{ padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                                                            <p style={{ margin: 0 }}>Aucune visite précédente pour ce patient.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile List View (Replit Style) */}
                            <div className="mobile-list-container" style={{ padding: 'var(--space-md)' }}>
                                {paginatedPatients.map(patient => (
                                    <div key={`mob-${patient.id}`} className="mobile-list-item">
                                        <button
                                            className="mobile-list-header"
                                            onClick={() => toggleHistory(patient.id)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', minWidth: 0 }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <VisibilityIcon style={{ color: 'var(--primary)', fontSize: '20px' }} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {patient.firstName || patient.first_name} {patient.lastName || patient.last_name}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {patient.age} ans · {patient.gender === 'female' ? 'Femme' : 'Homme'} {patient.phone ? `· ${patient.phone}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexShrink: 0 }}>
                                                <KeyboardArrowRightIcon
                                                    style={{
                                                        transform: expandedPatientId === patient.id ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.2s',
                                                        color: 'var(--text-muted)'
                                                    }}
                                                />
                                            </div>
                                        </button>

                                        {/* Expanded History for Mobile */}
                                        {expandedPatientId === patient.id && (
                                            <div className="mobile-list-content">
                                                <div style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-md) 0', borderBottom: '1px solid var(--border-color)' }}>
                                                    <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); startCase(patient); }}>
                                                        <PlayArrowIcon fontSize="small" /> Démarrer cas
                                                    </Button>
                                                    <Button variant="secondary" size="sm" className="btn-icon" onClick={(e) => handleEditClick(e, patient)}>
                                                        <EditIcon fontSize="small" />
                                                    </Button>
                                                </div>

                                                <h5 style={{ margin: 'var(--space-md) 0 var(--space-sm) 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Historique des visites</h5>

                                                {historyLoading[patient.id] ? (
                                                    <div className="flex justify-center" style={{ padding: 'var(--space-md)' }}><LoadingSpinner size="sm" /></div>
                                                ) : historyData[patient.id] && historyData[patient.id].length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                                        {historyData[patient.id].map(cse => (
                                                            <div key={`mob-case-${cse.id}`}
                                                                style={{ background: 'var(--bg-elevated)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                            >
                                                                <div>
                                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>{new Date(cse.createdAt || cse.created_at).toLocaleDateString()}</p>
                                                                    <span style={{ fontSize: '0.7rem' }} className={`badge badge-${cse.status === 'in_progress' ? 'warning' : cse.status === 'submitted' ? 'info' : cse.status === 'reviewed' ? 'success' : 'gray'}`}>
                                                                        {cse.status === 'in_progress' ? 'En cours' : cse.status === 'submitted' ? 'En attente' : cse.status === 'reviewed' ? 'Traité' : 'Clôturé'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    {cse.status === 'in_progress' && (
                                                                        <>
                                                                            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/assistant/case/new/${patient.id}`); }}>Reprendre</Button>
                                                                        </>
                                                                    )}
                                                                    {cse.status === 'reviewed' && (
                                                                        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/assistant/case/${cse.id}/review`); }}><VisibilityIcon fontSize="small" /></Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p style={{ margin: 'var(--space-sm) 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune visite précédente.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Footer */}
                            {processedPatients.length > 0 && (
                                <div className="card-footer flex justify-between items-center" style={{ background: 'var(--bg-card)' }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Affichage de {((currentPage - 1) * rowsPerPage) + 1} à {Math.min(currentPage * rowsPerPage, processedPatients.length)} sur {processedPatients.length} patients
                                    </div>
                                    <div className="flex items-center gap-md">
                                        <select
                                            className="form-input form-select"
                                            style={{ width: 'auto', padding: 'var(--space-xs) 2rem var(--space-xs) var(--space-sm)', height: '32px' }}
                                            value={rowsPerPage}
                                            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        >
                                            <option value={10}>10 par page</option>
                                            <option value={25}>25 par page</option>
                                            <option value={50}>50 par page</option>
                                        </select>
                                        <div className="flex gap-sm">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            >
                                                Précédent
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            >
                                                Suivant
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        // Empty State (No Data or No Search Results)
                        <div className="card flex flex-col items-center justify-center" style={{ padding: 'var(--space-3xl)', textAlign: 'center', background: 'var(--bg-surface)' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%', background: 'var(--gray-100)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-md)', color: 'var(--text-muted)'
                            }}>
                                <GroupOffIcon fontSize="large" />
                            </div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Aucun patient trouvé</h3>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: 'var(--space-lg)' }}>
                                {searchQuery
                                    ? `Nous n'avons trouvé aucun patient correspondant à "${searchQuery}".`
                                    : "Vous n'avez pas encore de patients dans votre liste. Commencez par ajouter un nouveau patient."}
                            </p>
                            {searchQuery ? (
                                <Button variant="secondary" onClick={clearSearch}>Réinitialiser la recherche</Button>
                            ) : (
                                <Button variant="primary" onClick={openNewPatientModal}>
                                    <AddIcon fontSize="small" /> Ajouter un patient
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Patient Modal (Create/Edit) - Updated 2 column Layout */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={selectedPatient ? "Modifier le patient" : t.patient.addPatient}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal}>
                            {t.common.cancel}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            loading={modalLoading}
                        >
                            {t.common.save}
                        </Button>
                    </>
                }
            >
                {formErrors.general && (
                    <div className="alert alert-error">{formErrors.general}</div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 var(--space-md)' }}>
                        <Input
                            label={t.patient.firstName}
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleFormChange}
                            error={formErrors.firstName}
                            required
                        />
                        <Input
                            label={t.patient.lastName}
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleFormChange}
                            error={formErrors.lastName}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t.patient.gender} *</label>
                        <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleFormChange}
                            className="form-input form-select"
                        >
                            {GENDER_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 var(--space-md)' }}>
                        <Input
                            label={t.patient.age}
                            name="age"
                            type="number"
                            value={formData.age}
                            onChange={handleFormChange}
                            error={formErrors.age}
                            required
                        />
                        <Input
                            label={t.patient.phone}
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleFormChange}
                            error={formErrors.phone}
                            required
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default PatientsList;
