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

function PatientMeasurementsChart({ data, measureKey, patient }) {
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

    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];

        const birthDate = new Date(patient?.birthDate || patient?.birth_date || patient?.date_of_birth || patient?.dateOfBirth);
        if (Number.isNaN(birthDate.getTime())) return [];

        return data.map((item) => {
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
    }, [data, patient]);

    const patientGender = patient?.gender || 'both';
    const patientAgeMonths = useMemo(() => {
        if (!chartData.length) return null;
        return chartData[chartData.length - 1]?.ageInMonths ?? null;
    }, [chartData]);

    const matchingCurve = useMemo(() => {
        const pool = Array.isArray(availableCurves) ? availableCurves : [];
        return pool.find((curve) => {
            if (!curve || curve.source_type !== 'official') return false;
            if (!curve.is_plot_enabled || !curve.template_config) return false;
            if (curve.measure_key !== normalizedMeasureKey) return false;
            if (!(curve.gender === patientGender || curve.gender === 'both')) return false;

            const minAge = Number(curve.age_range?.min_age ?? curve.template_config?.x_min ?? 0);
            const maxAge = Number(curve.age_range?.max_age ?? curve.template_config?.x_max ?? 0);
            if (patientAgeMonths === null || Number.isNaN(patientAgeMonths)) return true;
            return patientAgeMonths >= minAge && patientAgeMonths <= maxAge;
        }) || null;
    }, [availableCurves, normalizedMeasureKey, patientGender, patientAgeMonths]);

    const config = useMemo(() => {
        if (!matchingCurve?.template_config) return null;

        const tc = matchingCurve.template_config;
        return {
            xDomain: [tc.x_min ?? tc.min_age, tc.x_max ?? tc.max_age],
            yDomain: [tc.y_min ?? tc.min_y, tc.y_max ?? tc.max_y],
            plotArea: tc.plot_area || { left: 0, top: 0, right: 100, bottom: 100 }
        };
    }, [matchingCurve]);

    const useOverlayTemplate = Boolean(config && matchingCurve?.file_path);

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

    if (!chartData.length) {
        return (
            <div className="empty-chart" style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Aucune donnee pour {measureInfo.label}.
            </div>
        );
    }

    return (
        <div className="measurement-chart-container" style={{
            width: '100%',
            height: 520,
            position: 'relative',
            background: useOverlayTemplate ? 'transparent' : 'var(--bg-card)',
            borderRadius: 12,
            border: useOverlayTemplate ? 'none' : '1px solid var(--border-color)',
            padding: useOverlayTemplate ? 0 : '12px 14px 34px'
        }}>
            {useOverlayTemplate && <div style={backgroundStyle} />}

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
                            hide={useOverlayTemplate}
                            stroke="var(--text-secondary)"
                            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                            tickFormatter={(value) => config ? `${value}m` : value}
                        />

                        <YAxis
                            domain={config ? config.yDomain : ['auto', 'auto']}
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
                zIndex: 2
            }}>
                {matchingCurve
                    ? `Template officiel : ${measureInfo.label} (${matchingCurve.gender === 'male' ? 'G' : matchingCurve.gender === 'female' ? 'F' : 'M'})`
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
