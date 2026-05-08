/**
 * Curve extraction — Stage 2B of the upload pipeline.
 *
 * Used ONLY when no reference curve matches the uploaded image. The AI is
 * asked to read the percentile lines and emit numeric data in the unified
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
 */
const { callVisionJson } = require('./aiClient');
const { validateCurveData } = require('./curveValidationService');

const REQUIRED_PERCENTILES = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];

function ageSamplesForRange(ageMin, ageMax) {
    const span = ageMax - ageMin;
    if (span <= 24) {
        // Child 0-2: monthly
        const ages = [];
        for (let m = Math.round(ageMin); m <= Math.round(ageMax); m += 1) ages.push(m);
        return ages;
    }
    if (span <= 60) {
        // Child 0-5: every 3 months
        const ages = [];
        for (let m = Math.round(ageMin); m <= Math.round(ageMax); m += 3) ages.push(m);
        return ages;
    }
    // Older child: every 6 months
    const ages = [];
    for (let m = Math.round(ageMin); m <= Math.round(ageMax); m += 6) ages.push(m);
    return ages;
}

function buildPromptSinglePanel({ classification, ageSamples }) {
    return `You are reading a pediatric growth-curve chart and extracting the percentile values printed on it.

Chart classification (from a previous step):
- measure: ${classification.measure}
- gender: ${classification.gender}
- ageRange (months): ${classification.ageRange.min} → ${classification.ageRange.max}
- title: "${classification.title}"

Task:
- For EACH age value in the list below, read the y-axis value of EACH percentile curve and return it.
- If the chart has fewer percentile lines than P3/P10/P25/P50/P75/P90/P97, fill missing ones with null.
- Use the chart's grid and tick marks to read values precisely. Round to 1 decimal place.
- DO NOT invent values for ages outside the visible plot area; return null instead.

Ages to sample (months): ${JSON.stringify(ageSamples)}

Return ONLY valid JSON with this exact shape (no prose, no markdown):
{
  "panels": [
    {
      "measure": "${classification.measure}",
      "unit": "<exactly as printed: 'cm', 'kg', 'kg/m²', etc.>",
      "ages": [${ageSamples.join(', ')}],
      "percentiles": {
        "P3":  [<one value per age>],
        "P10": [<one value per age>],
        "P25": [<one value per age>],
        "P50": [<one value per age>],
        "P75": [<one value per age>],
        "P90": [<one value per age>],
        "P97": [<one value per age>]
      }
    }
  ],
  "extractionConfidence": <number 0..1>,
  "notes": "<one short sentence>"
}`;
}

function buildPromptComposite({ classification, ageSamples }) {
    return `You are reading a pediatric COMPOSITE growth-curve chart that contains BOTH a height/taille panel (cm) AND a weight/poids panel (kg) on the same image.

Chart classification:
- gender: ${classification.gender}
- ageRange (months): ${classification.ageRange.min} → ${classification.ageRange.max}
- title: "${classification.title}"

Task:
- For each age value in the list below, read the y-value of each percentile curve in BOTH panels.
- Round to 1 decimal place. Use null if a percentile line is not visible in the chart.

Ages to sample (months): ${JSON.stringify(ageSamples)}

Return ONLY valid JSON:
{
  "panels": [
    {
      "measure": "height",
      "unit": "cm",
      "ages": [${ageSamples.join(', ')}],
      "percentiles": {
        "P3": [...], "P10": [...], "P25": [...], "P50": [...],
        "P75": [...], "P90": [...], "P97": [...]
      }
    },
    {
      "measure": "weight",
      "unit": "kg",
      "ages": [${ageSamples.join(', ')}],
      "percentiles": {
        "P3": [...], "P10": [...], "P25": [...], "P50": [...],
        "P75": [...], "P90": [...], "P97": [...]
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
            // Preserve length so age[i] always lines up with percentile[i].
            // Non-numeric or missing entries become null and are caught later by
            // curveValidationService.
            ages: Array.isArray(p.ages)
                ? p.ages.map((v) => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                })
                : [],
            percentiles: Object.fromEntries(
                Object.entries(p.percentiles || {}).map(([k, arr]) => [
                    k,
                    Array.isArray(arr) ? arr.map((v) => (v == null ? null : Number(v))) : [],
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

    const ageSamples = ageSamplesForRange(classification.ageRange.min, classification.ageRange.max);
    const prompt = classification.isComposite
        ? buildPromptComposite({ classification, ageSamples })
        : buildPromptSinglePanel({ classification, ageSamples });

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
        sourceLabel: 'AI-extracted',
        originalName,
    });
    if (!curve) return { ok: false, error: 'Extraction shape invalid', curve: null };

    const validation = validateCurveData(curve);
    return {
        ok: validation.ok,
        error: validation.ok ? null : validation.errors.slice(0, 5).join('; '),
        warnings: validation.warnings,
        curve,
    };
}

module.exports = {
    extractCurve,
    ageSamplesForRange,
    REQUIRED_PERCENTILES,
};
