/**
 * Case Details — radical redesign
 * 3 resizable panels (Navigateur / Dossier / Copilot) + 7 blocks.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DocumentPreviewModal from '../../components/common/DocumentPreviewModal';
import ErrorBoundary from '../../components/common/ErrorBoundary';

import CaseTopBar from '../../components/casev2/CaseTopBar';
import CaseNavigator from '../../components/casev2/CaseNavigator';
import CopilotPanel from '../../components/casev2/CopilotPanel';
import AiSummaryBlock from '../../components/casev2/blocks/AiSummaryBlock';
import AnamnesisBlock from '../../components/casev2/blocks/AnamnesisBlock';
import MeasuresBlock from '../../components/casev2/blocks/MeasuresBlock';
import ChartsBlock from '../../components/casev2/blocks/ChartsBlock';
import DocumentsBlock from '../../components/casev2/blocks/DocumentsBlock';
import PrescriptionBlock from '../../components/casev2/blocks/PrescriptionBlock';
import GeneratedDocsBlock from '../../components/casev2/blocks/GeneratedDocsBlock';
import DiagnosticBlock from '../../components/casev2/blocks/DiagnosticBlock';

import api from '../../services/api';
import caseService from '../../services/caseService';
import { showError, showSuccess } from '../../utils/toast';

import '../../styles/case-details.css';

const LS_KEY_LAYOUT       = 'case-v2:layout';
const LS_KEY_COPILOT      = 'case-v2:copilotOpen';
const LS_KEY_COPILOT_EXP  = 'case-v2:copilotExpanded';
const MOBILE_BREAKPOINT_PX = 960;

export default function CaseDetailsV2() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState([]);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggestingAi, setSuggestingAi] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [activeBlock, setActiveBlock] = useState('ai-summary');
  const [copilotOpen, setCopilotOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_COPILOT) ?? 'true'); }
    catch { return true; }
  });
  const [copilotExpanded, setCopilotExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_COPILOT_EXP) ?? 'false'); }
    catch { return false; }
  });
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
  );
  const [mobileTab, setMobileTab] = useState('dossier'); // 'dossier' | 'copilot'

  const dossierRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const lastSavedRef = useRef({ diagnosis: '', medications: [] });

  // ---- Load case ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await caseService.getById(id);
        if (cancelled) return;
        if (res.success) {
          setCaseData(res.data);
          const d = res.data.doctor_diagnosis || res.data.doctorDiagnosis || '';
          setDiagnosis(d);
          lastSavedRef.current.diagnosis = d;
          const rxRaw = res.data.doctor_prescription || res.data.doctorPrescription;
          if (rxRaw) {
            try {
              const rx = JSON.parse(rxRaw);
              if (Array.isArray(rx)) {
                setMedications(rx);
                lastSavedRef.current.medications = rx;
              }
            } catch { /* ignore */ }
          }
        } else {
          showError(res.message || 'Cas introuvable');
        }
      } catch (err) {
        console.error('Load case error:', err);
        showError('Erreur lors du chargement du cas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ---- Auto-save (diagnosis + medications, debounced) ----
  useEffect(() => {
    if (loading) return;
    const same =
      diagnosis === lastSavedRef.current.diagnosis &&
      JSON.stringify(medications) === JSON.stringify(lastSavedRef.current.medications);
    if (same) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await caseService.saveReview(id, {
          diagnosis,
          prescription: JSON.stringify(medications),
        });
        lastSavedRef.current = { diagnosis, medications };
        setLastSavedAt(new Date());
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setAutoSaving(false);
      }
    }, 1500);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [diagnosis, medications, id, loading]);

  // ---- Persist copilot toggle ----
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_COPILOT, JSON.stringify(copilotOpen)); }
    catch { /* ignore */ }
  }, [copilotOpen]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_COPILOT_EXP, JSON.stringify(copilotExpanded)); }
    catch { /* ignore */ }
  }, [copilotExpanded]);

  // ---- Track viewport for mobile layout ----
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---- Counts for navigator ----
  const counts = useMemo(() => {
    const ans = caseData?.answers || [];
    const measureCount = ans.filter(a => {
      const cm = a.clinical_measure || a.clinicalMeasure;
      return cm && cm !== 'none';
    }).length;
    return {
      'ai-summary':      caseData?.ai_summary || caseData?.aiSummary ? 1 : 0,
      'anamnesis':       ans.length - measureCount,
      'measures':        measureCount,
      'documents':       (caseData?.documents || []).length,
      'prescription':    medications.length,
      'generated-docs':  3,
    };
  }, [caseData, medications]);

  // ---- Jump to block ----
  const jumpTo = (id) => {
    setActiveBlock(id);
    if (isMobile) setMobileTab('dossier');
    // wait a frame so the dossier panel is visible (mobile tab swap)
    requestAnimationFrame(() => {
      const el = document.getElementById(`block-${id}`);
      if (el && dossierRef.current) {
        dossierRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
      }
    });
  };

  // ---- Track active block on scroll ----
  useEffect(() => {
    const root = dossierRef.current;
    if (!root) return;
    const ids = ['ai-summary', 'anamnesis', 'measures', 'charts', 'documents', 'prescription', 'generated-docs', 'diagnostic'];
    const onScroll = () => {
      const top = root.scrollTop + 80;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(`block-${id}`);
        if (el && el.offsetTop <= top) current = id;
      }
      setActiveBlock(current);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [loading]);

  // ---- Manual save ----
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await caseService.saveReview(id, {
        diagnosis,
        prescription: JSON.stringify(medications),
      });
      if (res.success) {
        lastSavedRef.current = { diagnosis, medications };
        setLastSavedAt(new Date());
        showSuccess('Diagnostic enregistré');
      } else {
        showError(res.message || 'Erreur d\'enregistrement');
      }
    } catch (err) {
      console.error('Save error:', err);
      showError('Erreur d\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // ---- Submit review ----
  const handleSubmitReview = async () => {
    if (!(diagnosis || '').trim()) {
      showError('Veuillez saisir un diagnostic avant de valider');
      return;
    }
    setSaving(true);
    try {
      const res = await caseService.saveReview(id, {
        diagnosis,
        prescription: JSON.stringify(medications),
        markReviewed: true,
      });
      if (res.success) {
        showSuccess('Cas validé');
        const r = await caseService.getById(id);
        if (r.success) setCaseData(r.data);
      } else {
        showError(res.message || 'Erreur');
      }
    } catch (err) {
      console.error('Submit review error:', err);
      showError('Erreur lors de la validation');
    } finally {
      setSaving(false);
    }
  };

  // ---- AI medication suggestion ----
  const handleSuggestAi = async () => {
    setSuggestingAi(true);
    try {
      const res = await caseService.suggestMedications(id);
      if (res.success) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.medications || []);
        const withIds = list.map(m => ({ id: Date.now() + Math.random(), ...m }));
        setMedications(prev => [...prev, ...withIds]);
        showSuccess(`${withIds.length} médicament(s) suggéré(s)`);
      } else {
        showError(res.message || 'Aucune suggestion');
      }
    } catch (err) {
      console.error('Suggest meds error:', err);
      showError(err?.response?.data?.message || 'Erreur de suggestion');
    } finally {
      setSuggestingAi(false);
    }
  };

  // ---- Download PDF ----
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      // ensure latest is saved
      await caseService.saveReview(id, { diagnosis, prescription: JSON.stringify(medications) });
      const blob = await api.get(`/cases/${id}/prescription/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordonnance_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF error:', err);
      showError('Erreur lors de la génération du PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ---- Pin AI message to diagnostic ----
  const handlePinToDiagnostic = (text) => {
    if (!text) return;
    setDiagnosis(prev => (prev ? prev.trimEnd() + '\n\n' + text : text));
    showSuccess('Épinglé au diagnostic');
    jumpTo('diagnostic');
  };

  // ---- Layout save / restore ----
  const onLayoutChange = (sizes) => {
    try { localStorage.setItem(LS_KEY_LAYOUT, JSON.stringify(sizes)); }
    catch { /* ignore */ }
  };
  const initialLayout = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(LS_KEY_LAYOUT) || 'null');
      if (Array.isArray(v) && v.length === 3) return v;
    } catch { /* ignore */ }
    // wider copilot by default (was 30 → 38)
    return [14, 48, 38];
  })();

  // helper: re-fetch case data (used after reanalyze / external changes)
  const refreshCase = async () => {
    try {
      const r = await caseService.getById(id);
      if (r?.success) {
        setCaseData(r.data);
      }
    } catch (err) {
      console.error('Refresh case error:', err);
    }
  };

  // helper: persist current diagnosis/prescription before generating any PDF
  const persistBeforeExport = async () => {
    try {
      await caseService.saveReview(id, {
        diagnosis,
        prescription: JSON.stringify(medications),
      });
      lastSavedRef.current = { diagnosis, medications };
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Auto-save before export error:', err);
    }
  };

  if (loading) {
    return (
      <div className="case-page">
        <Sidebar />
        <div className="case-page__main" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" text="Chargement du cas…" />
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="case-page">
        <Sidebar />
        <div className="case-page__main" style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div>
            <h2 style={{ color: 'var(--color-text-primary)' }}>Cas introuvable</h2>
            <button className="btn btn--ghost" onClick={() => navigate('/doctor/dashboard')}>← Retour au tableau de bord</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="case-page">
      <Sidebar />
      <div className="case-page__main">
        <CaseTopBar caseData={caseData} autoSaving={autoSaving} onAutoSavedAt={lastSavedAt} />

        {/* Mobile tab switcher (shown only below MOBILE_BREAKPOINT_PX) */}
        {isMobile && (
          <div className="case-mobile-tabs" role="tablist" aria-label="Vue mobile">
            <button
              role="tab"
              aria-selected={mobileTab === 'dossier'}
              className={`case-mobile-tabs__btn${mobileTab === 'dossier' ? ' case-mobile-tabs__btn--active' : ''}`}
              onClick={() => setMobileTab('dossier')}
            >
              📋 Dossier
            </button>
            <button
              role="tab"
              aria-selected={mobileTab === 'copilot'}
              className={`case-mobile-tabs__btn${mobileTab === 'copilot' ? ' case-mobile-tabs__btn--active' : ''}`}
              onClick={() => { setMobileTab('copilot'); setCopilotOpen(true); }}
            >
              🤖 Copilot
            </button>
          </div>
        )}

        <div className="case-workspace">
          {/* DESKTOP: 3 resizable panels */}
          {!isMobile && (
            <PanelGroup direction="horizontal" autoSaveId="caseDetailsLayout" onLayout={onLayoutChange}>
              {/* Navigator */}
              <Panel defaultSize={initialLayout[0]} minSize={10} maxSize={22} order={1}>
                <ErrorBoundary fallback={<div style={{padding:16,color:'var(--color-text-muted)'}}>Erreur navigateur</div>}>
                  <CaseNavigator activeId={activeBlock} counts={counts} onJump={jumpTo} />
                </ErrorBoundary>
              </Panel>
              <PanelResizeHandle className="case-resize-handle" />

              {/* Dossier (center) */}
              <Panel defaultSize={initialLayout[1]} minSize={28} order={2}>
                <div className="case-dossier" ref={dossierRef}>
                  <div className="case-dossier__inner">
                    <ErrorBoundary><AiSummaryBlock caseData={caseData} onUpdate={refreshCase} /></ErrorBoundary>
                    <ErrorBoundary><AnamnesisBlock caseData={caseData} /></ErrorBoundary>
                    <ErrorBoundary><MeasuresBlock caseData={caseData} /></ErrorBoundary>
                    <ErrorBoundary><ChartsBlock caseData={caseData} /></ErrorBoundary>
                    <ErrorBoundary>
                      <DocumentsBlock caseData={caseData} onPreview={setPreviewDoc} />
                    </ErrorBoundary>
                    <ErrorBoundary>
                      <PrescriptionBlock
                        medications={medications}
                        onChange={setMedications}
                        onSuggestAi={handleSuggestAi}
                        suggestingAi={suggestingAi}
                        onDownloadPdf={handleDownloadPdf}
                        downloading={downloadingPdf}
                      />
                    </ErrorBoundary>
                    <ErrorBoundary>
                      <GeneratedDocsBlock
                        caseId={id}
                        onPersist={persistBeforeExport}
                        hasMedications={medications.length > 0}
                        hasDiagnosis={Boolean((diagnosis || '').trim())}
                      />
                    </ErrorBoundary>
                    <ErrorBoundary>
                      <DiagnosticBlock
                        diagnosis={diagnosis}
                        onChange={setDiagnosis}
                        autoSaving={autoSaving}
                        lastSavedAt={lastSavedAt}
                        onSave={handleSave}
                        onSubmitReview={handleSubmitReview}
                        saving={saving}
                      />
                    </ErrorBoundary>
                    <div style={{ height: 200 }} />
                  </div>
                </div>
              </Panel>

              {/* Copilot (right) */}
              <AnimatePresence initial={false}>
                {copilotOpen && (
                  <>
                    <PanelResizeHandle className="case-resize-handle" />
                    <Panel
                      defaultSize={copilotExpanded ? 65 : initialLayout[2]}
                      minSize={24}
                      maxSize={75}
                      order={3}
                    >
                      <ErrorBoundary fallback={<div style={{padding:16,color:'var(--color-text-muted)'}}>Erreur Copilot</div>}>
                        <CopilotPanel
                          caseId={id}
                          onPinToDiagnostic={handlePinToDiagnostic}
                          onCollapse={() => setCopilotOpen(false)}
                          onExpand={() => setCopilotExpanded((v) => !v)}
                          expanded={copilotExpanded}
                        />
                      </ErrorBoundary>
                    </Panel>
                  </>
                )}
              </AnimatePresence>
            </PanelGroup>
          )}

          {/* MOBILE: stack views, switched by tab */}
          {isMobile && (
            <div className="case-workspace--mobile">
              {mobileTab === 'dossier' ? (
                <>
                  <ErrorBoundary fallback={<div style={{padding:16,color:'var(--color-text-muted)'}}>Erreur navigateur</div>}>
                    <CaseNavigator activeId={activeBlock} counts={counts} onJump={jumpTo} />
                  </ErrorBoundary>
                  <div className="case-dossier" ref={dossierRef}>
                    <div className="case-dossier__inner">
                      <ErrorBoundary><AiSummaryBlock caseData={caseData} onUpdate={refreshCase} /></ErrorBoundary>
                      <ErrorBoundary><AnamnesisBlock caseData={caseData} /></ErrorBoundary>
                      <ErrorBoundary><MeasuresBlock caseData={caseData} /></ErrorBoundary>
                      <ErrorBoundary><ChartsBlock caseData={caseData} /></ErrorBoundary>
                      <ErrorBoundary>
                        <DocumentsBlock caseData={caseData} onPreview={setPreviewDoc} />
                      </ErrorBoundary>
                      <ErrorBoundary>
                        <PrescriptionBlock
                          medications={medications}
                          onChange={setMedications}
                          onSuggestAi={handleSuggestAi}
                          suggestingAi={suggestingAi}
                          onDownloadPdf={handleDownloadPdf}
                          downloading={downloadingPdf}
                        />
                      </ErrorBoundary>
                      <ErrorBoundary>
                        <GeneratedDocsBlock
                          caseId={id}
                          onPersist={persistBeforeExport}
                          hasMedications={medications.length > 0}
                          hasDiagnosis={Boolean((diagnosis || '').trim())}
                        />
                      </ErrorBoundary>
                      <ErrorBoundary>
                        <DiagnosticBlock
                          diagnosis={diagnosis}
                          onChange={setDiagnosis}
                          autoSaving={autoSaving}
                          lastSavedAt={lastSavedAt}
                          onSave={handleSave}
                          onSubmitReview={handleSubmitReview}
                          saving={saving}
                        />
                      </ErrorBoundary>
                      <div style={{ height: 160 }} />
                    </div>
                  </div>
                </>
              ) : (
                <ErrorBoundary fallback={<div style={{padding:16,color:'var(--color-text-muted)'}}>Erreur Copilot</div>}>
                  <CopilotPanel
                    caseId={id}
                    onPinToDiagnostic={handlePinToDiagnostic}
                    onCollapse={() => setMobileTab('dossier')}
                  />
                </ErrorBoundary>
              )}
            </div>
          )}

          {/* Floating reopen button when copilot is hidden (desktop only) */}
          {!isMobile && !copilotOpen && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setCopilotOpen(true)}
              style={{
                position: 'fixed',
                right: 16,
                bottom: 24,
                background: 'var(--color-brand-500)',
                color: 'var(--color-text-inverse)',
                border: 'none',
                width: 56,
                height: 56,
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-3)',
                fontSize: 24,
                zIndex: 50,
              }}
              aria-label="Ouvrir le Copilot"
              title="Copilot IA"
            >
              🤖
            </motion.button>
          )}
        </div>

        {previewDoc && (
          <DocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
        )}
      </div>
    </div>
  );
}
