import { useEffect, useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { CLINICAL_MEASURE_LABELS, getAuthUploadUrl } from '../../constants/config';
import doctorService from '../../services/doctorService';

/**
 * Converts raw measurement data into chart-ready points with ageInMonths.
 */
function processChartData(rawData, patient) {
    if (!rawData || !Array.isArray(rawData) || !rawData.length) return [];

    const birthDate = new Date(patient?.birthDate || patient?.birth_date || patient?.date_of_birth || patient?.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return [];

    return rawData.map((item) => {
        const dateObj = new Date(item.date);
        const ageInMonths = (dateObj - birthDate) / (1000 * 60 * 60 * 24 * 30.4375);
        return {
            ...item,
            displayDate: dateObj.toLocaleDateString(),
            ageInMonths: Number(ageInMonths.toFixed(2)),
            value: Number(item.value)
        };
    }).filter((item) => Number.isFinite(item.ageInMonths) && Number.isFinite(item.value))
        .sort((a, b) => a.ageInMonths - b.ageInMonths);
}

/**
 * Extracts a config object (xDomain, yDomain, plotArea) from a template_config.
 */
function extractConfig(templateConfig, measureKey) {
    if (!templateConfig) return null;
    // If the template has measure_configs, pick the sub-config for the specific measure
    const tc = templateConfig.measure_configs?.[measureKey] || templateConfig;
    const xMin = Number(tc.x_min ?? tc.min_age);
    const xMax = Number(tc.x_max ?? tc.max_age);
    const yMin = Number(tc.y_min ?? tc.min_y);
    const yMax = Number(tc.y_max ?? tc.max_y);
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || xMax <= xMin || yMax <= yMin) {
        return null;
    }
    return {
        xDomain: [xMin, xMax],
        yDomain: [yMin, yMax],
        plotArea: tc.plot_area || { left: 0, top: 0, right: 100, bottom: 100 }
    };
}

/**
 * Renders a single data-line overlay (positioned absolutely).
 */
function OverlayLine({ chartData, config, color, label, unit }) {
    if (!config || !chartData.length) return null;
    return (
        <div style={{
            position: 'absolute',
            top: `${config.plotArea.top}%`,
            left: `${config.plotArea.left}%`,
            width: `${config.plotArea.right - config.plotArea.left}%`,
            height: `${config.plotArea.bottom - config.plotArea.top}%`,
            zIndex: 1
        }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid opacity={0} />
                    <XAxis dataKey="ageInMonths" type="number" domain={config.xDomain} allowDataOverflow hide />
                    <YAxis domain={config.yDomain} allowDataOverflow hide />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 8, border: `1px solid ${color}`, color: '#0f172a' }}
                        labelFormatter={(v) => `Age: ${v} mois`}
                        formatter={(v) => [`${v} ${unit}`, label]}
                    />
                    <Line
                        type="monotone" dataKey="value" stroke={color} strokeWidth={3}
                        dot={{ r: 7, fill: color, strokeWidth: 3, stroke: '#fff' }}
                        activeDot={{ r: 9 }} isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function PatientMeasurementsChart({ data, allData, measureKey, patient, height = 520 }) {
    const [availableCurves, setAvailableCurves] = useState([]);
    const measureInfo = CLINICAL_MEASURE_LABELS[measureKey] || { label: measureKey, unit: '' };

    const normalizedMeasureKey = useMemo(() => {
        if (measureKey === 'head_circumference') return 'head';
        return measureKey;
    }, [measureKey]);

    useEffect(() => {
        doctorService.getGrowthCurves()
            .then((res) => { if (res.success && res.data) setAvailableCurves(res.data); })
            .catch((err) => console.error('Error fetching growth curves:', err));
    }, []);

    const chartData = useMemo(() => processChartData(data, patient), [data, patient]);
    const patientGender = patient?.gender || 'male';

    // ──── Find matching curve ────
    const matchingCurve = useMemo(() => {
        const pool = Array.isArray(availableCurves) ? availableCurves : [];
        return pool.find((curve) => {
            if (!curve || !curve.is_plot_enabled || !curve.template_config) return false;
            // Gender must match
            if (curve.gender !== patientGender) return false;
            // Measure must match — a weight_height curve matches both weight and height
            const cm = curve.measure_key;
            if (cm === normalizedMeasureKey) return true;
            if (cm === 'weight_height' && (normalizedMeasureKey === 'weight' || normalizedMeasureKey === 'height')) return true;
            return false;
        }) || null;
    }, [availableCurves, normalizedMeasureKey, patientGender]);

    const isCombined = matchingCurve?.measure_key === 'weight_height';

    // ──── Configs ────
    const singleConfig = useMemo(() => {
        if (!matchingCurve || isCombined) return null;
        return extractConfig(matchingCurve.template_config, normalizedMeasureKey);
    }, [matchingCurve, normalizedMeasureKey, isCombined]);

    const heightConfig = useMemo(() => {
        if (!isCombined) return null;
        return extractConfig(matchingCurve.template_config, 'height');
    }, [isCombined, matchingCurve]);

    const weightConfig = useMemo(() => {
        if (!isCombined) return null;
        return extractConfig(matchingCurve.template_config, 'weight');
    }, [isCombined, matchingCurve]);

    // ──── Data for combined chart ────
    const heightChartData = useMemo(() => {
        if (!isCombined) return [];
        const raw = allData?.height || (normalizedMeasureKey === 'height' ? data : []);
        return processChartData(raw, patient);
    }, [isCombined, allData, data, normalizedMeasureKey, patient]);

    const weightChartData = useMemo(() => {
        if (!isCombined) return [];
        const raw = allData?.weight || (normalizedMeasureKey === 'weight' ? data : []);
        return processChartData(raw, patient);
    }, [isCombined, allData, data, normalizedMeasureKey, patient]);

    // ──── Should we overlay on the background image? ────
    const useOverlay = isCombined
        ? Boolean((heightConfig || weightConfig) && matchingCurve?.file_path)
        : Boolean(singleConfig && matchingCurve?.file_path);

    // ──── Background ────
    const bgStyle = useMemo(() => {
        if (!useOverlay) return null;
        return {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: `url(${getAuthUploadUrl(matchingCurve.file_path)})`,
            backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center', opacity: 0.9, zIndex: 0, borderRadius: 12
        };
    }, [matchingCurve, useOverlay]);

    // ──── Empty state ────
    if (!chartData.length && !heightChartData.length && !weightChartData.length) {
        return (
            <div className="empty-chart" style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Aucune donnee pour {measureInfo.label}.
            </div>
        );
    }

    const containerHeight = typeof height === 'number' ? `${height}px` : height;

    return (
        <div className="measurement-chart-container" style={{
            width: '100%', height: containerHeight, position: 'relative',
            background: useOverlay ? 'transparent' : 'var(--bg-card)',
            borderRadius: 12,
            border: useOverlay ? 'none' : '1px solid var(--border-color)',
            padding: useOverlay ? 0 : '12px 14px 34px'
        }}>
            {/* Background image */}
            {useOverlay && <div style={bgStyle} />}

            {/* ── COMBINED: two separate line overlays ── */}
            {isCombined && useOverlay && (
                <>
                    <OverlayLine chartData={heightChartData} config={heightConfig} color="#38BDF8" label="Taille" unit="cm" />
                    <OverlayLine chartData={weightChartData} config={weightConfig} color="#F59E0B" label="Poids" unit="kg" />
                </>
            )}

            {/* ── SINGLE: one chart overlay ── */}
            {!isCombined && (
                <div style={{
                    position: useOverlay ? 'absolute' : 'relative',
                    top: useOverlay && singleConfig ? `${singleConfig.plotArea.top}%` : 0,
                    left: useOverlay && singleConfig ? `${singleConfig.plotArea.left}%` : 0,
                    width: useOverlay && singleConfig ? `${singleConfig.plotArea.right - singleConfig.plotArea.left}%` : '100%',
                    height: useOverlay && singleConfig ? `${singleConfig.plotArea.bottom - singleConfig.plotArea.top}%` : '100%',
                    zIndex: 1
                }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={useOverlay ? { top: 0, right: 0, left: 0, bottom: 0 } : { top: 24, right: 28, left: 12, bottom: 22 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={useOverlay ? 0 : 0.55} />
                            <XAxis
                                dataKey={singleConfig ? 'ageInMonths' : 'displayDate'}
                                type={singleConfig ? 'number' : 'category'}
                                domain={singleConfig ? singleConfig.xDomain : undefined}
                                allowDataOverflow={Boolean(singleConfig)}
                                hide={useOverlay}
                                stroke="var(--text-secondary)"
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                tickFormatter={(v) => singleConfig ? `${v}m` : v}
                            />
                            <YAxis
                                domain={singleConfig ? singleConfig.yDomain : ['auto', 'auto']}
                                allowDataOverflow={Boolean(singleConfig)}
                                hide={useOverlay}
                                stroke="var(--text-secondary)"
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                width={48}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 8, border: '1px solid var(--primary)', color: '#0f172a' }}
                                labelFormatter={(v) => singleConfig ? `Age: ${v} mois` : v}
                                formatter={(v) => [`${v} ${measureInfo.unit || ''}`, measureInfo.label]}
                            />
                            <Line
                                type="monotone" dataKey="value" stroke="#38BDF8" strokeWidth={3}
                                dot={{ r: 7, fill: '#38BDF8', strokeWidth: 3, stroke: '#fff' }}
                                activeDot={{ r: 9 }} isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Legend badge */}
            <div style={{
                position: 'absolute', bottom: 8, right: 8, fontSize: '0.75rem',
                color: matchingCurve ? 'var(--success)' : 'var(--text-secondary)',
                backgroundColor: useOverlay ? 'rgba(255,255,255,0.85)' : 'var(--bg-elevated)',
                padding: '4px 10px', borderRadius: 6,
                border: useOverlay ? 'none' : '1px solid var(--border-color)',
                zIndex: 2, display: 'flex', alignItems: 'center', gap: 8
            }}>
                {matchingCurve
                    ? isCombined
                        ? (<>
                            <span>Poids + Taille ({matchingCurve.gender === 'male' ? 'G' : 'F'})</span>
                            {heightChartData.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 3, backgroundColor: '#38BDF8', borderRadius: 2 }} />Taille</span>}
                            {weightChartData.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 3, backgroundColor: '#F59E0B', borderRadius: 2 }} />Poids</span>}
                        </>)
                        : `Template : ${measureInfo.label} (${matchingCurve.gender === 'male' ? 'G' : 'F'})`
                    : 'Courbe patient sans template adapte'}
            </div>

            {!useOverlay && (
                <div style={{ position: 'absolute', top: 12, left: 16, color: 'var(--text-secondary)', fontSize: '0.82rem', zIndex: 2 }}>
                    Age en mois / {measureInfo.unit || measureInfo.label}
                </div>
            )}
        </div>
    );
}

export default PatientMeasurementsChart;
