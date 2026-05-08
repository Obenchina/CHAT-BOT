const zlib = require('zlib');
const fs = require('fs');

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) {
        crc ^= buffer[i];
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    const crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodeRgbImageToPng(image) {
    const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(image.width, 0);
    ihdr.writeUInt32BE(image.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const rowLength = image.width * 3;
    const scanlines = Buffer.alloc((rowLength + 1) * image.height);

    for (let y = 0; y < image.height; y += 1) {
        const dstRow = y * (rowLength + 1);
        scanlines[dstRow] = 0;
        image.raw.copy(scanlines, dstRow + 1, y * rowLength, (y + 1) * rowLength);
    }

    return Buffer.concat([
        header,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 6 })),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

function stripJsonEnvelope(text) {
    if (!text) return null;
    const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return cleaned.slice(start, end + 1);
}

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeMeasureKey(value, fallback) {
    const raw = String(value || fallback || '').toLowerCase();
    if (['weight', 'poids'].includes(raw)) return 'weight';
    if (['height', 'taille', 'length'].includes(raw)) return 'height';
    if (['weight_height', 'height_weight', 'poids_taille', 'taille_poids', 'poids-taille', 'taille-poids'].includes(raw)) return 'weight_height';
    if (['head', 'head_circumference', 'pc', 'perimetre_cranien'].includes(raw)) return 'head';
    if (['bmi', 'imc'].includes(raw)) return 'bmi';
    return fallback || 'weight';
}

function normalizeGender(value, fallback) {
    const raw = String(value || fallback || '').toLowerCase();
    if (['male', 'boy', 'boys', 'garcon', 'garcons', 'm'].includes(raw)) return 'male';
    if (['female', 'girl', 'girls', 'fille', 'filles', 'f'].includes(raw)) return 'female';
    return fallback || 'male';
}

/**
 * Compute precise plot_area from two reference points per axis.
 * Each reference point has: { value: <number>, percent: <percent of image> }
 *
 * For Y-axis (inverted: higher value = lower percent):
 *   Given ref1 (value=V1, percent=P1) and ref2 (value=V2, percent=P2)
 *   where V1 > V2 and P1 < P2 (higher value is at lower percent = higher on image):
 *   plot_area.top = P1 - (yMax - V1) * (P2 - P1) / (V1 - V2)
 *   plot_area.bottom = P2 + (V2 - yMin) * (P2 - P1) / (V1 - V2)
 *
 * For X-axis (normal: higher value = higher percent):
 *   plot_area.left = P1 - (X1 - xMin) * (P2 - P1) / (X2 - X1)
 *   plot_area.right = P2 + (xMax - X2) * (P2 - P1) / (X2 - X1)
 */
function computePlotAreaFromRefs(xRefs, yRefs, xMin, xMax, yMin, yMax) {
    let left = 5, right = 95, top = 5, bottom = 95;

    if (xRefs && xRefs.length >= 2) {
        // Sort by value ascending
        const sorted = [...xRefs].sort((a, b) => a.value - b.value);
        const x1 = sorted[0], x2 = sorted[sorted.length - 1];
        const pxPerUnit = (x2.percent - x1.percent) / (x2.value - x1.value);
        if (pxPerUnit > 0) {
            left = x1.percent - (x1.value - xMin) * pxPerUnit;
            right = x2.percent + (xMax - x2.value) * pxPerUnit;
        }
    }

    if (yRefs && yRefs.length >= 2) {
        // Sort by value descending (higher value = lower percent on image)
        const sorted = [...yRefs].sort((a, b) => b.value - a.value);
        const y1 = sorted[0], y2 = sorted[sorted.length - 1]; // y1 is highest value, lowest percent
        const pxPerUnit = (y2.percent - y1.percent) / (y1.value - y2.value);
        if (pxPerUnit > 0) {
            top = y1.percent - (yMax - y1.value) * pxPerUnit;
            bottom = y2.percent + (y2.value - yMin) * pxPerUnit;
        }
    }

    // Clamp to reasonable range
    left = Math.max(0, Math.min(left, 40));
    top = Math.max(0, Math.min(top, 40));
    right = Math.max(60, Math.min(right, 100));
    bottom = Math.max(60, Math.min(bottom, 100));

    return { left: Number(left.toFixed(2)), top: Number(top.toFixed(2)), right: Number(right.toFixed(2)), bottom: Number(bottom.toFixed(2)) };
}

// ────── Validate a single-measure AI calibration result ──────
function validateCalibration(candidate, fallbackConfig, fallbackMeasureKey, fallbackGender) {
    if (!candidate || typeof candidate !== 'object') return null;

    const measureKey = normalizeMeasureKey(candidate.measure_key || candidate.measure, fallbackMeasureKey);
    const gender = normalizeGender(candidate.gender, fallbackGender);
    const xMin = numberOrNull(candidate.x_min);
    const xMax = numberOrNull(candidate.x_max);
    const yMin = numberOrNull(candidate.y_min);
    const yMax = numberOrNull(candidate.y_max);
    const confidence = numberOrNull(candidate.confidence) ?? 0;

    if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return null;
    if (xMax <= xMin || yMax <= yMin) return null;
    if (confidence < 0.5) return null;

    // Compute precise plot_area from reference points if available
    let plotArea;
    if (candidate.x_reference_points && candidate.y_reference_points) {
        plotArea = computePlotAreaFromRefs(
            candidate.x_reference_points, candidate.y_reference_points,
            xMin, xMax, yMin, yMax
        );
    } else {
        const p = candidate.plot_area || {};
        plotArea = {
            left: numberOrNull(p.left) ?? 5,
            top: numberOrNull(p.top) ?? 5,
            right: numberOrNull(p.right) ?? 95,
            bottom: numberOrNull(p.bottom) ?? 95
        };
    }

    if (plotArea.right - plotArea.left < 30 || plotArea.bottom - plotArea.top < 30) return null;

    return {
        source: 'ai_calibrated',
        ai_provider: candidate.ai_provider,
        label: candidate.label || fallbackConfig?.label || `${measureKey} ${gender}`,
        measure_key: measureKey,
        gender,
        x_min: xMin, x_max: xMax,
        y_min: yMin, y_max: yMax,
        x_unit: candidate.x_unit || 'months',
        y_unit: candidate.y_unit || '',
        plot_area: plotArea,
        auto_confidence: Number(confidence.toFixed(3))
    };
}

// ────── Validate a combined (weight_height) AI calibration result ──────
function validateCombinedCalibration(candidate, fallbackGender) {
    if (!candidate || typeof candidate !== 'object') return null;

    const gender = normalizeGender(candidate.gender, fallbackGender);
    const confidence = numberOrNull(candidate.confidence) ?? 0;
    if (confidence < 0.4) return null;

    const mc = candidate.measure_configs;
    if (!mc || typeof mc !== 'object' || !mc.height || !mc.weight) return null;

    function validateSubConfig(sub, type) {
        if (!sub || typeof sub !== 'object') return null;
        const xMin = numberOrNull(sub.x_min);
        const xMax = numberOrNull(sub.x_max);
        const yMin = numberOrNull(sub.y_min);
        const yMax = numberOrNull(sub.y_max);

        if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return null;
        if (xMax <= xMin || yMax <= yMin) return null;

        // Compute precise plot_area from reference points if available
        let plotArea;
        if (sub.x_reference_points && sub.y_reference_points) {
            plotArea = computePlotAreaFromRefs(
                sub.x_reference_points, sub.y_reference_points,
                xMin, xMax, yMin, yMax
            );
        } else {
            const p = sub.plot_area || {};
            plotArea = {
                left: numberOrNull(p.left) ?? 5,
                top: numberOrNull(p.top) ?? 5,
                right: numberOrNull(p.right) ?? 95,
                bottom: numberOrNull(p.bottom) ?? 95
            };
        }

        if (plotArea.right - plotArea.left < 15 || plotArea.bottom - plotArea.top < 10) return null;

        return {
            x_min: xMin, x_max: xMax,
            y_min: yMin, y_max: yMax,
            x_unit: sub.x_unit || 'months',
            y_unit: sub.y_unit || (type === 'weight' ? 'kg' : 'cm'),
            plot_area: plotArea
        };
    }

    const heightConfig = validateSubConfig(mc.height, 'height');
    const weightConfig = validateSubConfig(mc.weight, 'weight');
    if (!heightConfig || !weightConfig) return null;

    return {
        source: 'ai_calibrated',
        ai_provider: candidate.ai_provider,
        label: candidate.label || `Poids + Taille (${gender === 'male' ? 'G' : 'F'})`,
        measure_key: 'weight_height',
        gender,
        x_min: heightConfig.x_min, x_max: heightConfig.x_max,
        y_min: heightConfig.y_min, y_max: heightConfig.y_max,
        x_unit: heightConfig.x_unit, y_unit: 'cm',
        plot_area: heightConfig.plot_area,
        measure_configs: { height: heightConfig, weight: weightConfig },
        auto_confidence: Number(confidence.toFixed(3))
    };
}

// ────── Prompts ──────
function buildCalibrationPrompt({ originalName, fallbackMeasureKey, fallbackGender }) {
    return `You are calibrating a pediatric growth chart image for PRECISE data point plotting.

Return ONLY valid JSON. No markdown.

Task:
1. Read the chart title, axes, tick labels, and grid lines.
2. Detect the clinical measurement type and gender.
3. Detect x-axis range in MONTHS (convert years to months: 1 year = 12 months).
4. Detect y-axis range and unit.
5. CRITICAL — Identify 2 clearly visible tick marks on each axis as reference points:
   - For x-axis: Pick two tick marks far apart. For each, give the value (in months) and its horizontal position as a percentage of image width.
   - For y-axis: Pick two tick marks far apart. For each, give the value and its vertical position as a percentage of image height (0% = top of image, 100% = bottom).

CRITICAL INSTRUCTION: Read the ACTUAL numbers from the image. DO NOT copy the placeholder numbers from the example JSON below!

Original filename: ${originalName || 'unknown'}
Fallback measure_key: ${fallbackMeasureKey || 'unknown'}
Fallback gender: ${fallbackGender || 'male'}

Return this JSON shape:
{
  "measure_key": "height",
  "gender": "male",
  "label": "Taille (G)",
  "x_min": 999,
  "x_max": 999,
  "x_unit": "months",
  "y_min": 999,
  "y_max": 999,
  "y_unit": "cm",
  "x_reference_points": [
    { "value": 999, "percent": 15.5 },
    { "value": 999, "percent": 82.3 }
  ],
  "y_reference_points": [
    { "value": 999, "percent": 12.0 },
    { "value": 999, "percent": 78.5 }
  ],
  "confidence": 0.92,
  "notes": "short reason"
}`;
}

function buildCombinedCalibrationPrompt({ originalName, fallbackGender }) {
    return `You are calibrating a COMBINED pediatric growth chart image that contains BOTH height (taille/cm) and weight (poids/kg) curves on the SAME image.

Return ONLY valid JSON. No markdown.

Task:
- This image has TWO plotting areas: height (cm) in the upper portion and weight (kg) in the lower portion.
- They share the same x-axis (age) but have DIFFERENT y-axes and occupy DIFFERENT vertical regions.
- For EACH measure (height and weight), detect:
  1. x-axis range in MONTHS (convert years to months: 1y = 12m). Look at the extreme left and right of the grid.
  2. y-axis range and unit. Look at the top and bottom numbers of the grid.
  3. CRITICAL — 2 reference points per axis for PRECISE calibration:
     - x_reference_points: Two x-axis tick marks with value (months) and horizontal position (% of image width).
     - y_reference_points: Two y-axis tick marks with value and vertical position (% of image height, 0%=top, 100%=bottom).

CRITICAL INSTRUCTION: You MUST extract the actual numbers from the image pixels. DO NOT copy the "999" placeholder values from the example below! The example is just to show the structure.

Original filename: ${originalName || 'unknown'}
Fallback gender: ${fallbackGender || 'male'}

Return this exact JSON shape:
{
  "measure_key": "weight_height",
  "gender": "male",
  "label": "Poids + Taille (G)",
  "measure_configs": {
    "height": {
      "x_min": 999,
      "x_max": 999,
      "x_unit": "months",
      "y_min": 999,
      "y_max": 999,
      "y_unit": "cm",
      "x_reference_points": [
        { "value": 999, "percent": 12.5 },
        { "value": 999, "percent": 82.0 }
      ],
      "y_reference_points": [
        { "value": 999, "percent": 8.0 },
        { "value": 999, "percent": 48.0 }
      ]
    },
    "weight": {
      "x_min": 999,
      "x_max": 999,
      "x_unit": "months",
      "y_min": 999,
      "y_max": 999,
      "y_unit": "kg",
      "x_reference_points": [
        { "value": 999, "percent": 12.5 },
        { "value": 999, "percent": 82.0 }
      ],
      "y_reference_points": [
        { "value": 999, "percent": 57.0 },
        { "value": 999, "percent": 90.0 }
      ]
    }
  },
  "confidence": 0.88,
  "notes": "Height in upper half, weight in lower half"
}`;
}

// ────── API calls ──────
async function fetchWithTimeout(url, options, timeoutMs = 45000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function callGeminiCalibration(prompt, base64, cfg, mimeType) {
    const model = cfg.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: mimeType || 'image/png', data: base64 } }
                ]
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 2500, responseMimeType: 'application/json' }
        })
    });
    if (!response.ok) throw new Error(`Gemini calibration failed: ${response.status} ${await response.text()}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAiCalibration(prompt, base64, cfg) {
    const model = cfg.model || 'gpt-4o-mini';
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
            model, temperature: 0, max_tokens: 2500,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You extract precise chart calibration metadata from medical chart images. Return JSON only.' },
                { role: 'user', content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } }
                ]}
            ]
        })
    });
    if (!response.ok) throw new Error(`OpenAI calibration failed: ${response.status} ${await response.text()}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// ────── Main calibration functions ──────

async function calibrateGrowthChartWithAI({ image, originalName, fallbackConfig, fallbackMeasureKey, fallbackGender, aiConfig }) {
    if (!aiConfig?.apiKey || !image?.raw) return null;
    try {
        const pngBase64 = encodeRgbImageToPng(image).toString('base64');
        const prompt = buildCalibrationPrompt({ originalName, fallbackMeasureKey, fallbackGender });
        const provider = aiConfig.provider === 'openai' ? 'openai' : 'gemini';
        const text = provider === 'openai'
            ? await callOpenAiCalibration(prompt, pngBase64, aiConfig)
            : await callGeminiCalibration(prompt, pngBase64, aiConfig, 'image/png');
        const jsonText = stripJsonEnvelope(text);
        if (!jsonText) return null;
        const parsed = JSON.parse(jsonText);
        parsed.ai_provider = provider;
        return validateCalibration(parsed, fallbackConfig, fallbackMeasureKey, fallbackGender);
    } catch (error) {
        console.warn('Growth curve AI calibration skipped:', error.message);
        return null;
    }
}

async function calibrateImageFileWithAI({ filePath, mimeType, originalName, fallbackMeasureKey, fallbackGender, fallbackConfig, aiConfig }) {
    if (!aiConfig?.apiKey) return null;
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const base64 = fileBuffer.toString('base64');
        const provider = aiConfig.provider === 'openai' ? 'openai' : 'gemini';
        const isCombined = fallbackMeasureKey === 'weight_height';

        const prompt = isCombined
            ? buildCombinedCalibrationPrompt({ originalName, fallbackGender })
            : buildCalibrationPrompt({ originalName, fallbackMeasureKey, fallbackGender });

        const text = provider === 'openai'
            ? await callOpenAiCalibration(prompt, base64, aiConfig)
            : await callGeminiCalibration(prompt, base64, aiConfig, mimeType || 'image/jpeg');

        const jsonText = stripJsonEnvelope(text);
        if (!jsonText) return null;
        const parsed = JSON.parse(jsonText);
        parsed.ai_provider = provider;

        if (isCombined) {
            return validateCombinedCalibration(parsed, fallbackGender);
        }
        return validateCalibration(parsed, fallbackConfig, fallbackMeasureKey, fallbackGender);
    } catch (error) {
        console.warn('Image file AI calibration skipped:', error.message);
        return null;
    }
}

module.exports = {
    calibrateGrowthChartWithAI,
    calibrateImageFileWithAI
};
