import { useEffect, useMemo, useState } from 'react';
import PatientMeasurementsChart from '../../patient/PatientMeasurementsChart';
import patientService from '../../../services/patientService';
import { CLINICAL_MEASURE_LABELS } from '../../../constants/config';

/**
 * Charts block for the Case Details page.
 * Loads the patient's longitudinal measurements and renders an
 * interactive growth chart per available measure (Poids, Taille, PC, Temp, TA).
 */
export default function ChartsBlock({ caseData }) {
  const patient = caseData?.patient;
  const patientId = patient?.id;

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMeasure, setSelectedMeasure] = useState(null);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await patientService.getMeasurements(patientId);
        if (cancelled) return;
        if (res?.success && res.data && typeof res.data === 'object') {
          // Keep only measures that actually contain data points
          const filtered = {};
          for (const key of Object.keys(res.data)) {
            const arr = res.data[key];
            if (Array.isArray(arr) && arr.length > 0) filtered[key] = arr;
          }
          setData(filtered);
          const keys = Object.keys(filtered);
          if (keys.length > 0) setSelectedMeasure(keys[0]);
        } else {
          setData({});
        }
      } catch (err) {
        console.error('Charts load error:', err);
        if (!cancelled) setError("Impossible de charger les courbes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const measureKeys = useMemo(() => Object.keys(data), [data]);
  const hasData = measureKeys.length > 0;

  return (
    <section className="case-block" id="block-charts">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>📈</span>
          Courbes pédiatriques
        </h2>
        {hasData && (
          <span className="case-block__hint" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Évolution sur {Object.values(data).reduce((acc, arr) => acc + arr.length, 0)} mesure(s)
          </span>
        )}
      </div>

      {loading && (
        <div className="rx__empty">Chargement des mesures…</div>
      )}

      {!loading && error && (
        <div className="rx__empty" style={{ color: 'var(--color-danger-600)' }}>{error}</div>
      )}

      {!loading && !error && !hasData && (
        <div className="rx__empty">
          Aucune mesure longitudinale enregistrée pour ce patient.
          <br />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Les mesures saisies dans l'entretien (poids, taille, PC, T°, TA) apparaîtront ici sur la courbe de référence configurée dans Paramètres → Courbes pédiatriques.
          </span>
        </div>
      )}

      {!loading && !error && hasData && (
        <>
          {/* Measure tabs */}
          <div
            role="tablist"
            aria-label="Type de mesure"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {measureKeys.map((key) => {
              const label = CLINICAL_MEASURE_LABELS[key]?.label || key;
              const unit = CLINICAL_MEASURE_LABELS[key]?.unit || '';
              const active = key === selectedMeasure;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedMeasure(key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: active ? 'var(--color-brand-500)' : 'var(--color-border-subtle)',
                    background: active ? 'var(--color-brand-500)' : 'var(--color-surface-1)',
                    color: active ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    transition: 'background .15s ease, color .15s ease, border-color .15s ease',
                  }}
                >
                  {label}{unit ? ` (${unit})` : ''} · {data[key]?.length ?? 0}
                </button>
              );
            })}
          </div>

          {/* Active chart */}
          {selectedMeasure && data[selectedMeasure] && (
            <div role="tabpanel" aria-label={CLINICAL_MEASURE_LABELS[selectedMeasure]?.label || selectedMeasure}>
              <PatientMeasurementsChart
                data={data[selectedMeasure]}
                measureKey={selectedMeasure}
                patient={patient}
                height={520}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
