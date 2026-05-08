/**
 * Math-based validation for growth curve data (reference or AI-extracted).
 *
 * Returns { ok: boolean, errors: string[], warnings: string[] }.
 *
 * Rules:
 *   1. Required fields present (id, panels, panels[i].ages, panels[i].percentiles).
 *   2. Each panel has consistent ages length and per-percentile array length.
 *   3. Required percentiles present: P3, P50, P97 (P10/P25/P75/P90 are optional but recommended).
 *   4. At each age, P3 <= P10 <= P25 <= P50 <= P75 <= P90 <= P97 (strictly non-decreasing).
 *   5. Values are non-decreasing across age (growth is monotone for height, weight, head; BMI may dip slightly).
 *   6. Plausible bounds per measure type.
 */

const REQUIRED_PERCENTILES = ['P3', 'P50', 'P97'];
const ORDERED_PERCENTILES = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];

const PLAUSIBLE_RANGES = {
    height: { min: 30, max: 220 },
    weight: { min: 1, max: 200 },
    head: { min: 25, max: 65 },
    bmi: { min: 8, max: 50 },
};

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
        if (!panel.percentiles || typeof panel.percentiles !== 'object') {
            errors.push(`${prefix}: missing percentiles`);
            return;
        }

        for (const p of REQUIRED_PERCENTILES) {
            if (!Array.isArray(panel.percentiles[p])) {
                errors.push(`${prefix}: missing required percentile ${p}`);
            }
        }

        const expectedLen = panel.ages.length;
        for (const [pName, arr] of Object.entries(panel.percentiles)) {
            if (!Array.isArray(arr)) continue;
            if (arr.length !== expectedLen) {
                errors.push(`${prefix}: percentile ${pName} length ${arr.length} != ages length ${expectedLen}`);
            }
        }

        // Plausible bounds
        const bounds = PLAUSIBLE_RANGES[panel.measure];
        if (bounds) {
            const allValues = Object.values(panel.percentiles).flat().filter((v) => Number.isFinite(v));
            if (allValues.some((v) => v < bounds.min || v > bounds.max)) {
                errors.push(`${prefix}: values outside plausible range [${bounds.min}, ${bounds.max}] ${panel.unit || ''}`);
            }
        }

        // Percentile ordering at each age
        const percentilesPresent = ORDERED_PERCENTILES.filter((p) => Array.isArray(panel.percentiles[p]));
        for (let ageIdx = 0; ageIdx < expectedLen; ageIdx += 1) {
            for (let i = 1; i < percentilesPresent.length; i += 1) {
                const lo = panel.percentiles[percentilesPresent[i - 1]][ageIdx];
                const hi = panel.percentiles[percentilesPresent[i]][ageIdx];
                if (Number.isFinite(lo) && Number.isFinite(hi) && hi < lo - 1e-6) {
                    errors.push(`${prefix}: at age ${panel.ages[ageIdx]}, ${percentilesPresent[i]}=${hi} < ${percentilesPresent[i - 1]}=${lo}`);
                    break; // one error per age is enough
                }
            }
        }

        // Monotone growth across age (for height/weight/head). BMI may dip.
        if (['height', 'weight', 'head'].includes(panel.measure)) {
            const p50 = panel.percentiles.P50;
            if (Array.isArray(p50)) {
                let drops = 0;
                for (let i = 1; i < p50.length; i += 1) {
                    if (Number.isFinite(p50[i]) && Number.isFinite(p50[i - 1]) && p50[i] < p50[i - 1] - 0.05) {
                        drops += 1;
                    }
                }
                if (drops > 0) {
                    warnings.push(`${prefix}: P50 is non-monotone (${drops} drops detected)`);
                }
            }
        }
    });

    return { ok: errors.length === 0, errors, warnings };
}

module.exports = {
    validateCurveData,
    REQUIRED_PERCENTILES,
    ORDERED_PERCENTILES,
    PLAUSIBLE_RANGES,
};
