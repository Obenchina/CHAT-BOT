const zlib = require('zlib');

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
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // truecolor RGB
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
    if (['head', 'head_circumference', 'pc', 'perimetre_cranien'].includes(raw)) return 'head';
    if (['bmi', 'imc'].includes(raw)) return 'bmi';
    return fallback || 'weight';
}

function normalizeGender(value, fallback) {
    const raw = String(value || fallback || '').toLowerCase();
    if (['male', 'boy', 'boys', 'garcon', 'garcons', 'm'].includes(raw)) return 'male';
    if (['female', 'girl', 'girls', 'fille', 'filles', 'f'].includes(raw)) return 'female';
    return fallback || 'both';
}

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
    if (right - left < 35 || bottom - top < 35) return null;
    if (confidence < 0.65) return null;

    const plausible = {
        weight: { yMin: 0, yMax: 250 },
        height: { yMin: 30, yMax: 230 },
        head: { yMin: 20, yMax: 80 },
        bmi: { yMin: 5, yMax: 60 }
    }[measureKey] || { yMin: -1000, yMax: 1000 };

    if (yMin < plausible.yMin || yMax > plausible.yMax) return null;

    return {
        source: 'ai_calibrated',
        ai_provider: candidate.ai_provider,
        label: candidate.label || fallbackConfig?.label || `${measureKey} ${gender}`,
        measure_key: measureKey,
        gender,
        x_min: xMin,
        x_max: xMax,
        y_min: yMin,
        y_max: yMax,
        x_unit: candidate.x_unit || candidate.x_axis?.unit || fallbackConfig?.x_unit || 'months',
        y_unit: candidate.y_unit || candidate.y_axis?.unit || fallbackConfig?.y_unit || '',
        plot_area: { left, top, right, bottom },
        auto_confidence: Number(confidence.toFixed(3)),
        fallback_config: fallbackConfig ? {
            source: fallbackConfig.source,
            x_min: fallbackConfig.x_min,
            x_max: fallbackConfig.x_max,
            y_min: fallbackConfig.y_min,
            y_max: fallbackConfig.y_max,
            plot_area: fallbackConfig.plot_area
        } : null
    };
}

function buildCalibrationPrompt({ originalName, fallbackConfig, fallbackMeasureKey, fallbackGender }) {
    return `You are calibrating a pediatric growth chart image for deterministic plotting.

Return ONLY valid JSON. No markdown.

Task:
- Read the chart title, axes, tick labels, and grid.
- Detect the clinical measurement type.
- Detect gender when visible.
- Detect x-axis numeric range in months.
- Detect y-axis numeric range and unit.
- Estimate the plot_area as percentages of the full image bounds: left, top, right, bottom.
- If the image is rotated or upside down, still return the calibration for the visible image orientation.

Allowed measure_key values: weight, height, head, bmi.
Allowed gender values: male, female, both.

Original filename: ${originalName || 'unknown'}
Fallback measure_key: ${fallbackMeasureKey || 'unknown'}
Fallback gender: ${fallbackGender || 'both'}
Fallback config: ${JSON.stringify(fallbackConfig || {})}

Return this JSON shape:
{
  "measure_key": "height",
  "gender": "male",
  "label": "Taille (G)",
  "x_min": 0,
  "x_max": 36,
  "x_unit": "months",
  "y_min": 40,
  "y_max": 110,
  "y_unit": "cm",
  "plot_area": { "left": 5.0, "top": 5.0, "right": 95.0, "bottom": 87.0 },
  "confidence": 0.92,
  "notes": "short reason"
}`;
}

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function callGeminiCalibration(prompt, pngBase64, cfg) {
    const model = cfg.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: pngBase64 } }
                ]
            }],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 1200,
                responseMimeType: 'application/json'
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini calibration failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAiCalibration(prompt, pngBase64, cfg) {
    const model = cfg.model || 'gpt-4o-mini';
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 1200,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You extract precise chart calibration metadata from medical chart images. Return JSON only.' },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}`, detail: 'high' } }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI calibration failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function calibrateGrowthChartWithAI({ image, originalName, fallbackConfig, fallbackMeasureKey, fallbackGender, aiConfig }) {
    if (!aiConfig?.apiKey || !image?.raw) return null;

    try {
        const pngBase64 = encodeRgbImageToPng(image).toString('base64');
        const prompt = buildCalibrationPrompt({ originalName, fallbackConfig, fallbackMeasureKey, fallbackGender });
        const provider = aiConfig.provider === 'openai' ? 'openai' : 'gemini';

        const text = provider === 'openai'
            ? await callOpenAiCalibration(prompt, pngBase64, aiConfig)
            : await callGeminiCalibration(prompt, pngBase64, aiConfig);

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

module.exports = {
    calibrateGrowthChartWithAI
};
