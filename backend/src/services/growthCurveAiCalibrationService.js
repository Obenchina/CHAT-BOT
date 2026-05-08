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

// ────── Validate a single-measure AI calibration result ──────
function validateCalibration(candidate, fallbackConfig, fallbackMeasureKey, fallbackGender) {
    if (!candidate || typeof candidate !== 'object') return null;

    const measureKey = normalizeMeasureKey(candidate.measure_key || candidate.measure, fallbackMeasureKey);
    const gender = normalizeGender(candidate.gender, fallbackGender);
    const xMin = numberOrNull(candidate.x_min ?? candidate.x_axis?.min);
    const xMax = numberOrNull(candidate.x_max ?? candidate.x_axis?.max);
    const yMin = numberOrNull(candidate.y_min ?? candidate.y_axis?.min);
    const yMax = numberOrNull(candidate.y_max ?? candidate.y_axis?.max);
    const plot = candidate.plot_area || {};
    const left = numberOrNull(plot.left);
    const top = numberOrNull(plot.top);
    const right = numberOrNull(plot.right);
    const bottom = numberOrNull(plot.bottom);
    const confidence = numberOrNull(candidate.confidence) ?? 0;

    if (![xMin, xMax, yMin, yMax, left, top, right, bottom].every(Number.isFinite)) return null;
    if (xMax <= xMin || yMax <= yMin) return null;
    if (left < 0 || top < 0 || right > 100 || bottom > 100) return null;
    if (right - left < 30 || bottom - top < 30) return null;
    if (confidence < 0.5) return null;

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
        plot_area: { left, top, right, bottom },
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
        const p = sub.plot_area || {};
        const left = numberOrNull(p.left);
        const top = numberOrNull(p.top);
        const right = numberOrNull(p.right);
        const bottom = numberOrNull(p.bottom);

        if (![xMin, xMax, yMin, yMax, left, top, right, bottom].every(Number.isFinite)) return null;
        if (xMax <= xMin || yMax <= yMin) return null;
        if (left < 0 || top < 0 || right > 100 || bottom > 100) return null;
        if (right - left < 15 || bottom - top < 10) return null;

        return {
            x_min: xMin, x_max: xMax,
            y_min: yMin, y_max: yMax,
            x_unit: sub.x_unit || 'months',
            y_unit: sub.y_unit || (type === 'weight' ? 'kg' : 'cm'),
            plot_area: { left, top, right, bottom }
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
5. Estimate the plot_area as percentages of the full image bounds: left, top, right, bottom.
   The plot_area must precisely match where the actual data grid starts and ends (where the axes lines are).

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
  "plot_area": { "left": 999, "top": 999, "right": 999, "bottom": 999 },
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
  3. The plot_area as percentages of the FULL image: left, top, right, bottom.
     - Height chart is typically in the UPPER portion.
     - Weight chart is typically in the LOWER portion.
     - They should NOT overlap significantly.

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
      "plot_area": { "left": 999, "top": 999, "right": 999, "bottom": 999 }
    },
    "weight": {
      "x_min": 999,
      "x_max": 999,
      "x_unit": "months",
      "y_min": 999,
      "y_max": 999,
      "y_unit": "kg",
      "plot_area": { "left": 999, "top": 999, "right": 999, "bottom": 999 }
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
