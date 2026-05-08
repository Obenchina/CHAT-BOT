/**
 * ManualCurveEntryModal
 *
 * Lets the doctor enter or edit growth-curve data by typing percentile/SD values
 * into a table directly. Used as a fallback when AI extraction is rejected, or
 * to digitize a chart from a paper book.
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { showError, showSuccess } from '../../../utils/toast';
import doctorService from '../../../services/doctorService';

const FAMILIES = {
    percentile: { label: 'Percentiles (P3..P97)', keys: ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'] },
    sd: { label: 'Écarts-types (M-3SD..M+3SD)', keys: ['M-3SD', 'M-2SD', 'M-1SD', 'M', 'M+1SD', 'M+2SD', 'M+3SD'] },
};

const MEASURE_OPTIONS = [
    { value: 'height', label: 'Taille (cm)', unit: 'cm' },
    { value: 'weight', label: 'Poids (kg)', unit: 'kg' },
    { value: 'head', label: 'Périmètre crânien (cm)', unit: 'cm' },
    { value: 'bmi', label: 'IMC (kg/m²)', unit: 'kg/m²' },
];

function buildEmptyRows(numAges, family) {
    const keys = FAMILIES[family].keys;
    return Array.from({ length: numAges }, () => {
        const row = { age: '' };
        for (const k of keys) row[k] = '';
        return row;
    });
}

function ManualCurveEntryModal({ isOpen, onClose, onSaved, initialCurve = null }) {
    const isEdit = Boolean(initialCurve?.id);
    const [label, setLabel] = useState('');
    const [source, setSource] = useState('Saisie manuelle');
    const [measure, setMeasure] = useState('height');
    const [gender, setGender] = useState('male');
    const [family, setFamily] = useState('percentile');
    const [rows, setRows] = useState(() => buildEmptyRows(10, 'percentile'));
    const [submitting, setSubmitting] = useState(false);

    // Preset rows from existing curve when editing.
    // We do this asynchronously (queueMicrotask) to avoid synchronous setState
    // inside the effect body (which the lint rule flags as cascading renders).
    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            if (initialCurve?.curve_data?.panels?.[0]) {
                const p = initialCurve.curve_data.panels[0];
                const keys = Object.keys(p.percentiles || {});
                const fam = keys.some((k) => FAMILIES.sd.keys.includes(k)) ? 'sd' : 'percentile';
                setFamily(fam);
                setMeasure(p.measure || initialCurve.measure_key || 'height');
                setGender(initialCurve.gender || 'male');
                setLabel(initialCurve.label || '');
                setSource(initialCurve.curve_data?.source || 'Saisie manuelle');
                const ages = p.ages || [];
                const newRows = ages.map((age, i) => {
                    const row = { age: age != null ? String(age) : '' };
                    for (const k of FAMILIES[fam].keys) {
                        const v = p.percentiles?.[k]?.[i];
                        row[k] = v != null && Number.isFinite(Number(v)) ? String(v) : '';
                    }
                    return row;
                });
                setRows(newRows.length ? newRows : buildEmptyRows(10, fam));
            } else {
                setLabel('');
                setSource('Saisie manuelle');
                setMeasure('height');
                setGender('male');
                setFamily('percentile');
                setRows(buildEmptyRows(10, 'percentile'));
            }
        });
        return () => { cancelled = true; };
    }, [isOpen, initialCurve]);

    const keys = FAMILIES[family].keys;

    function updateCell(rowIdx, key, value) {
        setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row)));
    }

    function changeFamily(newFam) {
        setFamily(newFam);
        // Reset rows to empty for new family but keep age column
        setRows((r) => r.map((row) => {
            const keep = { age: row.age };
            for (const k of FAMILIES[newFam].keys) keep[k] = '';
            return keep;
        }));
    }

    function addRow() {
        setRows((r) => [...r, { age: '', ...Object.fromEntries(keys.map((k) => [k, ''])) }]);
    }
    function removeRow(idx) {
        setRows((r) => r.filter((_, i) => i !== idx));
    }

    async function handleSubmit() {
        const measureMeta = MEASURE_OPTIONS.find((m) => m.value === measure);
        const ages = rows.map((r) => Number(r.age)).filter((n) => Number.isFinite(n));
        if (ages.length < 3) {
            showError('Renseignez au moins 3 âges');
            return;
        }
        const percentiles = {};
        for (const k of keys) {
            percentiles[k] = rows.map((r) => {
                const v = r[k];
                if (v === '' || v == null) return null;
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            });
        }
        const cleanRows = rows.filter((r) => Number.isFinite(Number(r.age)));
        const cleanAges = cleanRows.map((r) => Number(r.age));
        const cleanPercentiles = {};
        for (const k of keys) {
            cleanPercentiles[k] = cleanRows.map((r) => {
                const v = r[k];
                if (v === '' || v == null) return null;
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            });
        }
        const ageMin = Math.min(...cleanAges);
        const ageMax = Math.max(...cleanAges);

        const payload = {
            label,
            source,
            measure,
            gender,
            isComposite: false,
            ageRange: { min: ageMin, max: ageMax },
            panels: [
                {
                    measure,
                    unit: measureMeta?.unit || '',
                    ages: cleanAges,
                    percentiles: cleanPercentiles,
                },
            ],
        };

        setSubmitting(true);
        try {
            const res = isEdit
                ? await doctorService.updateGrowthCurveData(initialCurve.id, payload)
                : await doctorService.createManualGrowthCurve(payload);
            if (res?.success) {
                const v = res.data?.validation;
                if (v && !v.ok) {
                    showError(`Validation: ${v.errors.slice(0, 2).join(' • ')}`);
                } else {
                    showSuccess(isEdit ? 'Courbe mise à jour' : 'Courbe créée');
                }
                onSaved?.(res.data);
                onClose?.();
            } else {
                showError(res?.message || 'Échec de l\'enregistrement');
            }
        } catch (e) {
            showError(e?.response?.data?.message || e?.message || 'Erreur');
        }
        setSubmitting(false);
    }

    const cellStyle = useMemo(() => ({
        width: 80, padding: '4px 6px', border: '1px solid #e5e7eb', fontSize: 12,
    }), []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Modifier les valeurs' : 'Saisie manuelle d\'une courbe'} size="xl">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <label style={{ fontSize: 13 }}>
                    Libellé
                    <input className="input-field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Taille filles AFPA 1-18" />
                </label>
                <label style={{ fontSize: 13 }}>
                    Source
                    <input className="input-field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex: AFPA-CRESS-Inserm 2018" />
                </label>
                <label style={{ fontSize: 13 }}>
                    Mesure
                    <select className="input-field" value={measure} onChange={(e) => setMeasure(e.target.value)}>
                        {MEASURE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </label>
                <label style={{ fontSize: 13 }}>
                    Sexe
                    <select className="input-field" value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="male">Garçon</option>
                        <option value="female">Fille</option>
                    </select>
                </label>
                <label style={{ fontSize: 13 }}>
                    Type de lignes
                    <select className="input-field" value={family} onChange={(e) => changeFamily(e.target.value)}>
                        <option value="percentile">{FAMILIES.percentile.label}</option>
                        <option value="sd">{FAMILIES.sd.label}</option>
                    </select>
                </label>
            </div>

            <div style={{ overflow: 'auto', maxHeight: 380, border: '1px solid #e5e7eb' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                        <tr>
                            <th style={cellStyle}>Âge (mois)</th>
                            {keys.map((k) => <th key={k} style={cellStyle}>{k}</th>)}
                            <th style={{ ...cellStyle, width: 30 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i}>
                                <td style={cellStyle}>
                                    <input style={{ width: '100%', border: 'none', fontSize: 12 }} value={row.age} onChange={(e) => updateCell(i, 'age', e.target.value)} />
                                </td>
                                {keys.map((k) => (
                                    <td key={k} style={cellStyle}>
                                        <input style={{ width: '100%', border: 'none', fontSize: 12 }} value={row[k]} onChange={(e) => updateCell(i, k, e.target.value)} />
                                    </td>
                                ))}
                                <td style={{ ...cellStyle, width: 30, textAlign: 'center' }}>
                                    <button onClick={() => removeRow(i)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}>×</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <Button size="sm" variant="ghost" onClick={addRow}>+ Ajouter une ligne</Button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Enregistrement…' : (isEdit ? 'Mettre à jour' : 'Enregistrer')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default ManualCurveEntryModal;
