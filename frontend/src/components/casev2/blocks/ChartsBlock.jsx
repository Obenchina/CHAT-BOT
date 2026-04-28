export default function ChartsBlock() {
  return (
    <section className="case-block" id="block-charts">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>📈</span>
          Courbes pédiatriques
        </h2>
      </div>
      <div className="rx__empty">
        Module courbes — affichage longitudinal du patient.
        <br />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          (Lien vers le module dédié dans Paramètres &gt; Courbes pédiatriques)
        </span>
      </div>
    </section>
  );
}
