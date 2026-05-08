/**
 * Math-based validation for growth curve data (reference or AI-extracted).
 *
 * Returns { ok: boolean, errors: string[], warnings: string[] }.
 *
 * Supports two equivalent line families:
 *   - Percentile-style (OMS/CDC): P3, P10, P25, P50, P75, P90, P97
 *   - SD-style       (AFPA):     M-3SD, M-2SD, M-1SD, M, M+1SD, M+2SD, M+3SD
 *
 * Rules:
 *   1. Required fields present (id, panels, panels[i].ages, panels[i].percentiles).
 *   2. Each panel has consistent ages length and per-line array length.
 *   3. Required lines present per family
 *      (P3/P50/P97 for percentile, M-3SD/M/M+3SD for SD-style).
 *   4. At each age, line values are non-decreasing across the ordered family.
 *   5. Median values (P50 or M) are non-decreasing across age (height/weight/head).
 *   6. Plausible bounds per measure type.
 *   7. Median (P50 or M) must have ≥50% finite values.
 */

const REQUIRED_PERCENTILES = ['P3', 'P50', 'P97'];
const ORDERED_PERCENTILES = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];

const REQUIRED_SD_LINES = ['M-3SD', 'M', 'M+3SD'];
const ORDERED_SD_LINES = ['M-3SD', 'M-2SD', 'M-1SD', 'M', 'M+1SD', 'M+2SD', 'M+3SD'];

const PLAUSIBLE_RANGES = {
    height: { min: 30, max: 220 },
    weight: { min: 1, max: 200 },
    head: { min: 25, max: 65 },
    bmi: { min: 8, max: 50 },
};

/**
 * Detect the line family used by a panel.
 * Returns 'sd' if any SD-style key is present, 'percentile' otherwise (default).
 */
function detectLineFamily(panel) {
    if (!panel?.percentiles || typeof panel.percentiles !== 'object') return 'percentile';
    const keys = Object.keys(panel.percentiles);
    const hasSd = keys.some((k) => ORDERED_SD_LINES.includes(k));
    return hasSd ? 'sd' : 'percentile';
}

function validateCurveData(curve) {
    const errors = [];
    const warnings = [];

    if (!curve || typeof curve !== 'object') {
        return { ok: false, errors: ['Curve data missing'], warnings };
    }
    if (!curve.id || typeof curve.id !== 'string') errors.push('Missing curve id');
    if (!Array.isArray(curve.panels) || curve.panels.length === 0) {
        return { ok: false, errors: [...errors, 'Curve has no panels'], warnings };
    }

    curve.panels.forEach((panel, panelIdx) => {
        const prefix = `Panel[${panelIdx}] (${panel.measure || '?'})`;
        if (!panel.measure) errors.push(`${prefix}: missing measure`);
        if (!Array.isArray(panel.ages) || panel.ages.length < 2) {
            errors.push(`${prefix}: ages must be an array of at least 2 entries`);
            return;
        }
        const badAges = panel.ages.filter((v) => !Number.isFinite(v));
        if (badAges.length > 0) {
            errors.push(`${prefix}: ages contains ${badAges.length} non-numeric entries`);
        }
        if (!panel.percentiles || typeof panel.percentiles !== 'object') {
            errors.push(`${prefix}: missing percentiles`);
            return;
        }

        const family = detectLineFamily(panel);
        const requiredLines = family === 'sd' ? REQUIRED_SD_LINES : REQUIRED_PERCENTILES;
        const orderedLines = family === 'sd' ? ORDERED_SD_LINES : ORDERED_PERCENTILES;
        const medianKey = family === 'sd' ? 'M' : 'P50';

        for (const p of requiredLines) {
            if (!Array.isArray(panel.percentiles[p])) {
                errors.push(`${prefix}: missing required line ${p}`);
            }
        }

        const expectedLen = panel.ages.length;
        for (const [pName, arr] of Object.entries(panel.percentiles)) {
            if (!Array.isArray(arr)) continue;
            if (arr.length !== expectedLen) {
                errors.push(`${prefix}: line ${pName} length ${arr.length} != ages length ${expectedLen}`);
            }
        }

        // Coverage: at least the median (P50 or M) must have enough usable points.
        const median = Array.isArray(panel.percentiles[medianKey]) ? panel.percentiles[medianKey] : [];
        const finiteCount = median.filter((v) => Number.isFinite(v)).length;
        const minFinite = Math.max(2, Math.ceil(expectedLen * 0.5));
        if (finiteCount < minFinite) {
            errors.push(`${prefix}: ${medianKey} has only ${finiteCount}/${expectedLen} usable values (need at least ${minFinite})`);
        }

        // Plausible bounds
        const bounds = PLAUSIBLE_RANGES[panel.measure];
        if (bounds) {
            const allValues = Object.values(panel.percentiles).flat().filter((v) => Number.isFinite(v));
            if (allValues.some((v) => v < bounds.min || v > bounds.max)) {
                errors.push(`${prefix}: values outside plausible range [${bounds.min}, ${bounds.max}] ${panel.unit || ''}`);
            }
        }

        // Line ordering at each age (non-decreasing across family)
        const linesPresent = orderedLines.filter((p) => Array.isArray(panel.percentiles[p]));
        for (let ageIdx = 0; ageIdx < expectedLen; ageIdx += 1) {
            for (let i = 1; i < linesPresent.length; i += 1) {
                const lo = panel.percentiles[linesPresent[i - 1]][ageIdx];
                const hi = panel.percentiles[linesPresent[i]][ageIdx];
                if (Number.isFinite(lo) && Number.isFinite(hi) && hi < lo - 1e-6) {
                    errors.push(`${prefix}: at age ${panel.ages[ageIdx]}, ${linesPresent[i]}=${hi} < ${linesPresent[i - 1]}=${lo}`);
                    break;
                }
            }
        }

        // Monotone growth across age (for height/weight/head). BMI may dip.
        if (['height', 'weight', 'head'].includes(panel.measure)) {
            const m = panel.percentiles[medianKey];
            if (Array.isArray(m)) {
                let drops = 0;
                for (let i = 1; i < m.length; i += 1) {
                    if (Number.isFinite(m[i]) && Number.isFinite(m[i - 1]) && m[i] < m[i - 1] - 0.05) {
                        drops += 1;
                    }
                }
                if (drops > 0) {
                    warnings.push(`${prefix}: ${medianKey} is non-monotone (${drops} drops detected)`);
                }
            }
        }
    });

    return { ok: errors.length === 0, errors, warnings };
}

module.exports = {
    validateCurveData,
    detectLineFamily,
    REQUIRED_PERCENTILES,
    ORDERED_PERCENTILES,
    REQUIRED_SD_LINES,
    ORDERED_SD_LINES,
    PLAUSIBLE_RANGES,
};
