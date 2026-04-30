import { useNavigate } from 'react-router-dom';

const STATUS_LABELS = {
  in_progress: 'En cours',
  submitted:   'À examiner',
  reviewed:    'Examiné',
  closed:      'Clôturé',
};

function calcAge(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return `${years} ans`;
}

function initials(first, last) {
  return `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase();
}

export default function CaseTopBar({ caseData, autoSaving, onAutoSavedAt }) {
  const navigate = useNavigate();
  const p = caseData?.patient || {};
  const status = caseData?.status || 'in_progress';

  return (
    <header className="case-topbar">
      <button className="case-topbar__back" onClick={() => navigate(-1)}>
        ← Retour
      </button>

      <div className="case-topbar__patient">
        <div className="case-topbar__avatar">{initials(p.first_name, p.last_name)}</div>
        <div className="case-topbar__info">
          <div className="case-topbar__name">
            {(p.first_name || '') + ' ' + (p.last_name || '')}
          </div>
          <div className="case-topbar__meta">
            {p.gender && <span>{p.gender === 'male' ? 'Masculin' : 'Féminin'}</span>}
            {p.date_of_birth && <span>{calcAge(p.date_of_birth)}</span>}
            <span>Cas #{caseData?.id}</span>
          </div>
        </div>
      </div>

      {autoSaving && (
        <span className="diagnostic__autosave" style={{ marginRight: 'var(--space-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning-500)', display: 'inline-block' }} />
          Sauvegarde…
        </span>
      )}
      {!autoSaving && onAutoSavedAt && (
        <span className="diagnostic__autosave" style={{ marginRight: 'var(--space-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success-500)', display: 'inline-block' }} />
          Enregistré
        </span>
      )}

      <span className={`case-topbar__status case-topbar__status--${status}`}>
        {STATUS_LABELS[status] || status}
      </span>
    </header>
  );
}
