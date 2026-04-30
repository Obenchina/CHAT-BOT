/**
 * Doctor Patients — split-view workspace
 *  ┌────────────────┬─────────────────────────────────────┐
 *  │ Toolbar (search + filters + sort + new)             │
 *  ├────────────────┼─────────────────────────────────────┤
 *  │ LIST           │ DETAIL                              │
 *  │  • avatar      │  Hero (name, age, badges)           │
 *  │  • name        │  Tabs: Profil · Consultations · Mes │
 *  │  • last visit  │  Selected tab content               │
 *  └────────────────┴─────────────────────────────────────┘
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../../components/common/Sidebar';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import patientService from '../../services/patientService';
import caseService from '../../services/caseService';
import { showError, showConfirm } from '../../utils/toast';
import { GENDER_OPTIONS } from '../../constants/config';
import PatientMeasurementsChart from '../../components/patient/PatientMeasurementsChart';

import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupOffIcon from '@mui/icons-material/GroupOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import TimelineIcon from '@mui/icons-material/Timeline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CallIcon from '@mui/icons-material/Call';
import HomeIcon from '@mui/icons-material/Home';
import CakeIcon from '@mui/icons-material/Cake';

/* helpers ------------------------------------------------------ */
const fullName = (p) =>
  `${p?.firstName || p?.first_name || ''} ${p?.lastName || p?.last_name || ''}`.trim() || 'Patient';
const initials = (p) => {
  if (!p) return '·';
  const f = (p.firstName || p.first_name || '')[0] || '';
  const l = (p.lastName || p.last_name || '')[0] || '';
  return (f + l).toUpperCase() || '·';
};
const ageFromDob = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 86400000));
  if (years >= 2) return `${years} ans`;
  const months = Math.floor(diff / (30.44 * 86400000));
  return `${months} mois`;
};
const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusInfo = (status) => {
  const map = {
    in_progress: { label: 'En cours',   tone: 'warning' },
    submitted:   { label: 'À examiner', tone: 'info' },
    reviewed:    { label: 'Validé',     tone: 'success' },
    closed:      { label: 'Clôturé',    tone: 'gray' },
  };
  return map[status] || map.in_progress;
};

/* component ---------------------------------------------------- */
export default function DoctorPatients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('profile');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [measurements, setMeasurements] = useState({});
  const [measurementsLoading, setMeasurementsLoading] = useState(false);
  const [activeMeasure, setActiveMeasure] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [formData, setFormData] = useState({ firstName:'', lastName:'', gender:'male', dateOfBirth:'', phone:'', address:'', siblingsAlive:0, siblingsDeceased:0 });
  const [formErrors, setFormErrors] = useState({});
  const [editingPatient, setEditingPatient] = useState(null);

  /* mobile detail toggle */
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPatients(); }, []);

  async function loadPatients() {
    setLoading(true);
    try {
      const r = await patientService.getAll();
      const list = Array.isArray(r?.data) ? r.data : [];
      setPatients(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (error) { console.error(error); setPatients([]); }
    finally { setLoading(false); }
  }

  /* search + filter + sort */
  const filtered = useMemo(() => {
    let r = Array.isArray(patients) ? [...patients] : [];
    if (genderFilter !== 'all') r = r.filter((p) => p.gender === genderFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((p) => fullName(p).toLowerCase().includes(q) || (p.phone || '').includes(q));
    }
    r.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return fullName(a).localeCompare(fullName(b));
        case 'age_desc': return new Date(b.dateOfBirth || b.date_of_birth || 0) - new Date(a.dateOfBirth || a.date_of_birth || 0);
        case 'age_asc':  return new Date(a.dateOfBirth || a.date_of_birth || 0) - new Date(b.dateOfBirth || b.date_of_birth || 0);
        default: return b.id - a.id;
      }
    });
    return r;
  }, [patients, query, genderFilter, sortBy]);

  const selected = useMemo(() => filtered.find((p) => p.id === selectedId) || filtered[0] || null, [filtered, selectedId]);

  /* load detail when selection changes */
  useEffect(() => {
    if (!selected?.id) return;
    setHistory([]); setHistoryLoading(true);
    patientService.getById(selected.id)
      .then((r) => {
        const cases = (r?.data?.cases || []).sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
        setHistory(cases);
      }).catch(() => {})
      .finally(() => setHistoryLoading(false));

    setMeasurements({}); setMeasurementsLoading(true);
    patientService.getMeasurements(selected.id)
      .then((r) => {
        const data = r?.data || {};
        setMeasurements(data);
        const keys = Object.keys(data);
        if (keys.length) setActiveMeasure(keys[0]); else setActiveMeasure(null);
      }).catch(() => {})
      .finally(() => setMeasurementsLoading(false));
  }, [selected?.id]);

  /* edit */
  function openEdit(p) {
    let dob = p.dateOfBirth || p.date_of_birth || '';
    if (dob && typeof dob === 'string' && dob.includes('T')) dob = dob.split('T')[0];
    setEditingPatient(p);
    setFormData({
      firstName: p.firstName || p.first_name || '',
      lastName:  p.lastName || p.last_name || '',
      gender: p.gender || 'male',
      dateOfBirth: dob,
      phone: p.phone || '',
      address: p.address || '',
      siblingsAlive: p.siblingsAlive ?? p.siblings_alive ?? 0,
      siblingsDeceased: p.siblingsDeceased ?? p.siblings_deceased ?? 0,
    });
    setFormErrors({});
    setShowModal(true);
  }
  function onChange(e) {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    setFormErrors((p) => ({ ...p, [e.target.name]: '' }));
  }
  function validate() {
    const err = {};
    if (!formData.firstName.trim()) err.firstName = 'Requis';
    if (!formData.lastName.trim())  err.lastName  = 'Requis';
    if (!formData.dateOfBirth) err.dateOfBirth = 'Date de naissance requise';
    else if (new Date(formData.dateOfBirth) > new Date()) err.dateOfBirth = 'Date dans le futur';
    if (!formData.phone.trim()) err.phone = 'Requis';
    setFormErrors(err);
    return Object.keys(err).length === 0;
  }
  async function submitEdit(e) {
    e.preventDefault();
    if (!validate()) return;
    setModalLoading(true);
    try {
      const r = await patientService.update(editingPatient.id, formData);
      if (r.success) {
        setPatients((prev) => prev.map((p) => p.id === editingPatient.id ? { ...p, ...formData } : p));
        setShowModal(false); setEditingPatient(null);
      }
    } catch (err) { setFormErrors({ general: err.message || 'Erreur serveur' }); }
    finally { setModalLoading(false); }
  }

  /* delete */
  async function deletePatient(p) {
    const ok = await showConfirm('Supprimer ce patient ? Action irréversible.');
    if (!ok) return;
    try {
      const r = await patientService.delete(p.id);
      if (r.success) {
        setPatients((prev) => prev.filter((x) => x.id !== p.id));
        if (selectedId === p.id) setSelectedId(null);
      }
    } catch { showError('Erreur lors de la suppression'); }
  }
  async function deleteCase(caseId) {
    const ok = await showConfirm('Supprimer cette consultation ?');
    if (!ok) return;
    try {
      const r = await caseService.deleteCase(caseId);
      if (r.success) setHistory((prev) => prev.filter((c) => c.id !== caseId));
    } catch { showError('Erreur lors de la suppression'); }
  }

  /* render ------------------------------------------------ */
  return (
    <div className="layout internal-shell pat-shell">
      <Sidebar />

      <main className="main-content pat-main">
        {/* TOOLBAR */}
        <header className="pat-toolbar">
          <div className="pat-toolbar__title">
            <h1>Registre des patients</h1>
            <span className="pat-toolbar__count">{filtered.length}</span>
          </div>
          <div className="pat-toolbar__actions">
            <div className="pat-search">
              <SearchIcon fontSize="small" />
              <input
                placeholder="Rechercher nom, téléphone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && <button className="pat-search__clear" onClick={() => setQuery('')}><CloseIcon fontSize="inherit" /></button>}
            </div>
            <div className="pat-mobile-segmented" aria-label="Filtrer par sexe">
              {[
                ['all', 'Tous'],
                ['male', 'Garçons'],
                ['female', 'Filles']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={genderFilter === value ? 'is-active' : ''}
                  onClick={() => setGenderFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <select className="pat-filter pat-filter--gender" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="all">Tous les sexes</option>
              <option value="male">Garçons</option>
              <option value="female">Filles</option>
            </select>
            <select className="pat-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Plus récents</option>
              <option value="name_asc">Nom (A-Z)</option>
              <option value="age_desc">Plus âgés</option>
              <option value="age_asc">Plus jeunes</option>
            </select>
          </div>
        </header>

        {loading ? (
          <div className="pat-loading"><LoadingSpinner size="lg" text="Chargement…" /></div>
        ) : filtered.length === 0 ? (
          <div className="pat-empty">
            <GroupOffIcon style={{ fontSize: 56, opacity: 0.4 }} />
            <h3>Aucun patient</h3>
            <p>{query ? `Aucun résultat pour "${query}".` : 'Aucun patient enregistré pour le moment.'}</p>
          </div>
        ) : (
          <div className={`pat-split ${mobileDetailOpen ? 'is-mobile-detail' : ''}`}>
            {/* LIST */}
            <aside className="pat-list">
              <ul>
                {filtered.map((p, i) => {
                  const isSelected = selected?.id === p.id;
                  return (
                    <Motion.li
                      key={p.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`pat-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => { setSelectedId(p.id); setTab('profile'); setMobileDetailOpen(true); }}
                    >
                      <div className={`pat-avatar pat-avatar--${p.gender || 'male'}`}>{initials(p)}</div>
                      <div className="pat-item__main">
                        <div className="pat-item__name">{fullName(p)}</div>
                        <div className="pat-item__meta">
                          {ageFromDob(p.dateOfBirth || p.date_of_birth) || '—'}
                          {p.phone ? <> · {p.phone}</> : null}
                        </div>
                      </div>
                    </Motion.li>
                  );
                })}
              </ul>
            </aside>

            {/* DETAIL */}
            <section className="pat-detail">
              {!selected ? (
                <div className="pat-empty"><PersonOutlineIcon style={{ fontSize: 56, opacity: 0.4 }} /><h3>Sélectionnez un patient</h3></div>
              ) : (
                <>
                  {/* MOBILE BACK */}
                  <button className="pat-back-btn" onClick={() => setMobileDetailOpen(false)}>
                    <ArrowBackIcon fontSize="small" /> Retour à la liste
                  </button>

                  {/* HERO */}
                  <div className="pat-hero">
                    <div className={`pat-avatar pat-avatar--lg pat-avatar--${selected.gender || 'male'}`}>{initials(selected)}</div>
                    <div className="pat-hero__main">
                      <h2 className="pat-hero__name">{fullName(selected)}</h2>
                      <div className="pat-hero__chips">
                        <span className="chip"><CakeIcon fontSize="inherit" /> {ageFromDob(selected.dateOfBirth || selected.date_of_birth) || '—'}</span>
                        <span className="chip">{selected.gender === 'female' ? '♀ Fille' : '♂ Garçon'}</span>
                        {selected.phone && <span className="chip"><CallIcon fontSize="inherit" /> {selected.phone}</span>}
                      </div>
                    </div>
                    <div className="pat-hero__actions">
                      <button className="btn btn-ghost" onClick={() => openEdit(selected)}><EditIcon fontSize="small" /> Modifier</button>
                      <button className="btn btn-ghost btn-danger" onClick={() => deletePatient(selected)}><DeleteIcon fontSize="small" /></button>
                    </div>
                  </div>

                  {/* TABS */}
                  <div className="pat-tabs">
                    {[
                      { v:'profile',     l:'Profil',         icon: <PersonOutlineIcon fontSize="small" /> },
                      { v:'consultations', l:`Consultations (${history.length})`, icon: <LocalHospitalIcon fontSize="small" /> },
                      { v:'mesures',    l:'Courbes',        icon: <TimelineIcon fontSize="small" /> },
                    ].map((x) => (
                      <button
                        key={x.v}
                        className={`pat-tab ${tab === x.v ? 'is-active' : ''}`}
                        onClick={() => setTab(x.v)}
                      >
                        {x.icon} <span>{x.l}</span>
                      </button>
                    ))}
                  </div>

                  {/* TAB CONTENT */}
                  <div className="pat-tab-content">
                    <AnimatePresence mode="wait">
                      {tab === 'profile' && (
                        <Motion.div key="profile" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="pat-block">
                          <h3>Informations</h3>
                          <dl className="pat-info">
                            <div><dt>Prénom</dt><dd>{selected.firstName || selected.first_name}</dd></div>
                            <div><dt>Nom</dt><dd>{selected.lastName || selected.last_name}</dd></div>
                            <div><dt>Sexe</dt><dd>{selected.gender === 'female' ? 'Féminin' : 'Masculin'}</dd></div>
                            <div><dt>Naissance</dt><dd>{formatDate(selected.dateOfBirth || selected.date_of_birth)}</dd></div>
                            <div><dt>Téléphone</dt><dd>{selected.phone || '—'}</dd></div>
                            <div><dt>Adresse</dt><dd>{selected.address || '—'}</dd></div>
                            <div><dt>Frères/sœurs</dt><dd>{(selected.siblingsAlive ?? 0)} vivants · {(selected.siblingsDeceased ?? 0)} décédés</dd></div>
                          </dl>
                        </Motion.div>
                      )}

                      {tab === 'consultations' && (
                        <Motion.div key="cons" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="pat-block">
                          <h3>Consultations</h3>
                          {historyLoading ? (
                            <div className="pat-loading-inline"><LoadingSpinner size="sm" /></div>
                          ) : history.length === 0 ? (
                            <div className="pat-empty pat-empty--small"><LocalHospitalIcon style={{ fontSize: 40, opacity: 0.4 }} /><p>Aucune consultation pour ce patient.</p></div>
                          ) : (
                            <ul className="pat-cases">
                              {history.map((c) => {
                                const s = statusInfo(c.status);
                                return (
                                  <li key={c.id} className="pat-case-row" onClick={() => navigate(`/doctor/cases/${c.id}`)}>
                                    <div className="pat-case-row__date">{formatDate(c.createdAt || c.created_at)}</div>
                                    <div className="pat-case-row__main">
                                      <div className="pat-case-row__title">{c.complaint || c.motif || 'Consultation'}</div>
                                      <span className={`badge badge-${s.tone}`}>{s.label}</span>
                                    </div>
                                    <div className="pat-case-row__actions">
                                      <button className="icon-btn" title="Ouvrir" onClick={(e) => { e.stopPropagation(); navigate(`/doctor/cases/${c.id}`); }}><VisibilityIcon fontSize="small" /></button>
                                      <button className="icon-btn icon-btn--danger" title="Supprimer" onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }}><DeleteIcon fontSize="small" /></button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </Motion.div>
                      )}

                      {tab === 'mesures' && (
                        <Motion.div key="mes" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="pat-block">
                          <h3>Courbes pédiatriques</h3>
                          {measurementsLoading ? (
                            <div className="pat-loading-inline"><LoadingSpinner size="sm" /></div>
                          ) : Object.keys(measurements).length === 0 ? (
                            <div className="pat-empty pat-empty--small"><TimelineIcon style={{ fontSize: 40, opacity: 0.4 }} /><p>Aucune mesure enregistrée pour ce patient.</p></div>
                          ) : (
                            <>
                              <div className="pat-measure-tabs">
                                {Object.keys(measurements).map((k) => (
                                  <button
                                    key={k}
                                    className={`pat-measure-tab ${activeMeasure === k ? 'is-active' : ''}`}
                                    onClick={() => setActiveMeasure(k)}
                                  >
                                    {k} <span>· {measurements[k]?.length || 0}</span>
                                  </button>
                                ))}
                              </div>
                              {activeMeasure && (
                                <PatientMeasurementsChart
                                  patient={selected}
                                  data={measurements[activeMeasure]}
                                  measureKey={activeMeasure}
                                  height={480}
                                />
                              )}
                            </>
                          )}
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* EDIT MODAL */}
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title="Modifier le patient"
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
                <Button variant="primary" onClick={submitEdit} loading={modalLoading}>Enregistrer</Button>
              </>
            }
          >
            {formErrors.general && <div className="alert alert-error">{formErrors.general}</div>}
            <form onSubmit={submitEdit}>
              <div className="form-2col">
                <Input label="Prénom" name="firstName" value={formData.firstName} onChange={onChange} error={formErrors.firstName} required />
                <Input label="Nom" name="lastName" value={formData.lastName} onChange={onChange} error={formErrors.lastName} required />
              </div>
              <div className="form-group">
                <label className="form-label">Sexe *</label>
                <select name="gender" value={formData.gender} onChange={onChange} className="form-input form-select">
                  {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-2col">
                <Input label="Date de naissance" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={onChange} error={formErrors.dateOfBirth} required />
                <Input label="Téléphone" name="phone" type="tel" value={formData.phone} onChange={onChange} error={formErrors.phone} required />
              </div>
              <Input label="Adresse" name="address" value={formData.address} onChange={onChange} />
              <div className="form-2col">
                <Input label="Frères/sœurs vivants" name="siblingsAlive" type="number" min="0" value={formData.siblingsAlive} onChange={onChange} />
                <Input label="Frères/sœurs décédés" name="siblingsDeceased" type="number" min="0" value={formData.siblingsDeceased} onChange={onChange} />
              </div>
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}
