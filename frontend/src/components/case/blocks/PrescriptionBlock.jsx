import { useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import doctorService from '../../../services/doctorService';

const DOCUMENT_TABS = [
  { key: 'ordonnance', icon: '💊', label: 'Ordonnance' },
  { key: 'analyses', icon: '🧪', label: 'Analyses' },
  { key: 'lettre', icon: '✉️', label: 'Lettre' },
];

const empty = (overrides = {}) => ({
  id: Date.now() + Math.random(),
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  ...overrides,
});

function mapMedication(med = {}) {
  return empty({
    name: med.name || '',
    dosage: med.dosage || med.default_dosage || '',
    frequency: med.frequency || med.default_frequency || '',
    duration: med.duration || med.default_duration || '',
  });
}

export default function PrescriptionBlock({
  medications = [],
  onChange,
  onSuggestAi,
  suggestingAi,
  onDownloadDocument,
  downloading,
  activeDocumentType = 'ordonnance',
  onDocumentTypeChange,
  allAnalyses = [],
  selectedAnalyses = [],
  onToggleAnalysis,
  letterContent = '',
  onLetterContentChange,
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const update = (idx, field, value) => {
    const next = medications.slice();
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const remove = (idx) => onChange(medications.filter((_, i) => i !== idx));
  const add = (med = {}) => onChange([...medications, mapMedication(med)]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearch(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await doctorService.searchMedications(value.trim());
        if (res?.success) {
          setResults(Array.isArray(res.data) ? res.data : []);
          setShowResults(true);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Medication search error:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const handleSelectMedication = (med) => {
    add(med);
    setSearch('');
    setResults([]);
    setShowResults(false);
  };

  const downloadDisabled =
    downloading ||
    (activeDocumentType === 'ordonnance' && medications.length === 0) ||
    (activeDocumentType === 'analyses' && selectedAnalyses.length === 0) ||
    (activeDocumentType === 'lettre' && !letterContent.trim());

  return (
    <section className="case-block" id="block-prescription">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>💊</span>
          Ordonnance
        </h2>
        <div className="case-block__actions">
          {activeDocumentType === 'ordonnance' && (
            <button className="btn btn--ghost btn--small" onClick={onSuggestAi} disabled={suggestingAi}>
              ✨ {suggestingAi ? 'Suggestion…' : 'Suggérer (IA)'}
            </button>
          )}
          <button
            className="btn btn--primary btn--small"
            onClick={() => onDownloadDocument?.(activeDocumentType)}
            disabled={downloadDisabled}
          >
            ⬇ {downloading ? 'PDF…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="rx__tabs" role="tablist" aria-label="Type de document">
        {DOCUMENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeDocumentType === tab.key}
            className={`rx__tab${activeDocumentType === tab.key ? ' rx__tab--active' : ''}`}
            onClick={() => onDocumentTypeChange?.(tab.key)}
          >
            <span aria-hidden>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeDocumentType === 'ordonnance' && (
        <>
          <div className="rx__searchbar">
            <div className="rx__search-wrap" ref={searchRef}>
              <input
                className="rx__search-input"
                type="text"
                value={search}
                onChange={handleSearchChange}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="Rechercher un médicament dans le catalogue…"
              />
              {searching && <span className="rx__search-loading">…</span>}

              {showResults && (
                <div className="rx__results">
                  {results.length > 0 ? (
                    results.map((med, idx) => (
                      <button
                        type="button"
                        key={med.id || `${med.name}-${idx}`}
                        className="rx__result"
                        onClick={() => handleSelectMedication(med)}
                      >
                        <span className="rx__result-name">{med.name}</span>
                        {(med.default_dosage || med.default_frequency || med.default_duration) && (
                          <span className="rx__result-meta">
                            {[med.default_dosage, med.default_frequency, med.default_duration].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    search.trim().length >= 2 && !searching && (
                      <div className="rx__result-empty">Aucun médicament trouvé</div>
                    )
                  )}
                </div>
              )}
            </div>
            <button className="btn btn--ghost btn--small" onClick={() => add()}>+ Ajouter manuellement</button>
          </div>

          {medications.length === 0 ? (
            <div className="rx__empty">Aucun médicament. Ajoutez manuellement ou utilisez la suggestion IA.</div>
          ) : (
            <div className="rx__list">
              <AnimatePresence initial={false}>
                {medications.map((m, idx) => (
                  <Motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="rx__item"
                  >
                    <span className="rx__drag" aria-hidden>≡</span>
                    <div className="rx__item-body">
                      <div className="rx__item-title">
                        <input
                          type="text"
                          value={m.name || ''}
                          onChange={(e) => update(idx, 'name', e.target.value)}
                          placeholder="Nom du médicament"
                        />
                      </div>
                      <div className="rx__item-row">
                        <input
                          type="text"
                          value={m.dosage || ''}
                          onChange={(e) => update(idx, 'dosage', e.target.value)}
                          placeholder="Posologie (ex. 500 mg)"
                        />
                        <input
                          type="text"
                          value={m.frequency || ''}
                          onChange={(e) => update(idx, 'frequency', e.target.value)}
                          placeholder="Fréquence (ex. 3×/jour)"
                        />
                        <input
                          type="text"
                          value={m.duration || ''}
                          onChange={(e) => update(idx, 'duration', e.target.value)}
                          placeholder="Durée (ex. 5 jours)"
                        />
                      </div>
                    </div>
                    <button className="rx__remove" onClick={() => remove(idx)} aria-label="Supprimer">×</button>
                  </Motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {activeDocumentType === 'analyses' && (
        <div className="rx__document-panel">
          {allAnalyses.length > 0 ? (
            <div className="rx__analysis-grid">
              {allAnalyses.map((analysis) => {
                const selected = selectedAnalyses.includes(analysis);
                return (
                  <label key={analysis} className={`rx__analysis${selected ? ' rx__analysis--selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleAnalysis?.(analysis)}
                    />
                    <span>{analysis}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rx__empty">Aucune analyse configurée dans les paramètres.</div>
          )}
        </div>
      )}

      {activeDocumentType === 'lettre' && (
        <div className="rx__document-panel">
          <textarea
            className="rx__letter"
            value={letterContent}
            onChange={(event) => onLetterContentChange?.(event.target.value)}
            rows={12}
            placeholder="Cher confrère,..."
          />
        </div>
      )}
    </section>
  );
}
