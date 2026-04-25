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
                    textAlign: 'right'
                }}>
                    {getClampedAnalysis(analysisText)}
                </div>
            </div>
        </div>
    );
}

export default AiSummaryBlock;
