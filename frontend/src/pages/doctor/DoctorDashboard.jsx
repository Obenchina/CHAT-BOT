import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';

/* -------------------------------------------------------------- */
/* Helpers                                                         */
/* -------------------------------------------------------------- */
function getInitials(p) {
  if (!p) return '·';
  const f = (p.firstName || p.first_name || '').trim();
  const l = (p.lastName || p.last_name || '').trim();
  return ((f[0] || '') + (l[0] || '')).toUpperCase() || '·';
}
function getFullName(p) {
  if (!p) return 'Patient';
  return `${p.firstName || p.first_name || ''} ${p.lastName || p.last_name || ''}`.trim() || 'Patient';
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
    const d = new Date(it.date || it.createdAt || it.created_at || Date.now());
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
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('submitted');
  const [query, setQuery] = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true);
    try {
      const [statsRes, casesRes] = await Promise.all([
        doctorService.getDashboard(),
        caseService.getAll(null),
      ]);
      if (statsRes.success) setStats(statsRes.data.stats || statsRes.data);
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
        if (s.success) setStats(s.data.stats || s.data);
      }
    } catch (e) {
      showError('Erreur lors de la suppression');
    }
  }

  const filtered = useMemo(() => {
    let list = Array.isArray(cases) ? [...cases] : [];
    if (filter !== 'all') list = list.filter((c) => c.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => {
        const name = getFullName(c.patient).toLowerCase();
        return name.includes(q) || (c.complaint || '').toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
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

  const submitted = (cases || []).filter((c) => c.status === 'submitted').slice(0, 5);

  return (
    <div className="layout internal-shell doctor-dashboard-shell">
      <Sidebar />

      <main className="main-content dash-shell">
        {/* ============ HERO TOPBAR ============ */}
        <motion.header
          className="dash-hero"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="dash-hero__left">
            <p className="dash-hero__day">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
            <h1 className="dash-hero__title">{greeting}, Dr. Bennani.</h1>
            <p className="dash-hero__subtitle">
              {submitted.length > 0
                ? `${submitted.length} ${submitted.length > 1 ? 'dossiers nécessitent' : 'dossier nécessite'} votre validation aujourd'hui.`
                : "Aucun dossier en attente. Bonne journée."}
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
            <button className="btn btn-primary" onClick={() => navigate('/doctor/patients')}>
              <AddCircleOutlineIcon fontSize="small" /> Nouveau patient
            </button>
          </div>
        </motion.header>

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
                <motion.div
                  className="dash-empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  <InboxIcon style={{ fontSize: 56, opacity: 0.4 }} />
                  <h3>Boîte vide</h3>
                  <p>Aucun dossier ne correspond à ce filtre.</p>
                </motion.div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {Object.entries(buckets).map(([key, list]) =>
                    list.length === 0 ? null : (
                      <motion.div
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
                              <motion.li
                                key={c.id}
                                layout
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="dash-row"
                                onClick={() => navigate(`/doctor/cases/${c.id}`)}
                              >
                                <div className="dash-row__avatar">{getInitials(c.patient)}</div>
                                <div className="dash-row__main">
                                  <div className="dash-row__name">
                                    {getFullName(c.patient)}
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
                                    <AccessTimeIcon fontSize="inherit" /> {relativeTime(c.date || c.createdAt)}
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
                              </motion.li>
                            );
                          })}
                        </ul>
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              )}
            </section>

            {/* ============ SIDE COLUMN — METRICS + QUICK ACTIONS ============ */}
            <aside className="dash-col-side">
              <motion.div
                className="dash-side-card"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="dash-side-title">Aperçu</h3>
                <ul className="dash-metrics">
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--info"><AssignmentIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{stats?.pendingCases ?? 0}</div>
                      <div className="dash-metric__label">À examiner</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--success"><CheckCircleIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{stats?.reviewedCases ?? 0}</div>
                      <div className="dash-metric__label">Validés</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--brand"><PersonIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{stats?.totalPatients ?? 0}</div>
                      <div className="dash-metric__label">Patients</div>
                    </div>
                  </li>
                  <li>
                    <span className="dash-metric__icon dash-metric__icon--neutral"><GroupsIcon fontSize="small" /></span>
                    <div>
                      <div className="dash-metric__value">{stats?.totalAssistants ?? 0}</div>
                      <div className="dash-metric__label">Collaborateurs</div>
                    </div>
                  </li>
                </ul>
              </motion.div>

              <motion.div
                className="dash-side-card"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
              >
                <h3 className="dash-side-title">Accès rapide</h3>
                <div className="dash-quick">
                  <Link to="/doctor/patients" className="dash-quick__item">
                    <PersonIcon fontSize="small" />
                    <span>Registre patients</span>
                    <ArrowForwardIcon fontSize="inherit" />
                  </Link>
                  <Link to="/doctor/catalogue" className="dash-quick__item">
                    <AssignmentIcon fontSize="small" />
                    <span>Référentiel questions</span>
                    <ArrowForwardIcon fontSize="inherit" />
                  </Link>
                  <Link to="/doctor/settings" className="dash-quick__item">
                    <GroupsIcon fontSize="small" />
                    <span>Paramètres & équipe</span>
                    <ArrowForwardIcon fontSize="inherit" />
                  </Link>
                </div>
              </motion.div>

              {submitted.length > 0 && (
                <motion.div
                  className="dash-side-card dash-side-card--accent"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.26 }}
                >
                  <h3 className="dash-side-title">Priorité du jour</h3>
                  <ul className="dash-priority">
                    {submitted.map((c) => (
                      <li key={c.id} onClick={() => navigate(`/doctor/cases/${c.id}`)}>
                        <span className="dash-row__avatar dash-row__avatar--sm">{getInitials(c.patient)}</span>
                        <div>
                          <div className="dash-priority__name">{getFullName(c.patient)}</div>
                          <div className="dash-priority__meta">{relativeTime(c.date || c.createdAt)}</div>
                        </div>
                        <ArrowForwardIcon fontSize="inherit" />
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
