import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import doctorService from '../../services/doctorService';
import caseService from '../../services/caseService';
import { showError, showConfirm } from '../../utils/toast';
import '../../styles/dashboard.css';

import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InboxIcon from '@mui/icons-material/Inbox';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';

/* -------------------------------------------------------------- */
/* Helpers                                                         */
/* -------------------------------------------------------------- */
function getInitials(p) {
  if (!p) return '.';
  const f = (p.firstName || p.first_name || p.patient_first_name || '').trim();
  const l = (p.lastName || p.last_name || p.patient_last_name || '').trim();
  const name = (p.patientName || p.patient_name || '').trim();
  if (f || l) return ((f[0] || '') + (l[0] || '')).toUpperCase() || '.';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '.';
}
function getFullName(p) {
  if (!p) return 'Patient';
  return (
    p.patientName ||
    p.patient_name ||
    `${p.firstName || p.first_name || p.patient_first_name || ''} ${p.lastName || p.last_name || p.patient_last_name || ''}`.trim() ||
    'Patient'
  );
}
function getCasePatient(c) {
  return c?.patient || c || null;
}
function getDoctorFullName(doctor) {
  if (!doctor) return '';
  return `${doctor.firstName || doctor.first_name || ''} ${doctor.lastName || doctor.last_name || ''}`.trim();
}
function getCaseDate(c) {
  return c?.submittedAt || c?.submitted_at || c?.reviewedAt || c?.reviewed_at || c?.date || c?.createdAt || c?.created_at || null;
}
function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}
function statNumber(value, fallback = 0) {
  const n = Number(value ?? fallback ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function relativeTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function statusInfo(status) {
  const map = {
    in_progress: { label: 'En cours',     dot: 'var(--color-warning-500)', tone: 'warning' },
    submitted:   { label: 'À examiner',   dot: 'var(--color-info-500)',    tone: 'info' },
    reviewed:    { label: 'Validé',       dot: 'var(--color-success-500)', tone: 'success' },
    closed:      { label: 'Clôturé',      dot: 'var(--color-text-muted)',  tone: 'gray' },
  };
  return map[status] || map.in_progress;
}
function groupByDay(items) {
  const today = new Date(); today.setHours(0,0,0,0);
  const buckets = { today: [], yesterday: [], week: [], earlier: [] };
  for (const it of items) {
    const d = new Date(getCaseDate(it) || Date.now());
    d.setHours(0,0,0,0);
    const diff = (today - d) / 86400000;
    if (diff <= 0) buckets.today.push(it);
    else if (diff <= 1) buckets.yesterday.push(it);
    else if (diff <= 7) buckets.week.push(it);
    else buckets.earlier.push(it);
  }
  return buckets;
}

/* -------------------------------------------------------------- */
/* Component                                                       */
/* -------------------------------------------------------------- */
export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('submitted');
  const [query, setQuery] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [statsRes, casesRes] = await Promise.all([
        doctorService.getDashboard(),
        caseService.getAll(null),
      ]);
      if (statsRes.success) {
        setStats(statsRes.data.stats || statsRes.data);
        setDoctor(statsRes.data.doctor || null);
      }
      if (casesRes.success) setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id) {
    const ok = await showConfirm('Supprimer ce dossier ?');
    if (!ok) return;
    try {
      const r = await caseService.deleteCase(id);
      if (r.success) {
        setCases((p) => p.filter((c) => c.id !== id));
        const s = await doctorService.getDashboard();
        if (s.success) {
          setStats(s.data.stats || s.data);
          setDoctor(s.data.doctor || null);
        }
      }
    } catch {
      showError('Erreur lors de la suppression');
    }
  }

  const filtered = useMemo(() => {
    let list = Array.isArray(cases) ? [...cases] : [];
    if (filter !== 'all') list = list.filter((c) => c.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => {
        const name = getFullName(getCasePatient(c)).toLowerCase();
        return name.includes(q) || (c.complaint || '').toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => new Date(getCaseDate(b) || 0) - new Date(getCaseDate(a) || 0));
    return list;
  }, [cases, filter, query]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Bonsoir';
    if (h < 18) return 'Bonjour';
    return 'Bonsoir';
  }, []);
  const today = useMemo(
    () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    []
  );

  const buckets = useMemo(() => groupByDay(filtered), [filtered]);

  const doctorName = getDoctorFullName(doctor);
  const pendingCount = statNumber(stats?.pendingCases, (cases || []).filter((c) => c.status === 'submitted').length);
  const totalMetrics = useMemo(() => ({
    totalCases: statNumber(stats?.totalCases, (cases || []).length),
    totalPatients: statNumber(stats?.totalPatients, 0),
    reviewedCases: statNumber(stats?.reviewedCases, (cases || []).filter((c) => c.status === 'reviewed').length),
    totalAssistants: statNumber(stats?.totalAssistants, 0),
  }), [cases, stats]);
  const todayMetrics = useMemo(() => ({
    createdCases: statNumber(
      stats?.todayCreatedCases,
      (cases || []).filter((c) => isToday(c.createdAt || c.created_at)).length
    ),
    submittedCases: statNumber(
      stats?.todaySubmittedCases,
      (cases || []).filter((c) => isToday(c.submittedAt || c.submitted_at)).length
    ),
    reviewedCases: statNumber(
      stats?.todayReviewedCases,
      (cases || []).filter((c) => isToday(c.reviewedAt || c.reviewed_at)).length
    ),
    newPatients: statNumber(stats?.todayNewPatients, 0),
  }), [cases, stats]);

  return (
    <div className="layout internal-shell doctor-dashboard-shell">
      <Sidebar />

      <main className="main-content dash-shell">
        {/* ============ HERO TOPBAR ============ */}
        <Motion.header
          className="dash-hero"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="dash-hero__left">
            <p className="dash-hero__day">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
            <h1 className="dash-hero__title">
              {greeting}, {doctorName ? `Dr. ${doctorName}` : 'Docteur'}.
            </h1>
            <p className="dash-hero__subtitle">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount > 1 ? 'dossiers nécessitent' : 'dossier nécessite'} votre validation.`
                : 'Aucun dossier en attente. Bonne journée.'}
            </p>
          </div>

          <div className="dash-hero__actions">
            <div className="dash-search">
              <SearchIcon fontSize="small" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher patient, motif…"
              />
            </div>
          </div>
        </Motion.header>

        {loading && !stats ? (
          <div className="dash-loading">
            <LoadingSpinner size="lg" text="Chargement…" />
          </div>
        ) : (
          <div className="dash-grid">
            {/* ============ MAIN COLUMN — INBOX ============ */}
            <section className="dash-col-main">
              <div className="dash-toolbar">
                <h2 className="dash-section-title">
                  Boîte de consultation
                  <span className="dash-count">{filtered.length}</span>
                </h2>
                <div className="segmented-group">
                  {[
                    { v: 'submitted', l: 'À examiner' },
                    { v: 'reviewed',  l: 'Validés' },
                    { v: 'all',       l: 'Tous' },
                  ].map((t) => (
                    <button
                      key={t.v}
                      className={`seg-btn ${filter === t.v ? 'seg-active' : ''}`}
                      onClick={() => setFilter(t.v)}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <Motion.div
                  className="dash-empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  <InboxIcon style={{ fontSize: 56, opacity: 0.4 }} />
                  <h3>Boîte vide</h3>
                  <p>Aucun dossier ne correspond à ce filtre.</p>
                </Motion.div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {Object.entries(buckets).map(([key, list]) =>
                    list.length === 0 ? null : (
                      <Motion.div
                        key={key}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="dash-bucket"
                      >
                        <div className="dash-bucket__label">
                          {key === 'today'     && "Aujourd'hui"}
                          {key === 'yesterday' && 'Hier'}
                          {key === 'week'      && 'Cette semaine'}
                          {key === 'earlier'   && 'Plus ancien'}
                        </div>
                        <ul className="dash-list">
                          {list.map((c, i) => {
                            const s = statusInfo(c.status);
                            return (
                              <Motion.li
                                key={c.id}
                                layout
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="dash-row"
                                onClick={() => navigate(`/doctor/cases/${c.id}`)}
                              >
                                <div className="dash-row__avatar">{getInitials(getCasePatient(c))}</div>
                                <div className="dash-row__main">
                                  <div className="dash-row__name">
                                    {getFullName(getCasePatient(c))}
                                    <span className="dash-row__status">
                                      <span className="dash-row__dot" style={{ background: s.dot }} />
                                      {s.label}
                                    </span>
                                  </div>
                                  <div className="dash-row__sub">
                                    {c.complaint || c.motif || c.chief_complaint || 'Consultation médicale'}
                                  </div>
                                </div>
                                <div className="dash-row__meta">
                                  <span className="dash-row__time">
                                    <AccessTimeIcon fontSize="inherit" /> {relativeTime(getCaseDate(c))}
                                  </span>
                                  <button
                                    className="dash-row__del"
                                    title="Supprimer"
                                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </button>
                                  <ArrowForwardIcon className="dash-row__arrow" fontSize="small" />
                                </div>
                              </Motion.li>
                            );
                          })}
                        </ul>
                      </Motion.div>
                    )
                  )}
                </AnimatePresence>
              )}
            </section>

            {/* ============ SIDE COLUMN - METRICS ============ */}
            <aside className="dash-col-side">
              <Motion.div
                className="dash-side-card"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="dash-side-title">Base de données</h3>
                <ul className="dash-metrics">
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--info"><AssignmentIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{totalMetrics.totalCases}</div>
                      <div className="dash-metric__label">Dossiers</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--brand"><PersonIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{totalMetrics.totalPatients}</div>
                      <div className="dash-metric__label">Patients</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--success"><CheckCircleIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{totalMetrics.reviewedCases}</div>
                      <div className="dash-metric__label">Validés</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--neutral"><GroupsIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{totalMetrics.totalAssistants}</div>
                      <div className="dash-metric__label">Assistants</div>
                    </div>
                  </li>
                </ul>
              </Motion.div>

              <Motion.div
                className="dash-side-card dash-side-card--accent"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
              >
                <h3 className="dash-side-title">Aujourd'hui</h3>
                <ul className="dash-metrics">
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--info"><AssignmentIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{todayMetrics.createdCases}</div>
                      <div className="dash-metric__label">Dossiers créés</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--neutral"><AccessTimeIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{todayMetrics.submittedCases}</div>
                      <div className="dash-metric__label">À examiner</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--success"><CheckCircleIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{todayMetrics.reviewedCases}</div>
                      <div className="dash-metric__label">Validés</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--brand"><PersonIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{todayMetrics.newPatients}</div>
                      <div className="dash-metric__label">Nouveaux patients</div>
                    </div>
                  </li>
                </ul>
              </Motion.div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
