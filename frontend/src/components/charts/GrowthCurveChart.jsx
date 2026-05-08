/**
 * GrowthCurveChart
 *
 * Renders a growth curve from the unified data schema (no background image,
 * no overlay positioning). Supports single-panel (height/weight/head/bmi)
 * and composite charts (height + weight stacked).
 *
 * Two line families are supported:
 *   - Percentile-style (OMS/CDC): P3, P10, P25, P50, P75, P90, P97
 *   - SD-style       (AFPA):     M-3SD, M-2SD, M-1SD, M, M+1SD, M+2SD, M+3SD
 *
 * The family is auto-detected from the keys present in panel.percentiles.
 *
 * Props:
 *   - curve:          unified schema object { panels: [{ measure, unit, ages, percentiles }] }
 *   - patientPoints:  { height: [{age, value, displayDate}], weight: [...], ... } OR a single array
 *   - height:         CSS height of the container (default 480)
 *   - title:          optional title shown above the chart
 */
import { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import CalibratedOverlayChart from './CalibratedOverlayChart';

const PERCENTILE_STYLE = {
    P3:  { stroke: '#dc2626', dashArray: '4 4' },
    P10: { stroke: '#f59e0b', dashArray: '2 4' },
    P25: { stroke: '#10b981', dashArray: '2 4' },
    P50: { stroke: '#0f172a', dashArray: undefined },
    P75: { stroke: '#10b981', dashArray: '2 4' },
    P90: { stroke: '#f59e0b', dashArray: '2 4' },
    P97: { stroke: '#dc2626', dashArray: '4 4' },
};
const PERCENTILE_ORDER = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];

// AFPA SD-style: median in solid black, ±SD in dashed shades of grey/dark.
// Conventions follow AFPA-CRESS-Inserm 2018 visual style:
//   - extreme bands ±3SD: thicker, darker, dashed long
//   - mid bands  ±2SD: medium dashed
//   - inner bands ±1SD: short dashed
//   - median M: solid bold
const SD_STYLE = {
    'M-3SD': { stroke: '#0f172a', dashArray: '6 3', label: '-3 σ' },
    'M-2SD': { stroke: '#1f2937', dashArray: '4 4', label: '-2 σ' },
    'M-1SD': { stroke: '#334155', dashArray: '2 4', label: '-1 σ' },
    M:       { stroke: '#0f172a', dashArray: undefined, label: 'M' },
    'M+1SD': { stroke: '#334155', dashArray: '2 4', label: '+1 σ' },
    'M+2SD': { stroke: '#1f2937', dashArray: '4 4', label: '+2 σ' },
    'M+3SD': { stroke: '#0f172a', dashArray: '6 3', label: '+3 σ' },
};
const SD_ORDER = ['M-3SD', 'M-2SD', 'M-1SD', 'M', 'M+1SD', 'M+2SD', 'M+3SD'];

const PATIENT_LINE_COLOR = {
    height: '#2563eb',
    weight: '#9333ea',
    head: '#0ea5e9',
    bmi: '#16a34a',
};

const MEASURE_LABEL = {
    height: 'Taille',
    weight: 'Poids',
    head: 'Périmètre crânien',
    bmi: 'IMC',
};

function detectFamily(panel) {
    if (!panel?.percentiles) return 'percentile';
    const keys = Object.keys(panel.percentiles);
    return keys.some((k) => SD_ORDER.includes(k)) ? 'sd' : 'percentile';
}

function buildPanelChartData(panel, lineKeys) {
    if (!panel || !Array.isArray(panel.ages)) return [];
    const ages = panel.ages;
    return ages.map((age, idx) => {
        const point = { age };
        for (const k of lineKeys) {
            const arr = panel.percentiles?.[k];
            if (Array.isArray(arr)) {
                const v = arr[idx];
                if (v != null && Number.isFinite(v)) point[k] = v;
            }
        }
        return point;
    });
}

function getYDomain(panel) {
    if (!panel?.percentiles) return ['auto', 'auto'];
    const allValues = Object.values(panel.percentiles)
        .flat()
        .filter((v) => Number.isFinite(v));
    if (!allValues.length) return ['auto', 'auto'];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    const pad = range * 0.05 || 1;
    const lo = Math.max(0, Math.floor((min - pad) * 10) / 10);
    const hi = Math.ceil((max + pad) * 10) / 10;
    return [lo, hi];
}

function formatNumberTick(v) {
    if (!Number.isFinite(v)) return '';
    return Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString();
}

function PanelChart({ panel, patientPoints, panelHeight }) {
    const family = useMemo(() => detectFamily(panel), [panel]);
    const lineKeys = family === 'sd' ? SD_ORDER : PERCENTILE_ORDER;
    const lineStyle = family === 'sd' ? SD_STYLE : PERCENTILE_STYLE;

    const chartData = useMemo(() => buildPanelChartData(panel, lineKeys), [panel, lineKeys]);
    const yDomain = useMemo(() => getYDomain(panel), [panel]);
    const measure = panel.measure;
    const lineColor = PATIENT_LINE_COLOR[measure] || '#2563eb';
    const measureLabel = MEASURE_LABEL[measure] || measure;

    const patientChartData = useMemo(() => {
        if (!Array.isArray(patientPoints)) return [];
        return patientPoints
            .map((pt) => ({
                age: Number(pt.age ?? pt.ageInMonths),
                patient: Number(pt.value),
                displayDate: pt.displayDate || pt.date || '',
            }))
            .filter((p) => Number.isFinite(p.age) && Number.isFinite(p.patient))
            .sort((a, b) => a.age - b.age);
    }, [patientPoints]);

    if (!chartData.length) {
        return <div style={{ padding: 24, textAlign: 'center', opacity: 0.7 }}>Pas de données de courbe</div>;
    }

    const xDomain = [chartData[0].age, chartData[chartData.length - 1].age];
    const medianKey = family === 'sd' ? 'M' : 'P50';

    return (
        <div style={{ width: '100%', height: panelHeight }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={chartData}
                    margin={{ top: 16, right: 24, left: 12, bottom: 24 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="age"
                        type="number"
                        domain={xDomain}
                        tickCount={Math.min(13, Math.ceil((xDomain[1] - xDomain[0]) / 12) + 1)}
                        label={{ value: 'Âge (mois)', position: 'insideBottom', offset: -8, fill: '#475569' }}
                        tick={{ fill: '#475569', fontSize: 11 }}
                    />
                    <YAxis
                        domain={yDomain}
                        label={{ value: `${measureLabel} (${panel.unit || ''})`, angle: -90, position: 'insideLeft', fill: '#475569' }}
                        tick={{ fill: '#475569', fontSize: 11 }}
                        tickFormatter={formatNumberTick}
                        allowDecimals
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 8, border: '1px solid #cbd5e1' }}
                        labelFormatter={(age) => `Âge ${age} mois`}
                        formatter={(value, key, ctx) => {
                            const display = formatNumberTick(value);
                            if (key === 'patient') {
                                const dt = ctx?.payload?.displayDate;
                                return [`${display} ${panel.unit || ''}${dt ? `  (${dt})` : ''}`, `Patient`];
                            }
                            const niceLabel = lineStyle[key]?.label || key;
                            return [`${display} ${panel.unit || ''}`, niceLabel];
                        }}
                    />
                    <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />

                    {lineKeys.map((k) => (
                        <Line
                            key={k}
                            type="monotone"
                            dataKey={k}
                            stroke={lineStyle[k].stroke}
                            strokeWidth={k === medianKey ? 2 : 1}
                            strokeDasharray={lineStyle[k].dashArray}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls
                            name={lineStyle[k].label || k}
                        />
                    ))}

                    {patientChartData.length > 0 && (
                        <>
                            <Line
                                data={patientChartData}
                                dataKey="patient"
                                xAxisId={0}
                                yAxisId={0}
                                stroke={lineColor}
                                strokeWidth={2.5}
                                dot={false}
                                isAnimationActive={false}
                                name="Patient"
                                connectNulls
                            />
                            <Scatter
                                data={patientChartData}
                                dataKey="patient"
                                fill={lineColor}
                                stroke="#fff"
                                strokeWidth={2}
                                shape="circle"
                                r={5}
                                name="Patient"
                                isAnimationActive={false}
                            />
                        </>
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function GrowthCurveChart({ curve, patientPoints, height = 480, title, calibration, imageUrl }) {
    // Calibrated-overlay mode: the doctor uploaded a chart image and clicked
    // calibration points. Render the original image with patient dots placed
    // at math-correct positions instead of redrawing the chart from data.
    if (calibration && imageUrl) {
        return (
            <CalibratedOverlayChart
                imageUrl={imageUrl}
                calibration={calibration}
                patientPoints={patientPoints}
                height={height}
                title={title}
            />
        );
    }

    if (!curve || !Array.isArray(curve.panels) || curve.panels.length === 0) {
        return (
            <div style={{ padding: 24, textAlign: 'center', opacity: 0.7 }}>
                Courbe non disponible.
            </div>
        );
    }
    const panelHeight = curve.panels.length > 1 ? Math.max(200, Math.floor(height / curve.panels.length)) : height;

    function pointsForPanel(panel) {
        if (!patientPoints) return [];
        if (Array.isArray(patientPoints)) return patientPoints;
        return patientPoints[panel.measure] || [];
    }

    return (
        <div style={{ width: '100%' }}>
            {title && <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{title}</div>}
            {curve.panels.map((panel, idx) => (
                <div key={`${panel.measure}-${idx}`} style={{ marginBottom: idx < curve.panels.length - 1 ? 12 : 0 }}>
                    <PanelChart
                        panel={panel}
                        patientPoints={pointsForPanel(panel)}
                        panelHeight={panelHeight}
                    />
                </div>
            ))}
            {curve.source && (
                <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 4 }}>
                    Source : {curve.source}
                </div>
            )}
        </div>
    );
}
