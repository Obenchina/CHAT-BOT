import { useMemo } from 'react';

const LABELS = {
  weight:            { fr: 'Poids',           unit: 'kg' },
  height:            { fr: 'Taille',          unit: 'cm' },
  head_circumference:{ fr: 'Périmètre crânien', unit: 'cm' },
  temperature:       { fr: 'Température',     unit: '°C' },
  blood_pressure:    { fr: 'Tension',         unit: 'mmHg' },
};

function classify(measure, value) {
  if (value == null || value === '' || isNaN(Number(value))) {
    if (measure === 'blood_pressure' && typeof value === 'string' && /^\d+\/\d+$/.test(value)) {
      const [s, d] = value.split('/').map(Number);
      if (s >= 90 && s <= 130 && d >= 60 && d <= 85) return 'normal';
      if (s > 140 || d > 90) return 'danger';
      return 'warn';
    }
    return 'none';
  }
  const v = Number(value);
  switch (measure) {
    case 'temperature':
      if (v >= 36 && v <= 37.5) return 'normal';
      if (v >= 38 && v < 39) return 'warn';
      if (v >= 39) return 'danger';
      if (v < 36) return 'warn';
      return 'normal';
    case 'weight':
      if (v <= 0 || v > 300) return 'danger';
      return 'normal';
    case 'height':
      if (v <= 0 || v > 250) return 'danger';
      return 'normal';
    case 'head_circumference':
      if (v <= 0 || v > 70) return 'danger';
      return 'normal';
    default:
      return 'none';
  }
}

const STATUS_LABEL = {
  normal: 'Normal',
  warn:   '⚠ Élevé',
  danger: '🚨 Critique',
  none:   '—',
};

export default function MeasuresBlock({ caseData }) {
  const answers = caseData?.answers || [];
  const measures = useMemo(() => {
    return answers
      .filter(a => {
        const cm = a.clinical_measure || a.clinicalMeasure;
        return cm && cm !== 'none';
      })
      .map(a => {
        const measure = a.clinical_measure || a.clinicalMeasure;
        const value = a.text_answer ?? a.transcribed_text ?? '';
        return {
          id: a.id,
          measure,
          label: LABELS[measure]?.fr || measure,
          unit: LABELS[measure]?.unit || '',
          value,
          status: classify(measure, value),
          taken_at: a.created_at || a.createdAt,
        };
      });
  }, [answers]);

  return (
    <section className="case-block" id="block-measures">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>📊</span>
          Mesures cliniques
        </h2>
      </div>

      {measures.length === 0 ? (
        <div className="rx__empty">Aucune mesure clinique enregistrée.</div>
      ) : (
        <table className="measures-table">
          <thead>
            <tr>
              <th>Mesure</th>
              <th>Valeur</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {measures.map(m => (
              <tr key={m.id}>
                <td>{m.label}</td>
                <td className="measure-value">{m.value || '—'} {m.unit}</td>
                <td><span className={`measure-status measure-status--${m.status}`}>{STATUS_LABEL[m.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
