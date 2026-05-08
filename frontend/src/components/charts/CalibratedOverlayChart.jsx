/**
 * CalibratedOverlayChart
 *
 * Displays the doctor's uploaded chart image as-is and overlays the patient's
 * measurement points at math-correct positions using the saved calibration.
 *
 * Visual fidelity is 100% — the chart looks exactly like the original PDF.
 * Patient dots are placed using simple linear interpolation between the two
 * calibration anchors per axis, in native pixel space, then scaled to CSS
 * percentages of the rendered image.
 *
 * Props:
 *   - imageUrl:        full URL to the original chart image (with auth token if needed)
 *   - calibration:     { imageWidth, imageHeight, x:{aA,aB,pxA,pxB,unit}, yPrimary:{…}, ySecondary?:{…} }
 *   - patientPoints:   { height: [{age, value, displayDate}], weight: [...], head: […], bmi: […] }
 *                      OR a flat array (treated as primary axis)
 *   - height:          desired CSS height of the container (default 520)
 *   - title:           optional title
 */
import { useMemo } from 'react';

const PRIMARY_DOT_COLOR = '#2563eb';
const SECONDARY_DOT_COLOR = '#9333ea';
const HEIGHT_LINE_COLOR = '#2563eb';
const WEIGHT_LINE_COLOR = '#9333ea';
const HEAD_LINE_COLOR = '#0ea5e9';
const BMI_LINE_COLOR = '#16a34a';

const MEASURE_LABEL = {
    height: 'Taille',
    weight: 'Poids',
    head: 'Périmètre crânien',
    bmi: 'IMC',
};

function ageToPixelX(calibration, ageInMonths) {
    const x = calibration?.x;
    if (!x) return null;
    const xUnit = x.unit || 'years';
    const ageInUnit = xUnit === 'months' ? ageInMonths : ageInMonths / 12;
    const slope = (x.pxB - x.pxA) / (x.aB - x.aA);
    return x.pxA + (ageInUnit - x.aA) * slope;
}

function valueToPixelY(axis, value) {
    if (!axis) return null;
    const slope = (axis.pyB - axis.pyA) / (axis.vB - axis.vA);
    return axis.pyA + (value - axis.vA) * slope;
}

function clampPct(v) {
    if (!Number.isFinite(v)) return null;
    if (v < -5) return null;
    if (v > 105) return null;
    return v;
}

/**
 * Map a measure key to which calibration axis it belongs to.
 * - taille → primary if primary.axis==='taille' else secondary
 * - poids  → primary if primary.axis==='poids'  else secondary
 * - head   → primary if primary.axis==='pc'     else null
 * - bmi    → primary if primary.axis==='imc'    else null
 */
function chooseAxis(calibration, measureKey) {
    const primary = calibration?.yPrimary;
    const secondary = calibration?.ySecondary;
    const desired = ({
        height: 'taille',
        weight: 'poids',
        head: 'pc',
        bmi: 'imc',
    })[measureKey];
    if (!desired) return { axis: null, axisKey: null };
    if (primary?.axis === desired) return { axis: primary, axisKey: 'primary' };
    if (secondary?.axis === desired) return { axis: secondary, axisKey: 'secondary' };
    return { axis: null, axisKey: null };
}

function projectPoints(calibration, points, axis) {
    if (!Array.isArray(points) || !axis) return [];
    return points
        .map((p) => {
            const ageInMonths = Number(p.age ?? p.ageInMonths);
            const value = Number(p.value);
            if (!Number.isFinite(ageInMonths) || !Number.isFinite(value)) return null;
            const px = ageToPixelX(calibration, ageInMonths);
            const py = valueToPixelY(axis, value);
            if (px == null || py == null) return null;
            const xPct = clampPct((px / calibration.imageWidth) * 100);
            const yPct = clampPct((py / calibration.imageHeight) * 100);
            if (xPct == null || yPct == null) return null;
            return {
                xPct, yPct,
                value,
                ageInMonths,
                displayDate: p.displayDate || p.date || '',
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.ageInMonths - b.ageInMonths);
}

function PointTrack({ projected, color, label, unit }) {
    if (!projected.length) return null;
    // Build SVG polyline string
    const polylinePoints = projected.map((p) => `${p.xPct},${p.yPct}`).join(' ');
    return (
        <>
            {/* line connecting points */}
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    pointerEvents: 'none',
                }}
            >
                <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.4"
                    strokeOpacity="0.85"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: 2 }}
                />
            </svg>
            {/* the dots themselves (positioned absolutely so they have stable size) */}
            {projected.map((p, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${p.xPct}%`,
                        top: `${p.yPct}%`,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'auto',
                        zIndex: 2,
                    }}
                    title={`${label}: ${p.value} ${unit}${p.displayDate ? ` — ${p.displayDate}` : ''}`}
                >
                    <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: color, border: '2px solid #fff',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
                    }} />
                </div>
            ))}
        </>
    );
}

export default function CalibratedOverlayChart({
    imageUrl,
    calibration,
    patientPoints,
    // height is intentionally accepted but unused; the layout is driven by the
    // image's intrinsic aspect ratio so the overlay stays pixel-aligned.
    // eslint-disable-next-line no-unused-vars
    height,
    title,
}) {
    const projectedTracks = useMemo(() => {
        if (!calibration || !calibration.imageWidth || !calibration.imageHeight) return [];

        const points = patientPoints || {};
        const flat = Array.isArray(points);

        const tracks = [];
        if (flat) {
            // assume primary axis
            const axis = calibration.yPrimary;
            tracks.push({
                projected: projectPoints(calibration, points, axis),
                color: PRIMARY_DOT_COLOR,
                label: axis?.axis ? MEASURE_LABEL[axis.axis === 'taille' ? 'height' : axis.axis === 'poids' ? 'weight' : axis.axis] || 'Patient' : 'Patient',
                unit: axis?.unit || '',
            });
            return tracks;
        }

        const measures = ['height', 'weight', 'head', 'bmi'];
        const colorByMeasure = {
            height: HEIGHT_LINE_COLOR,
            weight: WEIGHT_LINE_COLOR,
            head: HEAD_LINE_COLOR,
            bmi: BMI_LINE_COLOR,
        };
        for (const m of measures) {
            const arr = points[m];
            if (!Array.isArray(arr) || arr.length === 0) continue;
            const { axis } = chooseAxis(calibration, m);
            if (!axis) continue;
            tracks.push({
                projected: projectPoints(calibration, arr, axis),
                color: colorByMeasure[m],
                label: MEASURE_LABEL[m],
                unit: axis.unit,
            });
        }
        return tracks;
    }, [calibration, patientPoints]);

    if (!calibration || !imageUrl) {
        return (
            <div style={{ padding: 24, textAlign: 'center', opacity: 0.7 }}>
                Calibration manquante. Ouvrez la calibration pour activer cette courbe.
            </div>
        );
    }

    const aspectRatio = calibration.imageHeight / calibration.imageWidth;

    return (
        <div style={{ width: '100%' }}>
            {title && <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{title}</div>}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 900,
                margin: '0 auto',
                paddingTop: `${aspectRatio * 100}%`,
                background: '#f8fafc',
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
            }}>
                <img
                    src={imageUrl}
                    alt="Chart"
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%', objectFit: 'contain',
                        userSelect: 'none', pointerEvents: 'none',
                    }}
                    draggable={false}
                />
                {projectedTracks.map((t, idx) => (
                    <PointTrack key={idx} {...t} />
                ))}
            </div>
            {/* legend */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, fontSize: 12 }}>
                {projectedTracks.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: t.color }} />
                        <span>{t.label} ({t.projected.length})</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
