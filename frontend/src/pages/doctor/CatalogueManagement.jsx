/**
 * Catalogue Management Page
 * Doctor manages multiple named catalogues and their questions
 */

import { Fragment, useEffect, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import catalogueService from '../../services/catalogueService';
import translations from '../../constants/translations';
import { CLINICAL_MEASURE_LABELS } from '../../constants/config';
import { showConfirm, showError, showSuccess } from '../../utils/toast';
import '../../styles/dragdrop.css';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddIcon from '@mui/icons-material/Add';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

const t = translations;

function CatalogueManagement() {
    const [catalogues, setCatalogues] = useState([]);
    const [selectedCatalogueId, setSelectedCatalogueId] = useState(null);
    const [catalogue, setCatalogue] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);

    const [showCatalogueModal, setShowCatalogueModal] = useState(false);
    const [editingCatalogue, setEditingCatalogue] = useState(null);
    const [savingCatalogue, setSavingCatalogue] = useState(false);
    const [catalogueFormData, setCatalogueFormData] = useState({ name: '', isActive: true });
    const [catalogueFormErrors, setCatalogueFormErrors] = useState({});

    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [savingQuestion, setSavingQuestion] = useState(false);
    const [formData, setFormData] = useState({
        questionText: '',
        answerType: 'voice',
        isRequired: true,
        isActive: true,
        choices: '',
        clinicalMeasure: 'none',
        sectionName: '',
        sectionOrder: 0
    });
    const [formErrors, setFormErrors] = useState({});

    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverItem, setDragOverItem] = useState(null);
    const [, setIsDragging] = useState(false);

    useEffect(() => {
        loadCatalogues();
    }, []);

    useEffect(() => {
        if (selectedCatalogueId) {
            loadSelectedCatalogue(selectedCatalogueId);
        } else {
            setCatalogue(null);
            setQuestions([]);
        }
    }, [selectedCatalogueId]);

    async function loadCatalogues(preferredId = null) {
        try {
            const response = await catalogueService.getCatalogues();
            if (response.success) {
                const nextCatalogues = response.data.catalogues || [];
                setCatalogues(nextCatalogues);
                setSelectedCatalogueId((currentSelected) => {
                    const requestedId = preferredId ?? currentSelected;
                    if (requestedId && nextCatalogues.some((item) => item.id === requestedId)) {
                        return requestedId;
                    }
                    return nextCatalogues[0]?.id || null;
                });
            }
        } catch (error) {
            console.error('Load catalogues error:', error);
            showError(error.message || t.errors.serverError);
        } finally {
            setLoading(false);
        }
    }

    async function loadSelectedCatalogue(catalogueId) {
        setDetailLoading(true);
        try {
            const response = await catalogueService.getCatalogue(catalogueId);
            if (response.success) {
                setCatalogue(response.data.catalogue);
                setQuestions(response.data.questions || []);
            }
        } catch (error) {
            console.error('Load selected catalogue error:', error);
            showError(error.message || t.errors.serverError);
        } finally {
            setDetailLoading(false);
        }
    }

    async function refreshSelectedCatalogue(catalogueId) {
        await loadCatalogues(catalogueId);
        if (catalogueId) {
            await loadSelectedCatalogue(catalogueId);
        }
    }

    function handleCatalogueFormChange(e) {
        const { name, value, type, checked } = e.target;
        setCatalogueFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setCatalogueFormErrors((prev) => ({ ...prev, [name]: '' }));
    }

    function validateCatalogueForm() {
        const errors = {};
        if (!catalogueFormData.name.trim()) {
            errors.name = t.errors.required;
        }
        setCatalogueFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    function openCreateCatalogueModal() {
        setEditingCatalogue(null);
        setCatalogueFormData({ name: '', isActive: true });
        setCatalogueFormErrors({});
        setShowCatalogueModal(true);
    }

    function toggleCatalogueRow(catalogueId) {
        setSelectedCatalogueId((currentSelected) => (currentSelected === catalogueId ? null : catalogueId));
    }

    function openEditCatalogueModal(catalogueItem = catalogue) {
        if (!catalogueItem) return;
        setEditingCatalogue(catalogueItem);
        setCatalogueFormData({
            name: catalogueItem.name || '',
            isActive: Boolean(catalogueItem.is_active)
        });
        setCatalogueFormErrors({});
        setShowCatalogueModal(true);
    }

    function closeCatalogueModal() {
        setShowCatalogueModal(false);
        setEditingCatalogue(null);
        setCatalogueFormData({ name: '', isActive: true });
        setCatalogueFormErrors({});
    }

    async function handleCatalogueSubmit(e) {
        e.preventDefault();
        if (!validateCatalogueForm()) return;

        setSavingCatalogue(true);
        try {
            if (editingCatalogue) {
                const response = await catalogueService.updateCatalogue(editingCatalogue.id, {
                    name: catalogueFormData.name,
                    isActive: catalogueFormData.isActive
                });
                if (response.success) {
                    showSuccess('Catalogue mis a jour avec succes');
                    await refreshSelectedCatalogue(editingCatalogue.id);
                    closeCatalogueModal();
                }
            } else {
                const response = await catalogueService.createCatalogue({
                    name: catalogueFormData.name,
                    isActive: catalogueFormData.isActive
                });
                if (response.success) {
                    showSuccess('Catalogue cree avec succes');
                    await loadCatalogues(response.data.id);
                    closeCatalogueModal();
                }
            }
        } catch (error) {
            console.error('Save catalogue error:', error);
            setCatalogueFormErrors({ general: error.message || t.errors.serverError });
        } finally {
            setSavingCatalogue(false);
        }
    }

    async function handleToggleCatalogueStatus(catalogueItem = catalogue) {
        if (!catalogueItem) return;

        try {
            const response = await catalogueService.updateCatalogue(catalogueItem.id, {
                isActive: !catalogueItem.is_active
            });

            if (response.success) {
                showSuccess(catalogueItem.is_active ? 'Catalogue desactive' : 'Catalogue active');

                if (selectedCatalogueId === catalogueItem.id) {
                    await refreshSelectedCatalogue(catalogueItem.id);
                } else {
                    await loadCatalogues();
                }
            }
        } catch (error) {
            console.error('Toggle catalogue status error:', error);
            showError(error.message || t.errors.serverError);
        }
    }

    async function handleDeleteCatalogue(catalogueItem = catalogue) {
        if (!catalogueItem) return;

        const confirmed = await showConfirm(
            `Supprimer le catalogue "${catalogueItem.name}" ? Cette action est definitive.`
        );
        if (!confirmed) return;

        try {
            const response = await catalogueService.deleteCatalogue(catalogueItem.id);
            if (response.success) {
                showSuccess('Catalogue supprime avec succes');

                if (selectedCatalogueId === catalogueItem.id) {
                    setSelectedCatalogueId(null);
                    setCatalogue(null);
                    setQuestions([]);
                }

                await loadCatalogues();
            }
        } catch (error) {
            console.error('Delete catalogue error:', error);
            showError(error.message || t.errors.serverError);
        }
    }

    function handleDragStart(e, index) {
        setDraggedItem(index);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        e.currentTarget.classList.add('dragging');
    }

    function handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        setDraggedItem(null);
        setDragOverItem(null);
        setIsDragging(false);
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItem !== index) setDragOverItem(index);
    }

    function handleDragEnter(e, index) {
        e.preventDefault();
        if (draggedItem !== index) setDragOverItem(index);
    }

    function handleDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOverItem(null);
    }

    async function handleDrop(e, dropIndex) {
        e.preventDefault();

        const currentCatalogueId = catalogue?.id || selectedCatalogueId;
        if (!currentCatalogueId || draggedItem === null || draggedItem === dropIndex) {
            setDragOverItem(null);
            return;
        }

        const newQuestions = [...questions];
        const [removed] = newQuestions.splice(draggedItem, 1);
        newQuestions.splice(dropIndex, 0, removed);
        setQuestions(newQuestions);
        setDragOverItem(null);
        setDraggedItem(null);
        setIsDragging(false);

        try {
            const orderData = newQuestions.map((question, idx) => ({ id: question.id, orderIndex: idx + 1 }));
            await catalogueService.reorderQuestions(currentCatalogueId, orderData);
        } catch (error) {
            console.error('Reorder questions error:', error);
            showError(error.message || t.errors.serverError);
            await loadSelectedCatalogue(currentCatalogueId);
        }
    }

    function handleQuestionFormChange(e) {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => {
            const nextVal = type === 'checkbox' ? checked : value;
            const newData = { ...prev, [name]: nextVal };
            
            // Logic for clinicalMeasure and answerType
            if (name === 'clinicalMeasure' && nextVal !== 'none') {
                newData.answerType = 'number';
            }
            if (name === 'answerType' && nextVal !== 'number') {
                newData.clinicalMeasure = 'none';
            }
            return newData;
        });
        setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }

    function validateQuestionForm() {
        const errors = {};
        if (!formData.questionText.trim()) errors.questionText = t.errors.required;
        if (formData.answerType === 'choices' && !formData.choices.trim()) {
            errors.choices = 'Veuillez entrer les choix (un par ligne)';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    function openAddQuestionModal(catalogueItem = catalogue) {
        if (!catalogueItem) return;
        setEditingQuestion(null);
        setFormData({ questionText: '', answerType: 'voice', isRequired: true, isActive: true, choices: '', clinicalMeasure: 'none', sectionName: '', sectionOrder: 0 });
        setFormErrors({});
        setShowQuestionModal(true);
    }

    function openEditQuestionModal(question) {
        setEditingQuestion(question);
        
        let parsedChoices = '';
        if (question.choices) {
            if (typeof question.choices === 'string') {
                try {
                    parsedChoices = JSON.parse(question.choices).join('\n');
                } catch (e) {
                    parsedChoices = question.choices;
                }
            } else if (Array.isArray(question.choices)) {
                parsedChoices = question.choices.join('\n');
            }
        }

        setFormData({
            questionText: question.question_text || question.questionText,
            answerType: question.answer_type || question.answerType,
            isRequired: question.is_required ?? question.isRequired ?? true,
            isActive: question.is_active ?? question.isActive ?? true,
            choices: parsedChoices,
            clinicalMeasure: question.clinical_measure || question.clinicalMeasure || 'none',
            sectionName: question.section_name || question.sectionName || '',
            sectionOrder: question.section_order || question.sectionOrder || 0
        });
        setFormErrors({});
        setShowQuestionModal(true);
    }

    function closeQuestionModal() {
        setShowQuestionModal(false);
        setEditingQuestion(null);
        setFormData({ questionText: '', answerType: 'voice', isRequired: true, isActive: true, choices: '', clinicalMeasure: 'none', sectionName: '', sectionOrder: 0 });
        setFormErrors({});
    }

    async function handleQuestionSubmit(e) {
        e.preventDefault();
        if (!catalogue || !validateQuestionForm()) return;

        setSavingQuestion(true);
        try {
            const payload = {
                questionText: formData.questionText,
                answerType: formData.answerType,
                isRequired: formData.isRequired,
                isActive: formData.isActive,
                choices: formData.answerType === 'choices'
                    ? JSON.stringify(formData.choices.split('\n').map(c => c.trim()).filter(c => c))
                    : null,
                clinicalMeasure: formData.clinicalMeasure,
                sectionName: formData.sectionName,
                sectionOrder: formData.sectionOrder
            };

            if (editingQuestion) {
                const response = await catalogueService.updateQuestion(editingQuestion.id, payload);
                if (response.success) {
                    showSuccess('Question mise a jour');
                    await refreshSelectedCatalogue(catalogue.id);
                    closeQuestionModal();
                }
            } else {
                const response = await catalogueService.addQuestion(catalogue.id, payload);
                if (response.success) {
                    showSuccess('Question ajoutee');
                    await refreshSelectedCatalogue(catalogue.id);
                    closeQuestionModal();
                }
            }
        } catch (error) {
            console.error('Save question error:', error);
            setFormErrors({ general: error.message || t.errors.serverError });
        } finally {
            setSavingQuestion(false);
        }
    }

    async function handleToggleQuestionStatus(question) {
        if (!catalogue) return;

        const isQuestionActive = question.is_active ?? question.isActive;

        try {
            const response = await catalogueService.updateQuestion(question.id, {
                isActive: !isQuestionActive
            });

            if (response.success) {
                showSuccess(isQuestionActive ? 'Question desactivee' : 'Question activee');
                await refreshSelectedCatalogue(catalogue.id);
            }
        } catch (error) {
            console.error('Toggle question status error:', error);
            showError(error.message || t.errors.serverError);
        }
    }

    async function handleDeleteQuestion(questionId) {
        const confirmed = await showConfirm('Supprimer cette question ?');
        if (!confirmed || !catalogue) return;

        try {
            const response = await catalogueService.deleteQuestion(questionId);
            if (response.success) {
                showSuccess('Question supprimee');
                await refreshSelectedCatalogue(catalogue.id);
            }
        } catch (error) {
            console.error('Delete question error:', error);
            showError(error.message || t.errors.serverError);
        }
    }

    function getAnswerTypeLabel(type) {
        const labels = {
            yes_no: t.catalogue.yesNo,
            voice: t.catalogue.voice,
            choices: t.catalogue.choices,
            text_short: 'Texte court',
            text_long: 'Texte long',
            number: 'Nombre'
        };
        return labels[type] || type;
    }

    function renderQuestionActions(question) {
        const isQuestionActive = question.is_active ?? question.isActive;

        return (
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="btn-icon"
                    title={t.common.edit}
                    onClick={() => openEditQuestionModal(question)}
                >
                    <EditIcon fontSize="small" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="btn-icon"
                    title={isQuestionActive ? 'Desactiver la question' : 'Activer la question'}
                    onClick={() => handleToggleQuestionStatus(question)}
                >
                    {isQuestionActive ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="btn-icon"
                    title={t.common.delete}
                    style={{ color: 'var(--error)' }}
                    onClick={() => handleDeleteQuestion(question.id)}
                >
                    <DeleteIcon fontSize="small" />
                </Button>
            </div>
        );
    }

    function renderExpandedCatalogueContent() {
        if (detailLoading) {
            return (
                <div className="catalogue-expanded-loading">
                    <LoadingSpinner size="md" text={t.common.loading} />
                </div>
            );
        }

        return (
            <div className="catalogue-expanded-panel">
                <div className="catalogue-expanded-toolbar">
                    <Button variant="primary" onClick={() => openAddQuestionModal(catalogue)}>
                        <AddIcon fontSize="small" /> {t.catalogue.addQuestion}
                    </Button>
                </div>

                {questions.length > 1 && (
                    <div className="drag-hint">
                        <span className="drag-hint-icon">
                            <DragIndicatorIcon />
                        </span>
                        <span>Glissez-deposez les lignes pour reordonner les questions</span>
                    </div>
                )}

                {questions.length > 0 ? (
                    <>
                        <div className="table-container desktop-table-container">
                            <table className="table drag-table catalogue-question-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '64px' }}>#</th>
                                        <th>Question</th>
                                        <th style={{ width: '18%' }}>{t.catalogue.answerType}</th>
                                        <th style={{ width: '14%' }}>{t.common.status}</th>
                                        <th className="col-actions" style={{ width: '144px' }}>
                                            {t.common.actions}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {questions.map((question, index) => {
                                        const isQuestionActive = question.is_active ?? question.isActive;
                                        const questionText = question.question_text || question.questionText;
                                        const isRequired = question.is_required ?? question.isRequired;
                                        const sectionName = question.section_name || question.sectionName;
                                        const prevSectionName = index > 0 ? (questions[index - 1].section_name || questions[index - 1].sectionName) : null;
                                        const showSectionHeader = sectionName && sectionName !== prevSectionName;

                                        return (
                                            <Fragment key={question.id}>
                                                {showSectionHeader && (
                                                    <tr className="section-header-row" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                                                        <td colSpan="5" style={{ padding: 'var(--space-md) var(--space-md)', color: 'var(--primary)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)' }}>
                                                            📁 {sectionName}
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, index)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={(e) => handleDragOver(e, index)}
                                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, index)}
                                                    className={`drag-row ${draggedItem === index ? 'dragging' : ''} ${dragOverItem === index ? 'drag-over' : ''}`}
                                                >
                                                <td className="drag-handle-cell">
                                                    <div className="drag-handle" title="Glisser pour reordonner">
                                                        <span className="drag-icon">
                                                            <DragIndicatorIcon fontSize="small" />
                                                        </span>
                                                        <span className="question-number">{index + 1}</span>
                                                    </div>
                                                </td>
                                                <td className="col-truncate" title={questionText}>
                                                    {questionText}
                                                    {isRequired && <span style={{ color: 'var(--error)', marginLeft: '4px' }}>*</span>}
                                                </td>
                                                <td>{getAnswerTypeLabel(question.answer_type || question.answerType)}</td>
                                                <td>
                                                    <span className={`badge ${isQuestionActive ? 'badge-success' : 'badge-gray'}`}>
                                                        {isQuestionActive ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </td>
                                                <td className="col-actions">{renderQuestionActions(question)}</td>
                                                </tr>
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="mobile-list-container catalogue-question-mobile-list">
                            {questions.map((question, index) => {
                                        const isQuestionActive = question.is_active ?? question.isActive;
                                        const questionText = question.question_text || question.questionText;
                                        const isRequired = question.is_required ?? question.isRequired;
                                        const sectionName = question.section_name || question.sectionName;
                                        const prevSectionName = index > 0 ? (questions[index - 1].section_name || questions[index - 1].sectionName) : null;
                                        const showSectionHeader = sectionName && sectionName !== prevSectionName;

                                        return (
                                            <Fragment key={`mobile-question-${question.id}`}>
                                                {showSectionHeader && (
                                                    <div className="mobile-section-header" style={{ padding: 'var(--space-md)', backgroundColor: 'var(--bg-elevated)', color: 'var(--primary)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', borderTop: index > 0 ? '1px solid var(--border-color)' : 'none' }}>
                                                        📁 {sectionName}
                                                    </div>
                                                )}
                                                <div
                                                    className={`mobile-list-item catalogue-question-mobile-item ${draggedItem === index ? 'dragging' : ''} ${dragOverItem === index ? 'drag-over' : ''}`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, index)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={(e) => handleDragOver(e, index)}
                                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, index)}
                                                >
                                        <div className="catalogue-question-mobile-main">
                                            <div className="drag-handle" title="Glisser pour reordonner">
                                                <span className="drag-icon">
                                                    <DragIndicatorIcon fontSize="small" />
                                                </span>
                                                <span className="question-number">{index + 1}</span>
                                            </div>
                                            <div className="catalogue-question-mobile-copy">
                                                <p className="catalogue-question-mobile-text">
                                                    {questionText}
                                                    {isRequired && <span style={{ color: 'var(--error)', marginLeft: '4px' }}>*</span>}
                                                </p>
                                                <p className="catalogue-question-mobile-meta">
                                                    {getAnswerTypeLabel(question.answer_type || question.answerType)}
                                                </p>
                                            </div>
                                            <span className={`badge ${isQuestionActive ? 'badge-success' : 'badge-gray'}`}>
                                                {isQuestionActive ? 'Actif' : 'Inactif'}
                                            </span>
                                        </div>
                                        <div className="catalogue-question-mobile-actions">
                                            {renderQuestionActions(question)}
                                        </div>
                                                </div>
                                            </Fragment>
                                        );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="catalogue-empty-state">
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t.catalogue.noQuestions}</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="layout internal-shell catalogue-shell">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t.catalogue.title}</h1>
                        <p style={{ margin: 0, fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
                            Creez plusieurs catalogues et choisissez celui qui correspond a chaque visite.
                        </p>
                    </div>
                    <Button variant="primary" onClick={openCreateCatalogueModal}>
                        <AddIcon fontSize="small" /> Nouveau catalogue
                    </Button>
                </div>

                <div className="page-content">
                    {loading ? (
                        <div className="flex justify-center" style={{ padding: 'var(--space-2xl)' }}>
                            <LoadingSpinner size="lg" text={t.common.loading} />
                        </div>
                    ) : catalogues.length === 0 ? (
                        <div className="card empty-state-card" style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Aucun catalogue</h3>
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                Creez votre premier catalogue pour commencer.
                            </p>
                        </div>
                    ) : (
                        <div className="card catalogue-list-shell">
                            <div className="table-container desktop-table-container">
                                <table className="table catalogue-master-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '48px' }}></th>
                                            <th>Catalogue</th>
                                            <th style={{ width: '16%' }}>{t.common.status}</th>
                                            <th className="col-actions" style={{ width: '164px' }}>
                                                {t.common.actions}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {catalogues.map((item) => {
                                            const isExpanded = item.id === selectedCatalogueId;

                                            return (
                                                <Fragment key={`catalogue-group-${item.id}`}>
                                                    <tr
                                                        className={`catalogue-master-row ${isExpanded ? 'is-expanded' : ''}`}
                                                        onClick={() => toggleCatalogueRow(item.id)}
                                                    >
                                                        <td className="catalogue-expand-cell">
                                                            <KeyboardArrowRightIcon
                                                                className={`catalogue-chevron ${isExpanded ? 'is-open' : ''}`}
                                                                fontSize="small"
                                                            />
                                                        </td>
                                                        <td className="col-truncate" title={item.name}>
                                                            <span className="catalogue-name-cell">{item.name}</span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${item.is_active ? 'badge-success' : 'badge-gray'}`}>
                                                                {item.is_active ? 'Actif' : 'Desactive'}
                                                            </span>
                                                        </td>
                                                        <td className="col-actions">
                                                            <div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="btn-icon"
                                                                    title={t.common.edit}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditCatalogueModal(item);
                                                                    }}
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="btn-icon"
                                                                    title={item.is_active ? 'Desactiver le catalogue' : 'Activer le catalogue'}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleToggleCatalogueStatus(item);
                                                                    }}
                                                                >
                                                                    {item.is_active ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="btn-icon"
                                                                    title={t.common.delete}
                                                                    style={{ color: 'var(--error)' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteCatalogue(item);
                                                                    }}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {isExpanded && (
                                                        <tr className="catalogue-expanded-row">
                                                            <td colSpan={4}>{renderExpandedCatalogueContent()}</td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mobile-list-container catalogue-mobile-list">
                                {catalogues.map((item) => {
                                    const isExpanded = item.id === selectedCatalogueId;

                                    return (
                                        <div key={`mobile-catalogue-${item.id}`} className="mobile-list-item catalogue-mobile-item">
                                            <button
                                                type="button"
                                                className="mobile-list-header catalogue-mobile-header"
                                                onClick={() => toggleCatalogueRow(item.id)}
                                            >
                                                <div className="catalogue-mobile-header-copy">
                                                    <p className="catalogue-mobile-name">{item.name}</p>
                                                </div>
                                                <div className="catalogue-mobile-header-meta">
                                                    <span className={`badge ${item.is_active ? 'badge-success' : 'badge-gray'}`}>
                                                        {item.is_active ? 'Actif' : 'Desactive'}
                                                    </span>
                                                    <KeyboardArrowRightIcon
                                                        className={`catalogue-chevron ${isExpanded ? 'is-open' : ''}`}
                                                        fontSize="small"
                                                    />
                                                </div>
                                            </button>

                                            <div className="catalogue-mobile-actions">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="btn-icon"
                                                    title={t.common.edit}
                                                    onClick={() => openEditCatalogueModal(item)}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="btn-icon"
                                                    title={item.is_active ? 'Desactiver le catalogue' : 'Activer le catalogue'}
                                                    onClick={() => handleToggleCatalogueStatus(item)}
                                                >
                                                    {item.is_active ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="btn-icon"
                                                    title={t.common.delete}
                                                    style={{ color: 'var(--error)' }}
                                                    onClick={() => handleDeleteCatalogue(item)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </Button>
                                            </div>

                                            {isExpanded && (
                                                <div className="mobile-list-content catalogue-mobile-content">
                                                    {renderExpandedCatalogueContent()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Modal
                isOpen={showCatalogueModal}
                onClose={closeCatalogueModal}
                title={editingCatalogue ? 'Modifier le catalogue' : 'Nouveau catalogue'}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeCatalogueModal}>{t.common.cancel}</Button>
                        <Button variant="primary" onClick={handleCatalogueSubmit} loading={savingCatalogue}>{t.common.save}</Button>
                    </>
                }
            >
                {catalogueFormErrors.general && <div className="alert alert-error">{catalogueFormErrors.general}</div>}
                <form onSubmit={handleCatalogueSubmit}>
                    <div className="form-group">
                        <label className="form-label">Nom du catalogue *</label>
                        <input
                            type="text"
                            name="name"
                            value={catalogueFormData.name}
                            onChange={handleCatalogueFormChange}
                            className={`form-input ${catalogueFormErrors.name ? 'error' : ''}`}
                            placeholder="Ex: Suivi diabete"
                        />
                        {catalogueFormErrors.name && <span className="form-error">{catalogueFormErrors.name}</span>}
                    </div>
                    <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" name="isActive" checked={catalogueFormData.isActive} onChange={handleCatalogueFormChange} />
                        Catalogue visible pour l'assistant
                    </label>
                </form>
            </Modal>

            <Modal
                isOpen={showQuestionModal}
                onClose={closeQuestionModal}
                title={editingQuestion ? t.catalogue.editQuestion : t.catalogue.addQuestion}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeQuestionModal}>{t.common.cancel}</Button>
                        <Button variant="primary" onClick={handleQuestionSubmit} loading={savingQuestion}>{t.common.save}</Button>
                    </>
                }
            >
                {formErrors.general && <div className="alert alert-error">{formErrors.general}</div>}
                <form onSubmit={handleQuestionSubmit}>
                    <div className="form-group">
                        <label className="form-label">{t.catalogue.questionText} *</label>
                        <textarea
                            name="questionText"
                            value={formData.questionText}
                            onChange={handleQuestionFormChange}
                            className={`form-input ${formErrors.questionText ? 'error' : ''}`}
                            rows={3}
                            placeholder="Entrez votre question..."
                        />
                        {formErrors.questionText && <span className="form-error">{formErrors.questionText}</span>}
                    </div>

                    <div className="form-group" style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        <div style={{ flex: 1 }}>
                            <label className="form-label">Nom de la section (optionnel)</label>
                            <input
                                type="text"
                                name="sectionName"
                                value={formData.sectionName}
                                onChange={handleQuestionFormChange}
                                className="form-input"
                                placeholder="ex: Antécédents"
                            />
                        </div>
                        <div style={{ width: '120px' }}>
                            <label className="form-label">Ordre (Section)</label>
                            <input
                                type="number"
                                name="sectionOrder"
                                value={formData.sectionOrder}
                                onChange={handleQuestionFormChange}
                                className="form-input"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t.catalogue.answerType}</label>
                        <select name="answerType" value={formData.answerType} onChange={handleQuestionFormChange} className="form-input form-select" disabled={formData.clinicalMeasure !== 'none'}>
                            <option value="voice">{t.catalogue.voice}</option>
                            <option value="yes_no">{t.catalogue.yesNo}</option>
                            <option value="choices">{t.catalogue.choices}</option>
                            <option value="text_short">Texte court</option>
                            <option value="text_long">Texte long</option>
                            <option value="number">Nombre</option>
                        </select>
                        {formData.clinicalMeasure !== 'none' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Le type de réponse est forcé à "Nombre" pour une mesure clinique.</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Mesure clinique associée</label>
                        <select name="clinicalMeasure" value={formData.clinicalMeasure} onChange={handleQuestionFormChange} className="form-input form-select">
                            {Object.entries(CLINICAL_MEASURE_LABELS).map(([key, item]) => (
                                <option key={key} value={key}>
                                    {item.label} {item.unit ? `(${item.unit})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {formData.answerType === 'choices' && (
                        <div className="form-group">
                            <label className="form-label">Choix (un par ligne)</label>
                            <textarea
                                name="choices"
                                value={formData.choices}
                                onChange={handleQuestionFormChange}
                                className={`form-input ${formErrors.choices ? 'error' : ''}`}
                                rows={4}
                                placeholder={'Option 1\nOption 2\nOption 3'}
                            />
                            {formErrors.choices && <span className="form-error">{formErrors.choices}</span>}
                        </div>
                    )}

                    <div className="flex gap-md" style={{ marginTop: 'var(--space-md)' }}>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" name="isRequired" checked={formData.isRequired} onChange={handleQuestionFormChange} />
                            {t.catalogue.required}
                        </label>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleQuestionFormChange} />
                            {t.catalogue.active}
                        </label>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default CatalogueManagement;
