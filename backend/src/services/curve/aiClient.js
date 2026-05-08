/**
 * Thin AI client used by curve identification & extraction services.
 *
 * Sends a multimodal prompt (text + image) and parses a strict JSON response.
 * Supports both providers configured by the doctor:
 *   - "openai" (chat completions, response_format=json_object)
 *   - "gemini" (generateContent, responseMimeType=application/json)
 */
const fs = require('fs');

async function fetchWithTimeout(url, options, timeoutMs = 60000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(t);
    }
}

function readImageBase64(filePath) {
    const buf = fs.readFileSync(filePath);
    return buf.toString('base64');
}

function stripJsonEnvelope(text) {
    if (!text) return null;
    const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return cleaned.slice(start, end + 1);
}

async function callGeminiVisionJson({ prompt, imageBase64, mimeType, aiConfig, maxOutputTokens = 8192 }) {
    const model = aiConfig.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiConfig.apiKey}`;
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } },
                ],
            }],
            generationConfig: {
                temperature: 0,
                maxOutputTokens,
                responseMimeType: 'application/json',
            },
        }),
    }, 90000);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini call failed: ${response.status} ${errText}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAiVisionJson({ prompt, imageBase64, mimeType, aiConfig, maxTokens = 8192 }) {
    const model = aiConfig.model || 'gpt-4o-mini';
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You extract structured data from medical chart images. Return strictly valid JSON. No prose.' },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType || 'image/png'};base64,${imageBase64}`, detail: 'high' } },
                    ],
                },
            ],
        }),
    }, 90000);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI call failed: ${response.status} ${errText}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * High-level helper. Reads the image file, sends it with the prompt,
 * parses the JSON response, and returns the parsed object (or null on failure).
 */
async function callVisionJson({ prompt, filePath, mimeType, aiConfig, maxOutputTokens = 8192 }) {
    if (!aiConfig?.apiKey) return null;
    const provider = aiConfig.provider === 'openai' ? 'openai' : 'gemini';
    const imageBase64 = readImageBase64(filePath);
    const text = provider === 'openai'
        ? await callOpenAiVisionJson({ prompt, imageBase64, mimeType, aiConfig, maxTokens: maxOutputTokens })
        : await callGeminiVisionJson({ prompt, imageBase64, mimeType, aiConfig, maxOutputTokens });
    const jsonText = stripJsonEnvelope(text);
    if (!jsonText) return null;
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.warn('[curve aiClient] Failed to parse JSON response:', e.message);
        return null;
    }
}

module.exports = {
    callVisionJson,
    callGeminiVisionJson,
    callOpenAiVisionJson,
    stripJsonEnvelope,
};
