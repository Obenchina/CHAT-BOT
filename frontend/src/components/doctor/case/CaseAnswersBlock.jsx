import React, { useMemo } from 'react';
import { getAuthUploadUrl } from '../../../constants/config';

function CaseAnswersBlock({ answers }) {
    // Group answers by section
    const groupedAnswers = useMemo(() => {
        if (!answers || answers.length === 0) return {};
        
        console.log('CaseAnswersBlock: Rendering answers', answers);
        
        const groups = {};
        answers.forEach(ans => {
            const secName = ans.section_name || ans.sectionName || 'Général';
            if (!groups[secName]) groups[secName] = [];
            groups[secName].push(ans);
        });
        return groups;
    }, [answers]);

    const sections = Object.keys(groupedAnswers);

    return (
        <div className="card">
            <div className="card-header border-b" style={{ paddingBottom: 'var(--space-sm)' }}>
                <h2 className="card-title">📋 Questionnaire</h2>
            </div>
            <div className="card-body" style={{ padding: '0' }}>
                {answers && answers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {sections.map((section, sIndex) => (
                            <div key={`section-${sIndex}`}>
                                {/* Section Header */}
                                <div style={{ 
                                    padding: 'var(--space-sm) var(--space-lg)', 
                                    background: 'var(--bg-elevated)', 
                                    borderBottom: '1px solid var(--border-color)',
                                    borderTop: sIndex > 0 ? '2px solid var(--border-color)' : 'none',
                                    fontWeight: 'bold',
                                    color: 'var(--primary)'
                                }}>
                                    {section}
                                </div>
                                
                                {/* Section Questions */}
                                {groupedAnswers[section].map((answer, index) => (
                                    <div key={answer.id || index} style={{
                                        padding: 'var(--space-lg)',
                                        borderBottom: index < groupedAnswers[section].length - 1 ? '1px solid var(--border-color)' : 'none',
                                        background: index % 2 === 0 ? 'transparent' : 'var(--bg-elevated)'
                                    }}>
                                        <div style={{ fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                                            <span style={{ color: 'var(--primary)', marginRight: '8px' }}>Q.</span>
                                            {answer.question_text || answer.questionText}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                                            {/* Audio player if audio exists */}
                                            {(answer.audio_path || answer.audioPath) && (
                                                <div style={{ background: 'var(--bg-card)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', display: 'inline-block', width: 'fit-content' }}>
                                                    <audio controls style={{ height: '36px', width: '250px' }}>
                                                        <source src={getAuthUploadUrl(answer.audio_path || answer.audioPath)} type="audio/webm" />
                                                    </audio>
                                                </div>
                                            )}

                                            {/* Transcribed text (Right aligned for Arabic) */}
                                            <div style={{
                                                color: 'var(--text-secondary)',
                                                padding: 'var(--space-md)',
                                                background: 'var(--bg-card)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border-color)',
                                                fontStyle: (answer.text_answer !== null && answer.text_answer !== undefined || answer.textAnswer !== null && answer.textAnswer !== undefined || answer.transcribed_text || answer.transcribedText) ? 'normal' : 'italic',
                                                direction: 'rtl',
                                                textAlign: 'right',
                                                fontSize: '0.95rem',
                                                lineHeight: '1.6'
                                            }}>
                                                {((answer.text_answer !== null && answer.text_answer !== undefined) ? answer.text_answer : 
                                                  (answer.textAnswer !== null && answer.textAnswer !== undefined) ? answer.textAnswer : 
                                                  (answer.transcribed_text || answer.transcribedText)) ||
                                                    (answer.audio_path || answer.audioPath ? 'في انتظار نسخ النص...' : 'لا توجد إجابة')}
                                                
                                                {/* Optional Unit if it's a clinical measure linked answer */}
                                                {(answer.text_answer || answer.textAnswer) && answer.answer_type === 'number' && answer.question_text?.toLowerCase().includes('kg') && ' kg'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center" style={{ padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
                        Aucune réponse enregistrée
                    </div>
                )}
            </div>
        </div>
    );
}

export default CaseAnswersBlock;
