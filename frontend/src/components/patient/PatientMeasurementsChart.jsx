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
    if (!rawData || !Array.isArray(rawData)) return [];

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
 * Extracts a config object (xDomain, yDomain, plotArea) from a template_config
 * for a specific measure key.
 */
function extractConfigForMeasure(templateConfig, targetMeasureKey) {
    if (!templateConfig) return null;
    const tc = templateConfig.measure_configs?.[targetMeasureKey] || templateConfig;
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
 * Renders a single data line overlay positioned absolutely within the parent.
 */
function MeasureLineOverlay({ chartData, config, color, label, unit }) {
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0} />

                    <XAxis
                        dataKey="ageInMonths"
                        type="number"
                        domain={config.xDomain}
                        allowDataOverflow
                        hide
                    />

                    <YAxis
                        domain={config.yDomain}
                        allowDataOverflow
                        hide
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255,255,255,0.96)',
                            borderRadius: 8,
                            border: `1px solid ${color}`,
                            color: '#0f172a'
                        }}
                        labelFormatter={(value) => `Age: ${value} mois`}
                        formatter={(value) => [`${value} ${unit || ''}`, label]}
                    />

                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={3}
                        dot={{ r: 7, fill: color, strokeWidth: 3, stroke: '#fff' }}
                        activeDot={{ r: 9 }}
                        isAnimationActive={false}
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
        if (measureKey === 'blood_pressure') return 'blood_pressure';
        return measureKey;
    }, [measureKey]);

    useEffect(() => {
        async function fetchCurves() {
            try {
                const res = await doctorService.getGrowthCurves();
                if (res.success && res.data) setAvailableCurves(res.data || []);
            } catch (error) {
                console.error('Error fetching growth curves:', error);
            }
        }

        fetchCurves();
    }, []);

    const chartData = useMemo(() => processChartData(data, patient), [data, patient]);

    const patientGender = patient?.gender || 'male';
    const patientAgeMonths = useMemo(() => {
        if (!chartData.length) return null;
        return chartData[chartData.length - 1]?.ageInMonths ?? null;
    }, [chartData]);

    const matchingCurve = useMemo(() => {
        const pool = Array.isArray(availableCurves) ? availableCurves : [];
        const eligible = pool.filter((curve) => {
            if (!curve) return false;
            if (!curve.is_plot_enabled || !curve.template_config) return false;
            const curveMeasure = curve.measure_key;
            const measureMatches =
                curveMeasure === normalizedMeasureKey ||
                (curveMeasure === 'weight_height' && ['weight', 'height'].includes(normalizedMeasureKey));
            if (!measureMatches) return false;
            if (curve.gender !== patientGender) return false;

            const minAge = Number(curve.age_range?.min_age ?? curve.template_config?.x_min ?? 0);
            const maxAge = Number(curve.age_range?.max_age ?? curve.template_config?.x_max ?? 0);
            if (patientAgeMonths === null || Number.isNaN(patientAgeMonths)) return true;
            return chartData.some((point) => point.ageInMonths >= minAge && point.ageInMonths <= maxAge);
        });

        return eligible.find((curve) => curve.source_type !== 'official') || eligible[0] || null;
    }, [availableCurves, normalizedMeasureKey, patientGender, patientAgeMonths, chartData]);

    const isCombined = matchingCurve?.measure_key === 'weight_height';

    // --- Standard (single measure) config ---
    const config = useMemo(() => {
        if (isCombined) return null; // handled separately
        return extractConfigForMeasure(matchingCurve?.template_config, normalizedMeasureKey);
    }, [matchingCurve, normalizedMeasureKey, isCombined]);

    // --- Combined chart: separate configs for height and weight ---
    const heightConfig = useMemo(() => {
        if (!isCombined) return null;
        return extractConfigForMeasure(matchingCurve?.template_config, 'height');
    }, [isCombined, matchingCurve]);

    const weightConfig = useMemo(() => {
        if (!isCombined) return null;
        return extractConfigForMeasure(matchingCurve?.template_config, 'weight');
    }, [isCombined, matchingCurve]);

    // Process data for both measures when we have a combined chart
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

    const hasAnyCombinedData = heightChartData.length > 0 || weightChartData.length > 0;
    const useOverlayTemplate = isCombined
        ? Boolean((heightConfig || weightConfig) && matchingCurve?.file_path)
        : Boolean(config && matchingCurve?.file_path);

    const chartMargins = useMemo(() => (
        useOverlayTemplate
            ? { top: 0, right: 0, left: 0, bottom: 0 }
            : { top: 24, right: 28, left: 12, bottom: 22 }
    ), [useOverlayTemplate]);

    const backgroundStyle = useMemo(() => {
        if (!useOverlayTemplate) return {};

        return {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${getAuthUploadUrl(matchingCurve.file_path)})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: 0.9,
            zIndex: 0,
            borderRadius: 12
        };
    }, [matchingCurve, useOverlayTemplate]);

    if (!chartData.length && !hasAnyCombinedData) {
        return (
            <div className="empty-chart" style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Aucune donnee pour {measureInfo.label}.
            </div>
        );
    }

    const containerHeight = typeof height === 'number' ? `${height}px` : height;

    return (
        <div className="measurement-chart-container" style={{
            width: '100%',
            height: containerHeight,
            position: 'relative',
            background: useOverlayTemplate ? 'transparent' : 'var(--bg-card)',
            borderRadius: 12,
            border: useOverlayTemplate ? 'none' : '1px solid var(--border-color)',
            padding: useOverlayTemplate ? 0 : '12px 14px 34px'
        }}>
            {useOverlayTemplate && <div style={backgroundStyle} />}

            {/* COMBINED CHART: two separate overlays for height & weight */}
            {isCombined && useOverlayTemplate ? (
                <>
                    <MeasureLineOverlay
                        chartData={heightChartData}
                        config={heightConfig}
                        color="#38BDF8"
                        label="Taille"
                        unit="cm"
                    />
                    <MeasureLineOverlay
                        chartData={weightChartData}
                        config={weightConfig}
                        color="#F59E0B"
                        label="Poids"
                        unit="kg"
                    />
                </>
            ) : (
                /* STANDARD SINGLE CHART */
                <div style={{
                    position: useOverlayTemplate ? 'absolute' : 'relative',
                    top: useOverlayTemplate ? `${config.plotArea.top}%` : 0,
                    left: useOverlayTemplate ? `${config.plotArea.left}%` : 0,
                    width: useOverlayTemplate ? `${config.plotArea.right - config.plotArea.left}%` : '100%',
                    height: useOverlayTemplate ? `${config.plotArea.bottom - config.plotArea.top}%` : '100%',
                    zIndex: 1
                }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={chartMargins}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={useOverlayTemplate ? 0 : 0.55} />

                            <XAxis
                                dataKey={config ? 'ageInMonths' : 'displayDate'}
                                type={config ? 'number' : 'category'}
                                domain={config ? config.xDomain : undefined}
                                allowDataOverflow={Boolean(config)}
                                hide={useOverlayTemplate}
                                stroke="var(--text-secondary)"
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                tickFormatter={(value) => config ? `${value}m` : value}
                            />

                            <YAxis
                                domain={config ? config.yDomain : ['auto', 'auto']}
                                allowDataOverflow={Boolean(config)}
                                hide={useOverlayTemplate}
                                stroke="var(--text-secondary)"
                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                width={48}
                            />

                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.96)',
                                    borderRadius: 8,
                                    border: '1px solid var(--primary)',
                                    color: '#0f172a'
                                }}
                                labelFormatter={(value) => config ? `Age: ${value} mois` : value}
                                formatter={(value) => [`${value} ${measureInfo.unit || ''}`, measureInfo.label]}
                            />

                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#38BDF8"
                                strokeWidth={3}
                                dot={{ r: 7, fill: '#38BDF8', strokeWidth: 3, stroke: '#fff' }}
                                activeDot={{ r: 9 }}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Legend / Info badge */}
            <div style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                fontSize: '0.75rem',
                color: matchingCurve ? 'var(--success)' : 'var(--text-secondary)',
                backgroundColor: useOverlayTemplate ? 'rgba(255,255,255,0.85)' : 'var(--bg-elevated)',
                padding: '4px 10px',
                borderRadius: 6,
                border: useOverlayTemplate ? 'none' : '1px solid var(--border-color)',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8
            }}>
                {matchingCurve
                    ? isCombined
                        ? (
                            <>
                                <span>Poids + Taille ({matchingCurve.gender === 'male' ? 'G' : 'F'})</span>
                                {heightChartData.length > 0 && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <span style={{ width: 10, height: 3, backgroundColor: '#38BDF8', borderRadius: 2 }} />
                                        Taille
                                    </span>
                                )}
                                {weightChartData.length > 0 && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <span style={{ width: 10, height: 3, backgroundColor: '#F59E0B', borderRadius: 2 }} />
                                        Poids
                                    </span>
                                )}
                            </>
                        )
                        : `Template officiel : ${measureInfo.label} (${matchingCurve.gender === 'male' ? 'G' : 'F'})`
                    : 'Courbe patient sans template officiel adapte'}
            </div>

            {!useOverlayTemplate && (
                <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 16,
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    zIndex: 2
                }}>
                    Age en mois / {measureInfo.unit || measureInfo.label}
                </div>
            )}
        </div>
    );
}

export default PatientMeasurementsChart;
