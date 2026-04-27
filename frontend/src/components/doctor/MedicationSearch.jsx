import React, { useState, useRef, useEffect } from 'react';
import doctorService from '../../services/doctorService';

function MedicationSearch({ onSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleInputChange(e) {
        const val = e.target.value;
        setQuery(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (val.length < 2) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await doctorService.searchMedications(val);
                if (res.success) {
                    setResults(res.data || []);
                    setShowDropdown(true);
                }
            } catch (err) {
                console.error('Search error:', err);
                setResults([]);
            }
            setSearching(false);
        }, 300);
    }

    function handleSelect(med) {
        onSelect({
            name: med.name,
            dosage: med.default_dosage || '',
            frequency: med.default_frequency || '',
            duration: med.default_duration || ''
        });
        setQuery('');
        setShowDropdown(false);
        setResults([]);
    }

    return (
        <div ref={wrapperRef} style={{ position: 'relative', marginBottom: 'var(--space-sm)' }}>
            <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
                placeholder="Rechercher un médicament dans votre liste..."
                className="form-input"
                style={{
                    width: '100%',
                    padding: 'var(--space-sm) var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.9rem'
                }}
            />
            {searching && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ...
                </span>
            )}

            {showDropdown && results.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                }}>
                    {results.map(med => (
                        <div
                            key={med.id}
                            onClick={() => handleSelect(med)}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-light, #eee)',
                                transition: 'background 0.15s',
                                color: 'var(--text-primary)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{med.name}</div>
                            {(med.default_dosage || med.default_frequency || med.default_duration) && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {[med.default_dosage, med.default_frequency, med.default_duration].filter(Boolean).join(' - ')}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showDropdown && query.length >= 2 && results.length === 0 && !searching && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-sm) var(--space-md)',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    zIndex: 1000
                }}>
                    Aucun médicament trouvé pour "{query}"
                </div>
            )}
        </div>
    );
}

export default MedicationSearch;
