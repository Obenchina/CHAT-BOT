import React from 'react';

function AiSummaryBlock({ aiAnalysis }) {
    if (!aiAnalysis || (!aiAnalysis.analysis && !aiAnalysis.summary)) return null;

    const analysisText = aiAnalysis.analysis || aiAnalysis.summary || '';

    // Hard limit AI Analysis to 4 lines maximum to prevent overwhelming the interface
    const getClampedAnalysis = (text) => {
        if (!text) return '';
        // Split by sentences or newlines
        const sentences = text.split(/(?<=[.!?])\s+|\n/);
        if (sentences.length <= 4) return text;
        return sentences.slice(0, 4).join(' ') + '...';
    };

    return (
        <div className="card mb-6" style={{ borderLeft: '4px solid var(--primary)', background: 'var(--primary-50)' }}>
            <div className="card-header border-b border-primary-100" style={{ paddingBottom: 'var(--space-sm)' }}>
                <h2 className="card-title text-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🤖</span> Analyse IA
                </h2>
            </div>
            <div className="card-body">
                <div style={{
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                    fontSize: '0.95rem',
                    fontStyle: 'italic',
                    whiteSpace: 'pre-line',
                    direction: 'rtl',
                    textAlign: 'right',
                    marginBottom: (aiAnalysis.diagnoses?.length > 0 || aiAnalysis.hypotheses?.length > 0) ? 'var(--space-md)' : '0'
                }}>
                    {getClampedAnalysis(analysisText)}
                </div>

                {/* Support both 'diagnoses' and 'hypotheses' from different versions of AI prompt */}
                {(aiAnalysis.diagnoses || aiAnalysis.hypotheses) && (aiAnalysis.diagnoses?.length > 0 || aiAnalysis.hypotheses?.length > 0) && (
                    <div style={{ marginTop: 'var(--space-md)', direction: 'rtl' }}>
                        <div style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: '600', 
                            color: 'var(--primary-700)', 
                            marginBottom: 'var(--space-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <span>🔬</span> Diagnostics:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(aiAnalysis.diagnoses || aiAnalysis.hypotheses).map((diag, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(255, 255, 255, 0.5)',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.9rem',
                                    border: '1px solid var(--primary-100)',
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{diag.name || diag.label}</span>
                                    {(diag.probability || diag.percentage) && (
                                        <span style={{ 
                                            fontWeight: '700', 
                                            color: 'var(--primary)',
                                            background: 'var(--primary-100)',
                                            padding: '2px 8px',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem'
                                        }}>
                                            {diag.probability || diag.percentage}%
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AiSummaryBlock;
