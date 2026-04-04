/**
 * Catalogue Management Page
 * Doctor can manage questionnaire questions with drag-and-drop reordering
 */

import { useState, useEffect } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import catalogueService from '../../services/catalogueService';
import translations from '../../constants/translations';
import { showSuccess, showConfirm } from '../../utils/toast';
import { ANSWER_TYPES } from '../../constants/config';
import '../../styles/dragdrop.css';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import InboxIcon from '@mui/icons-material/Inbox';

const t = translations;

function CatalogueManagement() {
    // State
    const [catalogue, setCatalogue] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [saving, setSaving] = useState(false);

    // Drag and drop state
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverItem, setDragOverItem] = useState(null);
    const [, setIsDragging] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        questionText: '',
        answerType: 'voice',
        isRequired: true,
        isActive: true,
        choices: ''
    });
    const [formErrors, setFormErrors] = useState({});

    // Load catalogue
    useEffect(() => {
        loadCatalogue();
    }, []);

    async function loadCatalogue() {
        try {
            const response = await catalogueService.getCatalogue();
            if (response.success) {
                setCatalogue(response.data.catalogue);
                setQuestions(response.data.questions || []);
            }
        } catch (error) {
            console.error('Load catalogue error:', error);
        } finally {
            setLoading(false);
        }
    }

    // ==========================================
    // DRAG AND DROP HANDLERS
    // ==========================================

    function handleDragStart(e, index) {
        setDraggedItem(index);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        // Add drag image
        e.target.classList.add('dragging');
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        setDraggedItem(null);
        setDragOverItem(null);
        setIsDragging(false);
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItem !== index) {
            setDragOverItem(index);
        }
    }

    function handleDragEnter(e, index) {
        e.preventDefault();
        if (draggedItem !== index) {
            setDragOverItem(index);
        }
    }

    function handleDragLeave(e) {
        // Only reset if leaving the row entirely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverItem(null);
        }
    }

    async function handleDrop(e, dropIndex) {
        e.preventDefault();

        if (draggedItem === null || draggedItem === dropIndex) {
            setDragOverItem(null);
            return;
        }

        // Reorder questions locally
        const newQuestions = [...questions];
        const [removed] = newQuestions.splice(draggedItem, 1);
        newQuestions.splice(dropIndex, 0, removed);

        // Update state immediately for smooth UX
        setQuestions(newQuestions);
        setDragOverItem(null);
        setDraggedItem(null);
        setIsDragging(false);

        // Save to backend
        try {
            const orderData = newQuestions.map((q, idx) => ({
                id: q.id,
                orderIndex: idx + 1
            }));

            await catalogueService.reorderQuestions(catalogue.id, orderData);
        } catch (error) {
            console.error('Reorder error:', error);
            // Reload on error to restore original order
            loadCatalogue();
        }
    }

    // ==========================================
    // FORM HANDLERS
    // ==========================================

    function handleFormChange(e) {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setFormErrors(prev => ({ ...prev, [name]: '' }));
    }

    function validateForm() {
        const errors = {};
        if (!formData.questionText.trim()) {
            errors.questionText = t.errors.required;
        }
        if (formData.answerType === 'choices' && !formData.choices.trim()) {
            errors.choices = 'Veuillez entrer les choix (un par ligne)';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validateForm()) return;

        setSaving(true);
        try {
            const payload = {
                questionText: formData.questionText,
                answerType: formData.answerType,
                isRequired: formData.isRequired,
                isActive: formData.isActive,
                choices: formData.answerType === 'choices'
                    ? formData.choices.split('\n').filter(c => c.trim())
                    : null
            };

            if (editingQuestion) {
                const response = await catalogueService.updateQuestion(editingQuestion.id, payload);
                if (response.success) {
                    setQuestions(prev => prev.map(q =>
                        q.id === editingQuestion.id ? {
                            ...q,
                            question_text: payload.questionText,
                            answer_type: payload.answerType,
                            is_required: payload.isRequired,
                            is_active: payload.isActive,
                            choices: payload.choices,
                            // Verify camelCase properties are also updated/available if needed by other components
                            questionText: payload.questionText,
                            answerType: payload.answerType,
                            isRequired: payload.isRequired,
                            isActive: payload.isActive
                        } : q
                    ));
                    closeModal();
                }
            } else {
                const catalogueId = catalogue?.id || null;
                const response = await catalogueService.addQuestion(catalogueId, payload);
                if (response.success) {
                    if (response.data.catalogue) {
                        setCatalogue(response.data.catalogue);
                    }
                    setQuestions(prev => [...prev, response.data.question || response.data]);
                    closeModal();
                }
            }
        } catch (error) {
            console.error('Save question error:', error);
            setFormErrors({ general: error.message || t.errors.serverError });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(questionId) {
        const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer cette question ?');
        if (!confirmed) return;

        try {
            const response = await catalogueService.deleteQuestion(questionId);
            if (response.success) {
                setQuestions(prev => prev.filter(q => q.id !== questionId));
            }
        } catch (error) {
            console.error('Delete question error:', error);
        }
    }

    async function handlePublish() {
        const confirmed = await showConfirm('Publier ce catalogue ? Les cas existants garderont l\'ancienne version.');
        if (!confirmed) return;

        try {
            const response = await catalogueService.publish(catalogue.id);
            if (response.success) {
                setCatalogue(prev => ({ ...prev, is_published: true }));
                showSuccess(t.catalogue.published);
            }
        } catch (error) {
            console.error('Publish error:', error);
        }
    }

    function openAddModal() {
        setFormData({
            questionText: '',
            answerType: 'voice',
            isRequired: true,
            isActive: true,
            choices: ''
        });
        setFormErrors({});
        setEditingQuestion(null);
        setShowModal(true);
    }

    function openEditModal(question) {
        setFormData({
            questionText: question.question_text || question.questionText,
            answerType: question.answer_type || question.answerType,
            isRequired: question.is_required ?? question.isRequired ?? true,
            isActive: question.is_active ?? question.isActive ?? true,
            choices: question.choices ? question.choices.join('\n') : ''
        });
        setFormErrors({});
        setEditingQuestion(question);
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingQuestion(null);
        setFormData({
            questionText: '',
            answerType: 'voice',
            isRequired: true,
            isActive: true,
            choices: ''
        });
    }

    function getAnswerTypeLabel(type) {
        const labels = {
            yes_no: t.catalogue.yesNo,
            voice: t.catalogue.voice,
            choices: t.catalogue.choices
        };
        return labels[type] || type;
    }

    return (
        <div className="layout internal-shell catalogue-shell">
            <Sidebar />

            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t.catalogue.title}</h1>
                        <p style={{ margin: 0, fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Gérez les questions du questionnaire
                        </p>
                    </div>
                    <div className="flex gap-md">
                        {catalogue && !catalogue.is_published && (
                            <Button variant="success" onClick={handlePublish}>
                                <CheckIcon fontSize="small" /> {t.catalogue.publish}
                            </Button>
                        )}
                        <Button variant="primary" onClick={openAddModal}>
                            <AddIcon fontSize="small" /> {t.catalogue.addQuestion}
                        </Button>
                    </div>
                </div>

                <div className="page-content">
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : (
                        <>
                            {/* Catalogue info */}
                            {catalogue && (
                                <div className="card toolbar-shell" style={{ marginBottom: 'var(--space-lg)' }}>
                                    <div className="card-body flex justify-between items-center">
                                        <div>
                                            <strong>{t.catalogue.version}:</strong> {catalogue.version}
                                        </div>
                                        <span className={`badge ${catalogue.is_published ? 'badge-success' : 'badge-warning'}`}>
                                            {catalogue.is_published ? 'Publié' : 'Brouillon'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Drag and drop hint */}
                            {questions.length > 1 && (
                                <div className="drag-hint">
                                    <span className="drag-hint-icon"><DragIndicatorIcon /></span>
                                    <span>Glissez-déposez les lignes pour réorganiser les questions</span>
                                </div>
                            )}

                            {/* Questions list with drag and drop */}
                            {questions.length > 0 ? (
                                <div className="card">
                                    {/* Desktop Table view */}
                                    <div className="table-container desktop-table-container">
                                        <table className="table drag-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '50px' }}>#</th>
                                                    <th>Question</th>
                                                    <th style={{ width: '18%' }}>{t.catalogue.answerType}</th>
                                                    <th style={{ width: '10%' }}>{t.common.status}</th>
                                                    <th className="col-actions" style={{ width: '100px', textAlign: 'right' }}>{t.common.actions}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {questions.map((question, index) => (
                                                    <tr
                                                        key={question.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, index)}
                                                        onDragEnd={handleDragEnd}
                                                        onDragOver={(e) => handleDragOver(e, index)}
                                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, index)}
                                                        className={`
                                                            drag-row
                                                            ${draggedItem === index ? 'dragging' : ''}
                                                            ${dragOverItem === index ? 'drag-over' : ''}
                                                            ${dragOverItem === index && draggedItem !== null && draggedItem < index ? 'drag-over-bottom' : ''}
                                                            ${dragOverItem === index && draggedItem !== null && draggedItem > index ? 'drag-over-top' : ''}
                                                        `}
                                                    >
                                                        <td data-label="#" className="drag-handle-cell">
                                                            <div className="drag-handle" title="Glisser pour réordonner">
                                                                <span className="drag-icon"><DragIndicatorIcon fontSize="small" /></span>
                                                                <span className="question-number">{index + 1}</span>
                                                            </div>
                                                        </td>
                                                        <td data-label="Question" className="col-truncate" title={question.question_text || question.questionText}>
                                                            {question.question_text || question.questionText}
                                                            {(question.is_required ?? question.isRequired) && (
                                                                <span style={{ color: 'var(--error)', marginLeft: '4px' }}>*</span>
                                                            )}
                                                        </td>
                                                        <td data-label={t.catalogue.answerType}>{getAnswerTypeLabel(question.answer_type || question.answerType)}</td>
                                                        <td data-label={t.common.status}>
                                                            <span className={`badge ${(question.is_active ?? question.isActive) ? 'badge-success' : 'badge-gray'}`}>
                                                                {(question.is_active ?? question.isActive) ? 'Actif' : 'Inactif'}
                                                            </span>
                                                        </td>
                                                        <td data-label={t.common.actions} className="col-actions text-right">
                                                            <div className="flex gap-sm justify-end">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="btn-icon"
                                                                    onClick={() => openEditModal(question)}
                                                                    title="Modifier"
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="btn-icon"
                                                                    onClick={() => handleDelete(question.id)}
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
                                    </div>

                                    {/* Mobile List View */}
                                    <div className="mobile-list-container" style={{ padding: 'var(--space-md)' }}>
                                        {questions.map((question, index) => (
                                            <div
                                                key={`mob-${question.id}`}
                                                className={`mobile-list-item drag-row ${draggedItem === index ? 'dragging' : ''} ${dragOverItem === index ? 'drag-over' : ''}`}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnter={(e) => handleDragEnter(e, index)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, index)}
                                            >
                                                <div className="mobile-list-header" style={{ cursor: 'grab', paddingBottom: 'var(--space-sm)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)', minWidth: 0, width: '100%' }}>
                                                        <div className="drag-handle" style={{ padding: '4px', cursor: 'grab', color: 'var(--text-muted)' }}>
                                                            <DragIndicatorIcon fontSize="small" />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                                                <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                    <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>#{index + 1}</span>
                                                                    {question.question_text || question.questionText}
                                                                    {(question.is_required ?? question.isRequired) && <span style={{ color: 'var(--error)', marginLeft: '4px' }}>*</span>}
                                                                </p>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                    {getAnswerTypeLabel(question.answer_type || question.answerType)}
                                                                </span>
                                                                <span style={{ color: 'var(--border-color)' }}>•</span>
                                                                <span className={`badge ${(question.is_active ?? question.isActive) ? 'badge-success' : 'badge-gray'}`} style={{ transform: 'scale(0.8)', transformOrigin: 'left' }}>
                                                                    {(question.is_active ?? question.isActive) ? 'Actif' : 'Inactif'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mobile-list-content" style={{ display: 'flex', gap: 'var(--space-sm)', paddingTop: 'var(--space-md)' }}>
                                                    <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => openEditModal(question)}>
                                                        <EditIcon fontSize="small" style={{ marginRight: '4px' }} /> Modifier
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleDelete(question.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="card">
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
                                            {t.catalogue.noQuestions}
                                        </div>
                                        <div style={{ fontSize: '0.813rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                                            Ajoutez votre première question pour démarrer
                                        </div>
                                        <Button variant="primary" size="sm" onClick={openAddModal}>
                                            <AddIcon fontSize="small" /> {t.catalogue.addQuestion}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Add/Edit Question Modal */}
                <Modal
                    isOpen={showModal}
                    onClose={closeModal}
                    title={editingQuestion ? t.catalogue.editQuestion : t.catalogue.addQuestion}
                    footer={
                        <>
                            <Button variant="secondary" onClick={closeModal}>
                                {t.common.cancel}
                            </Button>
                            <Button variant="primary" onClick={handleSubmit} loading={saving}>
                                {t.common.save}
                            </Button>
                        </>
                    }
                >
                    {formErrors.general && (
                        <div className="alert alert-error">{formErrors.general}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">{t.catalogue.questionText} *</label>
                            <textarea
                                name="questionText"
                                value={formData.questionText}
                                onChange={handleFormChange}
                                className={`form-input ${formErrors.questionText ? 'error' : ''}`}
                                rows="3"
                                placeholder="Entrez votre question..."
                            />
                            {formErrors.questionText && (
                                <span className="form-error">{formErrors.questionText}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t.catalogue.answerType}</label>
                            <select
                                name="answerType"
                                value={formData.answerType}
                                onChange={handleFormChange}
                                className="form-input form-select"
                            >
                                <option value="voice">{t.catalogue.voice}</option>
                                <option value="yes_no">{t.catalogue.yesNo}</option>
                                <option value="choices">{t.catalogue.choices}</option>
                            </select>
                        </div>

                        {formData.answerType === 'choices' && (
                            <div className="form-group">
                                <label className="form-label">Choix (un par ligne) *</label>
                                <textarea
                                    name="choices"
                                    value={formData.choices}
                                    onChange={handleFormChange}
                                    className={`form-input ${formErrors.choices ? 'error' : ''}`}
                                    rows="4"
                                    placeholder="Choix 1&#10;Choix 2&#10;Choix 3"
                                />
                                {formErrors.choices && (
                                    <span className="form-error">{formErrors.choices}</span>
                                )}
                            </div>
                        )}

                        <div className="flex gap-lg">
                            <label className="flex items-center gap-sm">
                                <input
                                    type="checkbox"
                                    name="isRequired"
                                    checked={formData.isRequired}
                                    onChange={handleFormChange}
                                />
                                {t.catalogue.required}
                            </label>

                            <label className="flex items-center gap-sm">
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleFormChange}
                                />
                                {t.catalogue.active}
                            </label>
                        </div>
                    </form>
                </Modal>
            </main>
        </div>
    );
}

export default CatalogueManagement;
