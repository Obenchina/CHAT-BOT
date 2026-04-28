import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function groupBySection(answers = []) {
  const map = new Map();
  for (const a of answers) {
    const sec = a.section_name || a.sectionName || 'Sans section';
    if (!map.has(sec)) map.set(sec, []);
    map.get(sec).push(a);
  }
  return Array.from(map.entries());
}

function renderAnswer(a) {
  const type = a.answer_type_snapshot || a.answer_type || a.answerType;
  const text = a.text_answer ?? a.transcribed_text ?? a.textAnswer ?? a.transcribedText ?? '';

  if (type === 'yes_no') {
    const v = String(text).toLowerCase();
    if (v === 'yes' || v === 'oui' || v === 'true') return <span className="anamnesis__chip anamnesis__chip--yes">Oui</span>;
    if (v === 'no' || v === 'non' || v === 'false') return <span className="anamnesis__chip anamnesis__chip--no">Non</span>;
  }
  if (type === 'choices') {
    let arr = text;
    try { if (typeof text === 'string' && text.startsWith('[')) arr = JSON.parse(text); } catch { /* ignore */ }
    const list = Array.isArray(arr) ? arr : String(text).split(',').map(s => s.trim()).filter(Boolean);
    return (
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {list.map((c, i) => <span key={i} className="anamnesis__chip">{c}</span>)}
      </span>
    );
  }
  if (type === 'voice') return <span className="anamnesis__a anamnesis__a--quote">« {text || 'Pas de transcription'} »</span>;
  if (!text) return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>;
  return <span className="anamnesis__a">{text}</span>;
}

export default function AnamnesisBlock({ caseData }) {
  const answers = caseData?.answers || [];
  // exclude clinical_measure questions (number with measure) — those go to MeasuresBlock
  const filtered = useMemo(() => answers.filter(a => {
    const cm = a.clinical_measure || a.clinicalMeasure;
    return !cm || cm === 'none';
  }), [answers]);
  const sections = useMemo(() => groupBySection(filtered), [filtered]);

  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggle = (sec) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(sec)) next.delete(sec); else next.add(sec);
      return next;
    });
  };

  return (
    <section className="case-block" id="block-anamnesis">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>📋</span>
          Anamnèse
        </h2>
      </div>

      {filtered.length === 0 ? (
        <div className="rx__empty">Aucune réponse enregistrée.</div>
      ) : (
        <div className="anamnesis__sections">
          {sections.map(([sec, items]) => {
            const isOpen = !collapsed.has(sec);
            return (
              <div className="anamnesis__section" key={sec}>
                <button className="anamnesis__section-header" onClick={() => toggle(sec)} aria-expanded={isOpen}>
                  <span className="anamnesis__section-name">
                    <span style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>›</span>
                    {sec}
                    <span className="anamnesis__section-count">{items.length}</span>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="qa"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="anamnesis__qa">
                        {items.map((it, i) => (
                          <div key={it.id || i}>
                            <div className="anamnesis__q">{it.question_text_snapshot || it.question_text || ''}</div>
                            <div style={{ marginTop: 4 }}>{renderAnswer(it)}</div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
