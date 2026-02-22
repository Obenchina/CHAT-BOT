/**
 * Patients List Page
 * Assistant main page showing patient list
 */

import React, { useState, useEffect } from 'react';
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

const t = translations;

function PatientsList() {
    // State
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

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

    // Handle search
    async function handleSearch(e) {
        const query = e.target.value;
        setSearchQuery(query);

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
                // Update existing patient
                response = await patientService.update(selectedPatient.id, formData);
                if (response.success) {
                    setPatients(prev => prev.map(p =>
                        p.id === selectedPatient.id ? { ...p, ...formData } : p
                    ));
                    closeModal();
                }
            } else {
                // Create new patient
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

    // Handle Delete Case (Only for in_progress status)
    async function handleDeleteCase(e, caseId, patientId) {
        e.stopPropagation();
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer cette visite en cours ?');
        if (!confirmed) {
            return;
        }

        try {
            const response = await caseService.deleteCase(caseId);
            if (response.success) {
                // Update history data
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
                    <h1 className="page-title">{t.assistant.patientsList}</h1>
                    <Button variant="primary" onClick={openNewPatientModal}>
                        + {t.assistant.newPatient}
                    </Button>
                </div>

                <div className="page-content">
                    {/* Search */}
                    <div style={{ marginBottom: 'var(--space-lg)', maxWidth: '400px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder={t.patient.searchPatient}
                            value={searchQuery}
                            onChange={handleSearch}
                        />
                    </div>

                    {/* Patients list */}
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : patients.length > 0 ? (
                        <div className="card">
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>{t.patient.firstName}</th>
                                            <th>{t.patient.lastName}</th>
                                            <th>{t.patient.gender}</th>
                                            <th>{t.patient.age}</th>
                                            <th>{t.patient.phone}</th>
                                            <th>{t.common.actions}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients.map(patient => (
                                            <React.Fragment key={patient.id}>
                                                <tr style={{ cursor: 'pointer' }} onClick={() => toggleHistory(patient.id)}>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            transform: expandedPatientId === patient.id ? 'rotate(90deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.2s',
                                                            marginRight: '8px'
                                                        }}>
                                                            <KeyboardArrowRightIcon />
                                                        </span>
                                                        {patient.firstName || patient.first_name}
                                                    </td>
                                                    <td>{patient.lastName || patient.last_name}</td>
                                                    <td>
                                                        {patient.gender === 'male' ? t.patient.male :
                                                            patient.gender === 'female' ? t.patient.female : t.patient.other}
                                                    </td>
                                                    <td>{patient.age} ans</td>
                                                    <td>{patient.phone}</td>
                                                    <td>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    startCase(patient);
                                                                }}
                                                            >
                                                                {t.assistant.startCase}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => handleEditClick(e, patient)}
                                                                title="Modifier"
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedPatientId === patient.id && (
                                                    <tr className="history-row" style={{ backgroundColor: 'var(--gray-50)' }}>
                                                        <td colSpan="6" style={{ padding: 'var(--space-md)' }}>
                                                            <div className="history-container">
                                                                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Historique des visites</h4>
                                                                {historyLoading[patient.id] ? (
                                                                    <LoadingSpinner size="sm" />
                                                                ) : historyData[patient.id] && historyData[patient.id].length > 0 ? (
                                                                    <table className="table table-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Visite</th>
                                                                                <th>Date</th>
                                                                                <th>Statut</th>
                                                                                <th>Action</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {historyData[patient.id].map((cse, index) => (
                                                                                <tr key={cse.id}>
                                                                                    <td><strong>Visite {historyData[patient.id].length - index}</strong></td>
                                                                                    <td>{new Date(cse.createdAt || cse.created_at).toLocaleString()}</td>
                                                                                    <td>
                                                                                        <span className={`badge badge-${cse.status === 'in_progress' ? 'warning' :
                                                                                            cse.status === 'submitted' ? 'info' :
                                                                                                cse.status === 'reviewed' ? 'success' : 'gray'
                                                                                            }`}>
                                                                                            {cse.status === 'in_progress' ? 'En cours' :
                                                                                                cse.status === 'submitted' ? 'En attente' :
                                                                                                    cse.status === 'reviewed' ? 'Traité' : 'Clôturé'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td>
                                                                                        <div className="flex gap-2">
                                                                                            {cse.status === 'in_progress' && (
                                                                                                <>
                                                                                                    <Button
                                                                                                        variant="primary"
                                                                                                        size="sm"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            // Go to questionnaire to resume
                                                                                                            navigate(`/assistant/case/new/${patient.id}`);
                                                                                                        }}
                                                                                                    >
                                                                                                        Reprendre
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        variant="danger"
                                                                                                        size="sm"
                                                                                                        onClick={(e) => handleDeleteCase(e, cse.id, patient.id)}
                                                                                                        title="Supprimer"
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
                                                                                                    Voir
                                                                                                </Button>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                ) : (
                                                                    <p style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Aucune visite précédente.</p>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-body text-center" style={{ color: 'var(--gray-500)' }}>
                                {t.patient.noPatients}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Patient Modal (Create/Edit) */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={selectedPatient ? "Modifier le patient" : t.patient.addPatient}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeModal}>
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
                </form>
            </Modal>
        </div>
    );
}

export default PatientsList;
