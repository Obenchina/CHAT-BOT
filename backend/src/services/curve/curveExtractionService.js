/**
 * Curve extraction — Stage 2B of the upload pipeline.
 *
 * Used ONLY when no reference curve matches the uploaded image. The AI is
 * asked to read the percentile / SD lines and emit numeric data in the unified
 * JSON schema (same shape as the reference data bank).
 *
 * Importantly, the AI is NOT asked to:
 *   - draw a chart;
 *   - generate code;
 *   - estimate plot-area pixel coordinates;
 *   - overlay anything on the image.
 *
 * It is asked to read numeric values and return them. The output is then
 * validated by curveValidationService before being persisted.
 *
 * Two line families are supported and selected automatically based on the
 * classification source:
 *   - AFPA & similar French charts → SD-style (M-3SD … M+3SD)
 *   - WHO/CDC and most other charts → percentile-style (P3 … P97)
 */
const { callVisionJson } = require('./aiClient');
const { validateCurveData } = require('./curveValidationService');

const REQUIRED_PERCENTILES = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];
const REQUIRED_SD_LINES = ['M-3SD', 'M-2SD', 'M-1SD', 'M', 'M+1SD', 'M+2SD', 'M+3SD'];

function ageSamplesForRange(ageMin, ageMax) {
    const span = ageMax - ageMin;
    if (span <= 24) {
        const ages = [];
        for (let m = Math.round(ageMin); m <= Math.round(ageMax); m += 1) ages.push(m);
        return ages;
    }
    if (span <= 60) {
        const ages = [];
        for (let m = Math.round(ageMin); m <= Math.round(ageMax); m += 3) ages.push(m);
        return ages;
    }
    // Older child: every 6 months. AFPA charts are ages 1-18 → ~36 samples.
    const ages = [];
    for (let m = Math.round(ageMin); m <= Math.round(ageMax); m += 6) ages.push(m);
    return ages;
}

/**
 * Decide which line family to extract based on the classified source.
 * AFPA-CRESS-Inserm 2018 charts use ±SD. WHO/CDC/IOTF use percentiles.
 */
function pickLineFamily(classification) {
    if (!classification) return 'percentile';
    if (classification.source === 'afpa') return 'sd';
    return 'percentile';
}

function lineKeysFor(family) {
    return family === 'sd' ? REQUIRED_SD_LINES : REQUIRED_PERCENTILES;
}

function buildPromptSinglePanel({ classification, ageSamples, family }) {
    const lineKeys = lineKeysFor(family);
    const familyDesc = family === 'sd'
        ? 'standard-deviation lines: M-3SD, M-2SD, M-1SD, M (median), M+1SD, M+2SD, M+3SD (also written as -3σ … +3σ)'
        : 'percentile lines: P3, P10, P25, P50 (median), P75, P90, P97';
    const sampleObj = lineKeys.reduce((acc, k) => {
        acc[k] = '<one value per age, in the chart unit>';
        return acc;
    }, {});

    return `You are reading a pediatric growth-curve chart and extracting the values printed on it.

Chart classification:
- measure: ${classification.measure}
- gender: ${classification.gender}
- ageRange (months): ${classification.ageRange.min} → ${classification.ageRange.max}
- source: ${classification.source}
- title: "${classification.title}"
- expected line family: ${familyDesc}

Strict rules:
- Read each line at each requested age, using the chart's grid lines and tick marks.
- Round to 1 decimal.
- If a line is not visible at a given age (e.g. start of curve), return null for that entry.
- DO NOT hallucinate values for ages outside the visible plot.
- DO NOT mix line families. If the chart shows SD lines, use only the SD keys; if it shows percentile lines, use only the percentile keys.

Ages to sample (months): ${JSON.stringify(ageSamples)}

Return ONLY valid JSON with this exact shape (no prose, no markdown):
{
  "panels": [
    {
      "measure": "${classification.measure}",
      "unit": "<exactly as printed: 'cm', 'kg', 'kg/m²', etc.>",
      "ages": [${ageSamples.join(', ')}],
      "percentiles": ${JSON.stringify(sampleObj, null, 2).replace(/"<[^"]+>"/g, '[/* values */]')}
    }
  ],
  "extractionConfidence": <number 0..1>,
  "notes": "<one short sentence>"
}`;
}

function buildPromptComposite({ classification, ageSamples, family }) {
    const familyDesc = family === 'sd'
        ? 'standard-deviation lines: M-3SD, M-2SD, M-1SD, M (median), M+1SD, M+2SD, M+3SD'
        : 'percentile lines: P3, P10, P25, P50 (median), P75, P90, P97';
    const lineKeys = lineKeysFor(family);
    const sampleLines = lineKeys.map((k) => `        "${k}": [...]`).join(',\n');

    return `You are reading a pediatric COMPOSITE growth-curve chart that contains BOTH a height/taille panel (cm) AND a weight/poids panel (kg) on the same image.

Chart classification:
- gender: ${classification.gender}
- source: ${classification.source}
- ageRange (months): ${classification.ageRange.min} → ${classification.ageRange.max}
- title: "${classification.title}"
- expected line family: ${familyDesc}

Strict rules:
- Both panels share the same X axis (age). Treat them as separate but stacked plots.
- Read each line in BOTH panels at each requested age.
- Round to 1 decimal. Use null where a line is not visible.
- Do not invent values past the visible data range. Do not mix line families.

Ages to sample (months): ${JSON.stringify(ageSamples)}

Return ONLY valid JSON:
{
  "panels": [
    {
      "measure": "height",
      "unit": "cm",
      "ages": [${ageSamples.join(', ')}],
      "percentiles": {
${sampleLines}
      }
    },
    {
      "measure": "weight",
      "unit": "kg",
      "ages": [${ageSamples.join(', ')}],
      "percentiles": {
${sampleLines}
      }
    }
  ],
  "extractionConfidence": <number 0..1>,
  "notes": "<one sentence>"
}`;
}

function shapeIntoCurve({ extracted, classification, sourceLabel, originalName }) {
    if (!extracted || !Array.isArray(extracted.panels)) return null;
    const id = `extracted_${classification.measure}_${classification.gender}_${Date.now()}`;
    return {
        id,
        source: sourceLabel || 'AI-extracted',
        label: classification.title || `${classification.measure} ${classification.gender}`,
        measure: classification.isComposite ? 'height_weight' : classification.measure,
        gender: classification.gender,
        ageRange: classification.ageRange,
        isComposite: !!classification.isComposite,
        panels: extracted.panels.map((p) => ({
            measure: p.measure,
            unit: p.unit,
            // Preserve length so age[i] always lines up with line[i].
            ages: Array.isArray(p.ages)
                ? p.ages.map((v) => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                })
                : [],
            // Coerce non-finite line values (including "N/A"/"—") to null so
            // they do not silently bypass the validator's Number.isFinite checks.
            percentiles: Object.fromEntries(
                Object.entries(p.percentiles || {}).map(([k, arr]) => [
                    k,
                    Array.isArray(arr)
                        ? arr.map((v) => {
                            if (v == null) return null;
                            const n = Number(v);
                            return Number.isFinite(n) ? n : null;
                        })
                        : [],
                ]),
            ),
        })),
        extraction: {
            originalName: originalName || null,
            confidence: Number(extracted.extractionConfidence) || 0,
            notes: typeof extracted.notes === 'string' ? extracted.notes : '',
            extractedAt: new Date().toISOString(),
        },
    };
}

async function extractCurve({ filePath, mimeType, classification, originalName, aiConfig }) {
    if (!classification) return { ok: false, error: 'Missing classification', curve: null };
    if (!aiConfig?.apiKey) return { ok: false, error: 'No AI configured', curve: null };

    const family = pickLineFamily(classification);
    const ageSamples = ageSamplesForRange(classification.ageRange.min, classification.ageRange.max);
    const prompt = classification.isComposite
        ? buildPromptComposite({ classification, ageSamples, family })
        : buildPromptSinglePanel({ classification, ageSamples, family });

    let raw;
    try {
        raw = await callVisionJson({
            prompt,
            filePath,
            mimeType,
            aiConfig,
            maxOutputTokens: 8192,
        });
    } catch (e) {
        return { ok: false, error: `AI call failed: ${e.message}`, curve: null };
    }
    if (!raw) return { ok: false, error: 'AI returned no JSON', curve: null };

    const curve = shapeIntoCurve({
        extracted: raw,
        classification,
        sourceLabel: classification.source === 'afpa'
            ? 'AFPA-CRESS-Inserm 2018 (extracted)'
            : 'AI-extracted',
        originalName,
    });
    if (!curve) return { ok: false, error: 'Extraction shape invalid', curve: null };

    const validation = validateCurveData(curve);
    return {
        ok: validation.ok,
        error: validation.ok ? null : validation.errors.slice(0, 5).join('; '),
        warnings: validation.warnings,
        curve,
        extractedFamily: family,
    };
}

module.exports = {
    extractCurve,
    ageSamplesForRange,
    pickLineFamily,
    REQUIRED_PERCENTILES,
    REQUIRED_SD_LINES,
};
