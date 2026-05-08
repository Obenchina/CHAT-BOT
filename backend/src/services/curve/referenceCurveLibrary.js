/**
 * Reference growth curve library.
 *
 * Loads pre-computed percentile datasets (WHO 2006/2007) from
 * backend/src/data/growth-curves/*.json at startup and exposes lookup helpers.
 *
 * Data flow:
 *   - Each curve file contains a unified schema (see DATA_SCHEMA.md).
 *   - The library never mutates these files at runtime; they ship with the codebase.
 *   - A doctor's saved curve points to one of these by `reference_id` (no data is duplicated).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'growth-curves');

let cache = null;

function loadAll() {
    if (cache) return cache;
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
    const byId = new Map();
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
            const curve = JSON.parse(raw);
            if (!curve?.id) continue;
            byId.set(curve.id, curve);
        } catch (e) {
            console.warn(`[referenceCurveLibrary] Failed to load ${file}:`, e.message);
        }
    }
    cache = byId;
    return cache;
}

function getById(id) {
    return loadAll().get(id) || null;
}

function listIndex() {
    const indexPath = path.join(DATA_DIR, 'index.json');
    try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (e) {
        // Fallback: synthesize from loaded curves
        return Array.from(loadAll().values()).map((c) => ({
            id: c.id,
            label: c.label,
            source: c.source,
            measure: c.measure,
            gender: c.gender,
            isComposite: !!c.isComposite,
            ageRange: c.ageRange,
            panels: (c.panels || []).map((p) => ({ measure: p.measure, unit: p.unit })),
        }));
    }
}

/**
 * Find a reference curve matching the given criteria.
 * Used after AI identifies an uploaded image.
 *
 * @param {Object} criteria
 * @param {string} criteria.measure  e.g. "weight"|"height"|"head"|"bmi"|"height_weight"
 * @param {string} criteria.gender   "male"|"female"
 * @param {Object} [criteria.ageRange] { min, max } in months — must overlap
 * @param {string} [criteria.source] hint, e.g. "WHO"
 * @returns {Object|null}
 */
function findMatching(criteria) {
    const all = Array.from(loadAll().values());
    // 1-month tolerance on edges (e.g. 5 years requested = 60 months, WHO 5-19 starts at 61)
    const TOLERANCE = 2;
    const candidates = all.filter((c) => {
        if (criteria.measure && c.measure !== criteria.measure) return false;
        if (criteria.gender && c.gender !== criteria.gender) return false;
        if (criteria.ageRange) {
            const cr = c.ageRange;
            const { min, max } = criteria.ageRange;
            if (cr.min > min + TOLERANCE) return false;
            if (cr.max + TOLERANCE < max) return false;
        }
        return true;
    });
    if (candidates.length === 0) return null;
    if (criteria.source) {
        const sourceMatch = candidates.find((c) => c.source.toLowerCase().includes(criteria.source.toLowerCase()));
        if (sourceMatch) return sourceMatch;
    }
    // Prefer the smallest age range that still contains the criterion (most specific fit)
    candidates.sort((a, b) => {
        const aSpan = a.ageRange.max - a.ageRange.min;
        const bSpan = b.ageRange.max - b.ageRange.min;
        return aSpan - bSpan;
    });
    return candidates[0];
}

function clearCache() {
    cache = null;
}

module.exports = {
    getById,
    listIndex,
    findMatching,
    loadAll,
    clearCache,
};
