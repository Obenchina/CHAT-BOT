import React, { useMemo, useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { CLINICAL_MEASURE_LABELS, getAuthUploadUrl } from '../../constants/config';
import doctorService from '../../services/doctorService';

/**
 * PatientMeasurementsChart - Precision Version
 * Uses doctor's calibrated curves to ensure 100% alignment.
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
                        c.is_calibrated // STRICTURE: Only calibrated curves
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
        const birthDate = new Date(patient?.birthDate || patient?.birth_date);
        if (isNaN(birthDate.getTime())) return [];

        return data.map(item => {
            const dateObj = new Date(item.date);
            // ageInMonths calculated with precision
            const ageInMonths = (dateObj - birthDate) / (1000 * 60 * 60 * 24 * 30.4375);
            
            return {
                ...item,
                displayDate: dateObj.toLocaleDateString(),
                ageInMonths: parseFloat(ageInMonths.toFixed(2)),
                value: Number(item.value)
            };
        }).sort((a, b) => a.ageInMonths - b.ageInMonths);
    }, [data, patient]);

    // Calculate axis domains based on calibration to ensure 100% alignment
    const domains = useMemo(() => {
        if (!matchingCurve) return { x: ['auto', 'auto'], y: ['auto', 'auto'] };

        const { p1_x, p1_y, p1_val_x, p1_val_y, p2_x, p2_y, p2_val_x, p2_val_y } = matchingCurve;

        // Linear extrapolation to find values at 0% and 100% of the image
        const getEdgeValues = (p1, p2, v1, v2) => {
            const slope = (v2 - v1) / (p2 - p1);
            const vMin = v1 - p1 * slope;
            const vMax = v1 + (100 - p1) * slope;
            return [vMin, vMax];
        };

        const xDomain = getEdgeValues(p1_x, p2_x, p1_val_x, p2_val_x);
        const yDomain = getEdgeValues(p1_y, p2_y, p1_val_y, p2_val_y).reverse(); // Y is usually inverted in pixels (0 is top)

        return { x: xDomain, y: yDomain };
    }, [matchingCurve]);

    if (!chartData || chartData.length === 0) {
        return <div className="empty-chart">Aucune donnée pour {measureInfo.label}.</div>;
    }

    return (
        <div className="measurement-chart-container" style={{ width: '100%', height: '500px', position: 'relative', background: '#f8f9fa', borderRadius: '12px', padding: '10px' }}>
            {matchingCurve && (
                <div style={{
                    position: 'absolute',
                    top: '10px', bottom: '10px', left: '10px', right: '10px',
                    backgroundImage: `url(${getAuthUploadUrl(matchingCurve.file_path)})`,
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.9,
                    zIndex: 0
                }} />
            )}
            
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }} // No margin to align with the div edges
                >
                    <CartesianGrid strokeDasharray="3 3" opacity={matchingCurve ? 0 : 0.5} />
                    
                    <XAxis 
                        dataKey={matchingCurve ? "ageInMonths" : "displayDate"}
                        type={matchingCurve ? "number" : "category"}
                        domain={domains.x}
                        hide={!!matchingCurve} // Hide axis if we have the PDF background which has its own axis
                    />
                    
                    <YAxis 
                        domain={domains.y}
                        hide={!!matchingCurve}
                    />
                    
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px', border: '1px solid var(--primary)' }}
                        labelFormatter={(v) => matchingCurve ? `Âge: ${v} mois` : v}
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
            
            {matchingCurve && (
                <div style={{ position: 'absolute', bottom: 15, right: 15, fontSize: '0.7rem', color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px' }}>
                    ✓ Source de vérité : {matchingCurve.measure_key} ({matchingCurve.gender})
                </div>
            )}
        </div>
    );
}

export default PatientMeasurementsChart;
