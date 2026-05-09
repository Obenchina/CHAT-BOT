/**
 * PatientMeasurementsChart
 *
 * Renders a single clinical measure (or a composite weight+height view) for a
 * patient against a growth curve from the doctor's bank. The chart is fully
 * deterministic — patient points are drawn on the same Recharts coordinate
 * system as the percentile lines (no background image overlay).
 */
import { useEffect, useMemo, useState } from 'react';
import { API_URL, CLINICAL_MEASURE_LABELS } from '../../constants/config';
import doctorService from '../../services/doctorService';
import GrowthCurveChart from '../charts/GrowthCurveChart';

const UPLOADS_BASE = API_URL.replace(/\/api\/?$/, '');
function uploadUrl(relPath) {
    if (!relPath) return null;
    const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
    const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
    return `${UPLOADS_BASE}${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

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

// Map app-side measure key ('height', 'weight', 'head', 'bmi') to the calibration
// axis token ('taille', 'poids', 'pc', 'imc') used in calibration.yPrimary.axis.
const MEASURE_TO_AXIS = {
    height: 'taille',
    weight: 'poids',
    head: 'pc',
    bmi: 'imc',
};

function calibrationCoversMeasure(curve, measure) {
    const axisToken = MEASURE_TO_AXIS[measure];
    if (!axisToken) return false;
    const calib = curve?.calibration;
    if (!calib?.x || !calib?.yPrimary) return false;
    return calib.yPrimary.axis === axisToken
        || (calib.ySecondary && calib.ySecondary.axis === axisToken);
}

function pickCurveForPatient(curves, { measure, gender, ageInMonths }) {
    if (!Array.isArray(curves)) return null;

    const isCalibrated = (c) => c?.source_type === 'calibrated_overlay'
        && c?.calibration?.x && c?.calibration?.yPrimary;
    const isData = (c) => Boolean(c?.curve_data);

    // Only doctor-validated or auto-approved (built-in reference) curves are
    // surfaced in the patient view. Pending AI extractions stay hidden until
    // the doctor reviews them, to avoid plotting clinical measurements against
    // unverified percentile data.
    const usable = curves.filter((c) =>
        c && c.gender === gender
        && (c.validation_status === 'auto_approved' || c.validation_status === 'doctor_approved')
        && (isData(c) || isCalibrated(c))
    );

    const matches = (curve) => {
        if (isCalibrated(curve)) return calibrationCoversMeasure(curve, measure);
        const panels = curve.curve_data?.panels || [];
        return panels.some((p) => p.measure === measure);
    };
    const ageInRange = (curve) => {
        if (!Number.isFinite(ageInMonths)) return true;
        if (isCalibrated(curve)) {
            // calibration.x stores the unit; we accept anything within [aA, aB] +/- 1 unit
            const x = curve.calibration.x;
            const ageInUnit = (x.unit === 'months') ? ageInMonths : ageInMonths / 12;
            const lo = Math.min(x.aA, x.aB);
            const hi = Math.max(x.aA, x.aB);
            const slack = (x.unit === 'months') ? 12 : 1;
            return ageInUnit >= lo - slack && ageInUnit <= hi + slack;
        }
        const range = curve.curve_data?.ageRange;
        if (!range) return true;
        return ageInMonths >= range.min - 2 && ageInMonths <= range.max + 2;
    };

    const getRangeSize = (c) => {
        if (isCalibrated(c)) {
            const x = c.calibration.x;
            const size = Math.abs(x.aB - x.aA);
            return x.unit === 'months' ? size : size * 12;
        }
        if (c.curve_data?.ageRange) {
            return c.curve_data.ageRange.max - c.curve_data.ageRange.min;
        }
        return Infinity;
    };

    const candidates = usable.filter((c) => matches(c) && ageInRange(c));
    if (!candidates.length) return null;

    // Prefer doctor_approved, then auto_approved
    const ranking = { doctor_approved: 0, auto_approved: 1, pending_review: 2 };
    candidates.sort((a, b) => {
        const rankA = ranking[a.validation_status] ?? 9;
        const rankB = ranking[b.validation_status] ?? 9;
        if (rankA !== rankB) return rankA - rankB;
        
        // If status is equal, prefer the curve with the smallest (most zoomed-in) age range
        return getRangeSize(a) - getRangeSize(b);
    });
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
            const isApproved = (c) =>
                c?.validation_status === 'auto_approved' || c?.validation_status === 'doctor_approved';

            // 1. Composite calibrated overlay (preferred — pixel-perfect AFPA-style)
            const calibratedComposite = savedCurves.find((c) => {
                if (c?.source_type !== 'calibrated_overlay') return false;
                if (c?.gender !== gender) return false;
                if (!isApproved(c)) return false;
                const cal = c?.calibration;
                if (!cal?.x || !cal?.yPrimary || !cal?.ySecondary) return false;
                const hasTaille = cal.yPrimary.axis === 'taille' || cal.ySecondary.axis === 'taille';
                const hasPoids = cal.yPrimary.axis === 'poids' || cal.ySecondary.axis === 'poids';
                return hasTaille && hasPoids;
            });
            if (calibratedComposite) return calibratedComposite;

            // 2. Recharts composite (curve_data.isComposite)
            return savedCurves.find((c) => {
                if (!c?.curve_data?.isComposite) return false;
                if (c.gender !== gender) return false;
                if (!isApproved(c)) return false;
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

    const isCalibratedMatch = matchingCurve?.source_type === 'calibrated_overlay'
        && matchingCurve?.calibration?.x;

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
                    calibration={isCalibratedMatch ? matchingCurve.calibration : null}
                    imageUrl={isCalibratedMatch ? uploadUrl(matchingCurve.original_image_path) : null}
                    patientPoints={
                        isCalibratedMatch
                            ? { height: heightPoints, weight: weightPoints, head: headPoints, bmi: bmiPoints }
                            : isCombinedView
                                ? { height: heightPoints, weight: weightPoints }
                                : (matchingCurve.curve_data?.isComposite
                                    ? { height: heightPoints, weight: weightPoints, head: headPoints, bmi: bmiPoints }
                                    : singlePoints)
                    }
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
