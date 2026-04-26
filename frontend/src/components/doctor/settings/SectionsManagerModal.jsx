import { useEffect, useMemo, useState } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { showConfirm, showError, showSuccess } from '../../../utils/toast';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function SectionsManagerModal({
    isOpen,
    onClose,
    catalogueId,
    sections,
    loading,
    catalogueService,
    onChanged
}) {
    const [creatingName, setCreatingName] = useState('');
    const [saving, setSaving] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renamingSection, setRenamingSection] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    const normalizedSections = useMemo(() => {
        const list = Array.isArray(sections) ? [...sections] : [];
        list.sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0));
        return list;
    }, [sections]);

    useEffect(() => {
        if (!isOpen) {
            setCreatingName('');
            setDraggedIndex(null);
            setDragOverIndex(null);
            setRenameModalOpen(false);
            setRenamingSection(null);
            setRenameValue('');
        }
    }, [isOpen]);

    async function createSection() {
        const name = creatingName.trim();
        if (!name) {
            showError('Nom de section requis');
            return;
        }
        setSaving(true);
        try {
            const res = await catalogueService.createSection(catalogueId, name);
            if (res.success) {
                showSuccess('Section créée');
                setCreatingName('');
                await onChanged?.();
            } else {
                showError(res.message || 'Erreur');
            }
        } catch (e) {
            console.error('createSection error:', e);
            showError(e?.response?.data?.message || e?.message || 'Erreur de connexion');
        } finally {
            setSaving(false);
        }
    }

    function openRename(section) {
        setRenamingSection(section);
        setRenameValue(section?.name || '');
        setRenameModalOpen(true);
    }

    function closeRename() {
        if (saving) return;
        setRenameModalOpen(false);
        setRenamingSection(null);
        setRenameValue('');
    }

    async function submitRename() {
        const section = renamingSection;
        const name = String(renameValue || '').trim();
        if (!section) return;
        if (!name) return showError('Nom de section requis');
        setSaving(true);
        try {
            const res = await catalogueService.renameSection(catalogueId, section.id, name);
            if (res.success) {
                showSuccess('Section renommée');
                closeRename();
                await onChanged?.();
            } else {
                showError(res.message || 'Erreur');
            }
        } catch (e) {
            console.error('renameSection error:', e);
            showError(e?.response?.data?.message || e?.message || 'Erreur de connexion');
        } finally {
            setSaving(false);
        }
    }

    async function deleteSection(section) {
        const confirmed = await showConfirm(`Supprimer la section "${section?.name}" ? Les questions seront déplacées vers "بدون قسم".`);
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await catalogueService.deleteSection(catalogueId, section.id);
            if (res.success) {
                showSuccess('Section supprimée');
                await onChanged?.();
            } else {
                showError(res.message || 'Erreur');
            }
        } catch (e) {
            console.error('deleteSection error:', e);
            showError(e?.response?.data?.message || e?.message || 'Erreur de connexion');
        } finally {
            setSaving(false);
        }
    }

    function handleDragStart(e, index) {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        if (draggedIndex !== index) setDragOverIndex(index);
    }

    function handleDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIndex(null);
    }

    async function handleDrop(e, dropIndex) {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;
        const list = [...normalizedSections];
        const [moved] = list.splice(draggedIndex, 1);
        list.splice(dropIndex, 0, moved);

        // Reassign orders (1..N)
        const order = list.map((s, idx) => ({ id: s.id, sectionOrder: idx + 1 }));

        setSaving(true);
        try {
            const res = await catalogueService.reorderSections(catalogueId, order);
            if (res.success) {
                showSuccess('Sections réordonnées');
                await onChanged?.();
            } else {
                showError(res.message || 'Erreur');
            }
        } catch (e2) {
            console.error('reorderSections error:', e2);
            showError(e2?.response?.data?.message || e2?.message || 'Erreur de connexion');
        } finally {
            setSaving(false);
            setDraggedIndex(null);
            setDragOverIndex(null);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => (saving ? null : onClose())}
            title="Gestion des sections"
            footer={(
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Fermer</Button>
                </div>
            )}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input
                        className="form-input"
                        placeholder="Nom de section (ex: Antécédents)"
                        value={creatingName}
                        onChange={(e) => setCreatingName(e.target.value)}
                        disabled={saving}
                    />
                    <Button variant="primary" onClick={createSection} loading={saving} disabled={!catalogueId}>
                        Ajouter
                    </Button>
                </div>

                {loading ? (
                    <div style={{ color: 'var(--text-secondary)' }}>Chargement…</div>
                ) : normalizedSections.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>
                        Aucune section. Créez-en une, puis déplacez vos questions dedans.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {normalizedSections.map((s, idx) => (
                            <div
                                key={s.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 'var(--space-sm)',
                                    padding: '10px 12px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    background: dragOverIndex === idx ? 'var(--primary-50)' : 'var(--bg-card)',
                                    cursor: 'grab'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <span style={{ color: 'var(--text-muted)' }} title="Glisser pour réordonner">
                                        <DragIndicatorIcon fontSize="small" />
                                    </span>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {s.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {Number(s.question_count || 0)} question(s)
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openRename(s)} disabled={saving}>
                                        <EditIcon fontSize="small" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="btn-icon" style={{ color: 'var(--error)' }} onClick={() => deleteSection(s)} disabled={saving}>
                                        <DeleteIcon fontSize="small" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={renameModalOpen}
                onClose={closeRename}
                title="Renommer la section"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
                        <Button variant="secondary" onClick={closeRename} disabled={saving}>Annuler</Button>
                        <Button variant="primary" onClick={submitRename} loading={saving}>Enregistrer</Button>
                    </div>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Ancien nom: <b>{renamingSection?.name || '—'}</b>
                    </div>
                    <input
                        className="form-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="Nouveau nom"
                        disabled={saving}
                    />
                </div>
            </Modal>
        </Modal>
    );
}

export default SectionsManagerModal;

