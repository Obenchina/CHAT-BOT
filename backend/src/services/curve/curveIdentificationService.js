/**
 * Curve identification — Stage 1 of the upload pipeline.
 *
 * Asks the AI to classify an uploaded growth-curve image without extracting
 * any data points yet. The classification is then used to:
 *   1. Try to match a known reference curve (zero-cost path).
 *   2. If no match, hand off to curveExtractionService to digitize the image.
 */
const { callVisionJson } = require('./aiClient');

const VALID_MEASURES = ['weight', 'height', 'head', 'bmi', 'height_weight'];
const VALID_GENDERS = ['male', 'female'];
const VALID_SOURCES = ['who', 'cdc', 'afpa', 'iotf', 'unknown'];

function buildPrompt() {
    return `You are looking at a pediatric GROWTH CURVE chart (taille / poids / périmètre crânien / IMC).

Classify the chart by examining the title, axis labels, legend, and source watermark.
Return ONLY valid JSON. No prose, no markdown.

Output schema:
{
  "source": "who" | "cdc" | "afpa" | "iotf" | "unknown",
  "measure": "weight" | "height" | "head" | "bmi" | "height_weight",
  "gender": "male" | "female",
  "ageRange": { "min": <integer months>, "max": <integer months> },
  "isComposite": <true if the chart shows BOTH height and weight on the same image, else false>,
  "title": "<chart title verbatim, or empty string>",
  "confidence": <number between 0 and 1>,
  "notes": "<one short sentence explaining the classification>"
}

Rules:
- Convert years to months (1 year = 12 months).
- "height_weight" is ONLY for charts where height (cm) AND weight (kg) curves coexist on the same page.
- If you genuinely cannot tell, set source="unknown" and confidence < 0.5.
- Set gender to "male" for boys/garçons and "female" for girls/filles.
- ageRange.min should be the smallest age tick visible; ageRange.max the largest.`;
}

function normalizeClassification(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const source = String(raw.source || 'unknown').toLowerCase();
    const measure = String(raw.measure || '').toLowerCase();
    const gender = String(raw.gender || '').toLowerCase();

    if (!VALID_MEASURES.includes(measure)) return null;
    if (!VALID_GENDERS.includes(gender)) return null;

    const ageRange = raw.ageRange || raw.age_range || {};
    const ageMin = Number(ageRange.min);
    const ageMax = Number(ageRange.max);
    if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMax <= ageMin) return null;

    const confidence = Number(raw.confidence);

    return {
        source: VALID_SOURCES.includes(source) ? source : 'unknown',
        measure,
        gender,
        ageRange: { min: Math.round(ageMin), max: Math.round(ageMax), unit: 'months' },
        isComposite: Boolean(raw.isComposite),
        title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
        notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 300) : '',
    };
}

async function identifyCurve({ filePath, mimeType, aiConfig }) {
    if (!aiConfig?.apiKey) return null;
    try {
        const raw = await callVisionJson({
            prompt: buildPrompt(),
            filePath,
            mimeType,
            aiConfig,
            maxOutputTokens: 1024,
        });
        return normalizeClassification(raw);
    } catch (e) {
        console.warn('[curveIdentificationService] failed:', e.message);
        return null;
    }
}

module.exports = {
    identifyCurve,
    normalizeClassification,
};
