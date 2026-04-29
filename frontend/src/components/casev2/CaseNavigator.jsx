import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { id: 'ai-summary',      icon: '🧠', label: 'Synthèse IA' },
  { id: 'anamnesis',       icon: '📋', label: 'Anamnèse' },
  { id: 'measures',        icon: '📊', label: 'Mesures' },
  { id: 'charts',          icon: '📈', label: 'Courbes' },
  { id: 'documents',       icon: '📎', label: 'Documents' },
  { id: 'prescription',    icon: '💊', label: 'Ordonnance' },
  { id: 'generated-docs',  icon: '📑', label: 'PDF générés' },
  { id: 'diagnostic',      icon: '✍️', label: 'Diagnostic' },
];

export default function CaseNavigator({ activeId, counts = {}, onJump }) {
  return (
    <nav className="case-navigator" aria-label="Navigation du dossier">
      <div className="case-navigator__title">Dossier</div>
      {NAV_ITEMS.map((it) => {
        const isActive = activeId === it.id;
        const count = counts[it.id];
        return (
          <motion.button
            key={it.id}
            className={`case-navigator__item${isActive ? ' case-navigator__item--active' : ''}`}
            onClick={() => onJump(it.id)}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <span className="case-navigator__icon" aria-hidden>{it.icon}</span>
            <span className="case-navigator__label">{it.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span className="case-navigator__count">{count}</span>
            )}
          </motion.button>
        );
      })}
    </nav>
  );
}
