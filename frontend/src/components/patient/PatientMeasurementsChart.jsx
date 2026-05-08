/**
 * PatientMeasurementsChart
 *
 * Renders a single clinical measure (or a composite weight+height view) for a
 * patient against a growth curve from the doctor's bank. The chart is fully
 * deterministic — patient points are drawn on the same Recharts coordinate
 * system as the percentile lines (no background image overlay).
 */
import { useEffect, useMemo, useState } from 'react';
import { CLINICAL_MEASURE_LABELS } from '../../constants/config';
import doctorService from '../../services/doctorService';
import GrowthCurveChart from '../charts/GrowthCurveChart';

const MEASURE_TO_PANEL = {
    weight: 'weight',
    height: 'height',
    head: 'head',
    head_circumference: 'head',
    bmi: 'bmi',
};

function processMeasurementPoints(rawData, patient) {
    if (!Array.isArray(rawData) || !rawData.length) return [];
    const birthDate = new Date(patient?.birthDate || patient?.birth_date || patient?.date_of_birth || patient?.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return [];

    return rawData.map((item) => {
        const dateObj = new Date(item.date);
        const ageInMonths = (dateObj - birthDate) / (1000 * 60 * 60 * 24 * 30.4375);
        return {
            age: Number(ageInMonths.toFixed(2)),
            value: Number(item.value),
            displayDate: dateObj.toLocaleDateString(),
        };
    })
        .filter((p) => Number.isFinite(p.age) && Number.isFinite(p.value))
        .sort((a, b) => a.age - b.age);
}

function pickCurveForPatient(curves, { measure, gender, ageInMonths }) {
    if (!Array.isArray(curves)) return null;

    const usable = curves.filter((c) => c && c.curve_data && c.gender === gender && c.validation_status !== 'rejected');
    const panelMatches = (curve) => {
        const panels = curve.curve_data?.panels || [];
        return panels.some((p) => p.measure === measure);
    };
    const ageInRange = (curve) => {
        const range = curve.curve_data?.ageRange;
        if (!range) return true;
        if (!Number.isFinite(ageInMonths)) return true;
        return ageInMonths >= range.min - 2 && ageInMonths <= range.max + 2;
    };

    const candidates = usable.filter((c) => panelMatches(c) && ageInRange(c));
    if (!candidates.length) return null;

    // Prefer doctor_approved, then auto_approved
    const ranking = { doctor_approved: 0, auto_approved: 1, pending_review: 2 };
    candidates.sort((a, b) => (ranking[a.validation_status] ?? 9) - (ranking[b.validation_status] ?? 9));
    return candidates[0];
}

function PatientMeasurementsChart({ data, allData, measureKey, patient, height = 520 }) {
    const [savedCurves, setSavedCurves] = useState([]);
    const [loadError, setLoadError] = useState(null);
    const measureInfo = CLINICAL_MEASURE_LABELS[measureKey] || { label: measureKey, unit: '' };

    useEffect(() => {
        let cancelled = false;
        doctorService.getGrowthCurves()
            .then((res) => {
                if (cancelled) return;
                if (res?.success && Array.isArray(res.data)) setSavedCurves(res.data);
                else setSavedCurves([]);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Error fetching growth curves:', err);
                    setLoadError(err?.message || 'Erreur de chargement');
                }
            });
        return () => { cancelled = true; };
    }, []);

    const panelMeasure = MEASURE_TO_PANEL[measureKey] || measureKey;
    const isCombinedView = measureKey === 'weight_height';

    const heightPoints = useMemo(() => {
        const raw = allData?.height || (panelMeasure === 'height' ? data : null);
        return raw ? processMeasurementPoints(raw, patient) : [];
    }, [allData, data, panelMeasure, patient]);

    const weightPoints = useMemo(() => {
        const raw = allData?.weight || (panelMeasure === 'weight' ? data : null);
        return raw ? processMeasurementPoints(raw, patient) : [];
    }, [allData, data, panelMeasure, patient]);

    const headPoints = useMemo(() => {
        const raw = allData?.head || (panelMeasure === 'head' ? data : null);
        return raw ? processMeasurementPoints(raw, patient) : [];
    }, [allData, data, panelMeasure, patient]);

    const bmiPoints = useMemo(() => {
        const raw = allData?.bmi || (panelMeasure === 'bmi' ? data : null);
        return raw ? processMeasurementPoints(raw, patient) : [];
    }, [allData, data, panelMeasure, patient]);

    const singlePoints = useMemo(() => processMeasurementPoints(data, patient), [data, patient]);

    const latestAge = useMemo(() => {
        const all = [...heightPoints, ...weightPoints, ...headPoints, ...bmiPoints, ...singlePoints];
        if (!all.length) return null;
        return Math.max(...all.map((p) => p.age));
    }, [heightPoints, weightPoints, headPoints, bmiPoints, singlePoints]);

    const matchingCurve = useMemo(() => {
        if (!savedCurves.length) return null;
        const gender = patient?.gender || 'male';
        if (isCombinedView) {
            // Look for any composite curve covering the latest age
            return savedCurves.find((c) => {
                if (!c?.curve_data?.isComposite) return false;
                if (c.gender !== gender) return false;
                if (c.validation_status === 'rejected') return false;
                const range = c.curve_data.ageRange;
                if (!range || !Number.isFinite(latestAge)) return true;
                return latestAge >= range.min - 2 && latestAge <= range.max + 2;
            }) || null;
        }
        return pickCurveForPatient(savedCurves, {
            measure: panelMeasure,
            gender,
            ageInMonths: latestAge,
        });
    }, [savedCurves, isCombinedView, patient, panelMeasure, latestAge]);

    const hasAnyPoint = singlePoints.length || heightPoints.length || weightPoints.length || headPoints.length || bmiPoints.length;

    if (!hasAnyPoint) {
        return (
            <div className="empty-chart" style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Aucune donnée pour {measureInfo.label}.
            </div>
        );
    }

    const containerHeight = typeof height === 'number' ? `${height}px` : height;

    return (
        <div className="measurement-chart-container" style={{
            width: '100%', minHeight: containerHeight,
            background: 'var(--bg-card)', borderRadius: 12,
            border: '1px solid var(--border-color)',
            padding: '14px 16px 18px',
        }}>
            {loadError && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{loadError}</div>
            )}

            {matchingCurve ? (
                <GrowthCurveChart
                    curve={matchingCurve.curve_data}
                    title={matchingCurve.label || matchingCurve.curve_data?.label}
                    height={typeof height === 'number' ? height - 30 : 480}
                    patientPoints={isCombinedView
                        ? { height: heightPoints, weight: weightPoints }
                        : (matchingCurve.curve_data?.isComposite
                            ? { height: heightPoints, weight: weightPoints, head: headPoints, bmi: bmiPoints }
                            : singlePoints)}
                />
            ) : (
                <div style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                }}>
                    Aucune courbe configurée pour {measureInfo.label} ({patient?.gender || 'unknown'}).
                    <br />
                    Ajoutez-en une depuis Paramètres → Courbes de croissance.
                </div>
            )}
        </div>
    );
}

export default PatientMeasurementsChart;
