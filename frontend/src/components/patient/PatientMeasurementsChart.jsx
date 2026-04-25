import React, { useMemo, useState, useEffect } from 'react';
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
 * PatientMeasurementsChart — Template-based Calibration Version
 * Uses doctor's calibrated curves (template_config) for pixel-perfect overlay.
 */
function PatientMeasurementsChart({ data, measureKey, patient }) {
    const [matchingCurve, setMatchingCurve] = useState(null);
    const measureInfo = CLINICAL_MEASURE_LABELS[measureKey] || { label: measureKey, unit: '' };

    useEffect(() => {
        async function fetchCurves() {
            try {
                const res = await doctorService.getGrowthCurves();
                if (res.success && res.data) {
                    const curve = res.data.find(c =>
                        c.measure_key === measureKey &&
                        (c.gender === patient?.gender || c.gender === 'both') &&
                        c.is_calibrated &&
                        c.template_config // Must have template_config
                    );
                    setMatchingCurve(curve);
                }
            } catch (error) {
                console.error('Error fetching growth curves:', error);
            }
        }
        fetchCurves();
    }, [measureKey, patient?.gender]);

    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        const birthDate = new Date(patient?.birthDate || patient?.birth_date || patient?.date_of_birth);
        if (isNaN(birthDate.getTime())) return [];

        return data.map(item => {
            const dateObj = new Date(item.date);
            const ageInMonths = (dateObj - birthDate) / (1000 * 60 * 60 * 24 * 30.4375);
            
            return {
                ...item,
                displayDate: dateObj.toLocaleDateString(),
                ageInMonths: parseFloat(ageInMonths.toFixed(2)),
                value: Number(item.value)
            };
        }).sort((a, b) => a.ageInMonths - b.ageInMonths);
    }, [data, patient]);

    // Calculate axis domains from template_config for precise overlay
    const config = useMemo(() => {
        if (!matchingCurve?.template_config) return null;
        const tc = matchingCurve.template_config;
        return {
            xDomain: [tc.min_age, tc.max_age],
            yDomain: [tc.min_y, tc.max_y],
            plotArea: tc.plot_area || { left: 0, top: 0, right: 100, bottom: 100 }
        };
    }, [matchingCurve]);

    if (!chartData || chartData.length === 0) {
        return <div className="empty-chart">Aucune donnée pour {measureInfo.label}.</div>;
    }

    // Calculate chart margins to align Recharts plot area with the background image plot area
    const chartMargins = useMemo(() => {
        if (!config) return { top: 20, right: 30, left: 40, bottom: 20 };
        // plot_area is in percentage of the image
        const { plotArea } = config;
        return {
            top: 0,
            right: 0,
            left: 0,
            bottom: 0
        };
    }, [config]);

    // The background image positioning must align the plot_area with the chart area
    const backgroundStyle = useMemo(() => {
        if (!config || !matchingCurve) return {};
        
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
            borderRadius: '12px'
        };
    }, [config, matchingCurve]);

    return (
        <div className="measurement-chart-container" style={{
            width: '100%',
            height: '500px',
            position: 'relative',
            background: config ? 'transparent' : '#f8f9fa',
            borderRadius: '12px',
            padding: '0'
        }}>
            {matchingCurve && <div style={backgroundStyle} />}
            
            <div style={{
                position: config ? 'absolute' : 'relative',
                top: config ? `${config.plotArea.top}%` : 0,
                left: config ? `${config.plotArea.left}%` : 0,
                width: config ? `${config.plotArea.right - config.plotArea.left}%` : '100%',
                height: config ? `${config.plotArea.bottom - config.plotArea.top}%` : '100%',
                zIndex: 1
            }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={chartMargins}
                    >
                        <CartesianGrid strokeDasharray="3 3" opacity={config ? 0 : 0.5} />
                        
                        <XAxis 
                            dataKey={config ? "ageInMonths" : "displayDate"}
                            type={config ? "number" : "category"}
                            domain={config ? config.xDomain : undefined}
                            hide={!!config}
                            tickFormatter={v => config ? `${v}m` : v}
                        />
                        
                        <YAxis 
                            domain={config ? config.yDomain : ['auto', 'auto']}
                            hide={!!config}
                        />
                        
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px', border: '1px solid var(--primary)' }}
                            labelFormatter={(v) => config ? `Âge: ${v} mois` : v}
                            formatter={(value) => [`${value} ${measureInfo.unit || ''}`, measureInfo.label]}
                        />
                        
                        <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="var(--primary)" 
                            strokeWidth={4}
                            dot={{ r: 6, fill: 'var(--primary)', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 8 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            {matchingCurve && (
                <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '0.7rem', color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.85)', padding: '2px 8px', borderRadius: '4px', zIndex: 2 }}>
                    ✓ Courbe calibrée : {measureInfo.label} ({matchingCurve.gender === 'male' ? 'G' : matchingCurve.gender === 'female' ? 'F' : 'M'})
                </div>
            )}
        </div>
    );
}

export default PatientMeasurementsChart;
