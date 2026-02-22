/**
 * AI Service
 * Gemini API integration for medical case analysis
 */

const config = require('../config/config');

/**
 * Analyze medical case using Gemini AI
 * @param {Object} caseData - Full case data including patient, answers, documents
 * @returns {Promise<Object>} AI analysis result
 */
/**
 * Analyze medical case using Gemini AI
 * @param {Object} caseData - Full case data including patient, answers, documents
 * @returns {Promise<Object>} AI analysis result
 */
async function analyzeCase(caseData) {
    try {
        // Check if API key is configured
        if (!config.ai.apiKey) {
            console.warn('Gemini API key not configured');
            return {
                summary: 'AI analysis not available - API key not configured',
                symptoms: [],
                hypotheses: [],
                recommendations: []
            };
        }

        // Build prompt from case data (Text)
        const textPrompt = buildAnalysisPrompt(caseData);

        // Get images from case data
        const imageParts = await getImagesFromCase(caseData);

        // Combine text and images
        const promptParts = [
            { text: textPrompt },
            ...imageParts
        ];

        // Call Gemini API
        const response = await callGeminiAPI(promptParts);

        return parseAnalysisResponse(response);
    } catch (error) {
        console.error('AI analysis error:', error);
        return {
            summary: 'AI analysis failed',
            symptoms: [],
            hypotheses: [],
            recommendations: [],
            error: error.message
        };
    }
}

/**
 * Get images from case data and convert to base64
 * @param {Object} caseData - Case data
 * @returns {Promise<Array>} Array of image parts for Gemini
 */
async function getImagesFromCase(caseData) {
    const fs = require('fs').promises;
    const path = require('path');
    const imageParts = [];

    // process documents
    if (caseData.documents && caseData.documents.length > 0) {
        for (const doc of caseData.documents) {
            // Unify property access (DB uses snake_case, API uses camelCase)
            const fileName = doc.file_name || doc.fileName;
            const filePath = doc.file_path || doc.filePath;
            // Handle both type property names and 'imagery' value
            let docType = doc.document_type || doc.type || doc.documentType;

            console.log(`Processing document for AI: ID=${doc.id}, fileName=${fileName}, type=${docType}, path=${filePath}`);

            // Check if document is an image
            const isImage = (fileName && fileName.match(/\.(jpg|jpeg|png|webp)$/i)) ||
                (docType && docType.startsWith('image/')) ||
                (docType === 'imagery') || (docType === 'imagerie');

            if (isImage) {
                try {
                    const absolutePath = path.isAbsolute(filePath)
                        ? filePath
                        : path.join(__dirname, '../../uploads', filePath);

                    const imageBuffer = await fs.readFile(absolutePath);
                    const base64Image = imageBuffer.toString('base64');

                    // Determine mime type
                    let mimeType = 'image/jpeg';
                    if (docType && docType.startsWith('image/')) {
                        mimeType = docType;
                    } else if (fileName) {
                        const ext = path.extname(fileName).toLowerCase().replace('.', '');
                        mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                    }

                    imageParts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    });
                    console.log(`Added image to analysis: ${fileName}`);
                } catch (error) {
                    console.error(`Failed to read image ${fileName}:`, error.message);
                }
            }
        }
    }

    return imageParts;
}

/**
 * Build analysis prompt from case data (Arabic)
 * @param {Object} caseData - Case data
 * @returns {string} Formatted prompt
 */
function buildAnalysisPrompt(caseData) {
    const { patient, answers } = caseData;

    let prompt = `أنت مساعد طبي متخصص يعمل مع طبيب في عيادته. الطبيب يستعرض حالة مريض وأنت تساعده بتحليل المعلومات المقدمة.

مهمتك:
1. تلخيص الحالة السريرية بناءً على إجابات المريض والصور المرفقة (إن وجدت)
2. اقتراح تشخيصات محتملة مع درجة الاحتمالية والتفسير، مع الإشارة إلى أي علامات ظاهرة في الصور
3. اقتراح قائمة أدوية مناسبة (اسم الدواء، الجرعة، المدة، الملاحظات)

⚠️ تذكر: المريض موجود بالفعل عند الطبيب ويتم فحصه. لا تقترح "زيارة طبيب" أو "استشارة متخصص" إلا في حالات الطوارئ الشديدة.

═══════════════════════════════
معلومات المريض:
═══════════════════════════════
- الاسم: ${patient.first_name} ${patient.last_name}
- الجنس: ${patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : 'غير محدد'}
- العمر: ${patient.age} سنة

═══════════════════════════════
إجابات الاستبيان الطبي:
═══════════════════════════════`;

    // Add questionnaire answers
    answers.forEach((answer, index) => {
        const answerText = answer.transcribed_text || 'لم يتم تقديم إجابة';
        prompt += `\n\n${index + 1}. السؤال: ${answer.question_text}`;
        prompt += `\n   الإجابة: ${answerText}`;
    });

    prompt += `

═══════════════════════════════
المطلوب:
═══════════════════════════════

قدم تحليلك بصيغة JSON التالية (بالعربية، باستثناء قسم الأدوية يجب أن يكون بالفرنسية العلمية):
{
  "summary": "ملخص سريري شامل للحالة بناءً على الأعراض المذكورة والملاحظات من الصور",
  "diagnoses": [
    {
      "name": "اسم التشخيص المحتمل",
      "probability": "عالية/متوسطة/منخفضة",
      "reasoning": "التفسير المختصر لهذا التشخيص (اذكر أدلة من الصور إذا كانت ذات صلة)"
    }
  ],
  "medications": [
    {
      "name": "Nom du médicament (en Français)",
      "dosage": "Dosage (ex: 500mg)",
      "frequency": "Fréquence (ex: 3x/j, 1x/soir, QSP)",
      "duration": "Durée (ex: 7 jours)"
    }
  ],
  "additionalNotes": "أي ملاحظات إضافية للطبيب"
}`;

    return prompt;
}

/**
 * Call Gemini API
 * @param {Array} promptParts - Analysis prompt content parts
 * @returns {Promise<string>} API response
 */
async function callGeminiAPI(promptParts) {
    const apiKey = config.ai.apiKey;
    const model = config.ai.model; // Use configured model (e.g., gemini-2.0-flash-lite-preview-02-05)
    // Use flash model for multimodal capabilities
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
        try {
            console.log(`Calling Gemini API (Model: ${model}, Attempt: ${retryCount + 1})...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: promptParts
                        }
                    ],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2000
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text;
                }
                throw new Error('Invalid API response format');
            }

            // Handle 429 Too Many Requests
            if (response.status === 429) {
                console.warn(`Gemini API Rate Limit (429) hit.`);

                // Calculate delay: Use Retry-After header if available, else exponential backoff
                let delay = 5000 * Math.pow(2, retryCount); // Default: 5s, 10s, 20s

                const retryAfterHeader = response.headers.get('Retry-After');
                if (retryAfterHeader) {
                    delay = parseInt(retryAfterHeader, 10) * 1000; // Convert seconds to ms
                    console.log(`Retry-After header found: waiting ${delay}ms`);
                } else {
                    console.log(`No Retry-After header. Using exponential backoff: ${delay}ms`);
                }

                if (retryCount === MAX_RETRIES) {
                    throw new Error(`Gemini API Rate Limit Exceeded after ${MAX_RETRIES} retries.`);
                }

                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue; // Retry loop
            }

            // Other errors
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);

        } catch (error) {
            // Re-throw if it's a max retries error or other fatal error not caught above
            if (retryCount === MAX_RETRIES || !error.message.includes('Rate Limit')) {
                throw error;
            }
            // If network error (e.g. fetch failed), also retry
            console.error(`Network/Unknown error during API call: ${error.message}`);
            let delay = 5000 * Math.pow(2, retryCount);
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
        }
    }
}

/**
 * Parse AI response into structured format
 * @param {string} response - Raw API response
 * @returns {Object} Structured analysis
 */
function parseAnalysisResponse(response) {
    try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        // Fallback: return raw response as summary
        return {
            summary: response,
            symptoms: [],
            hypotheses: [],
            recommendations: []
        };
    } catch (error) {
        console.error('Parse response error:', error);
        return {
            summary: response,
            symptoms: [],
            hypotheses: [],
            recommendations: []
        };
    }
}

/**
 * Transcribe audio to text using local Whisper model
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(audioPath) {
    try {
        const path = require('path');
        const { spawn } = require('child_process');
        const fs = require('fs');

        // Get absolute path to audio file
        const absoluteAudioPath = path.isAbsolute(audioPath)
            ? audioPath
            : path.join(__dirname, '../../uploads', audioPath);

        console.log('Transcribing audio file (Local Whisper):', absoluteAudioPath);

        // Check if file exists
        if (!fs.existsSync(absoluteAudioPath)) {
            console.error('Audio file not found:', absoluteAudioPath);
            return null;
        }

        // Path to python script
        const scriptPath = path.join(__dirname, '../../whisper_transcribe.py');

        return new Promise((resolve, reject) => {
            console.log('Spawning Whisper process...');
            const pythonProcess = spawn('python', [scriptPath, absoluteAudioPath, 'small']);

            let outputData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
                // Optional: Stream stderr to console for debugging
                // process.stdout.write(data); 
            });

            pythonProcess.on('close', (code) => {
                console.log(`Whisper process exited with code ${code}`);

                if (code === 0 && outputData.trim()) {
                    const text = outputData.trim();
                    console.log('Transcription SUCCESS:', text.substring(0, 100) + '...');
                    resolve(text);
                } else {
                    console.error('Transcription failed:', errorData);
                    // If output is empty but code is 0, return empty string (silence)
                    if (code === 0) resolve('');
                    else resolve(null);
                }
            });

            pythonProcess.on('error', (err) => {
                console.error('Failed to start Whisper process:', err);
                resolve(null);
            });
        });
    } catch (error) {
        console.error('Transcription error:', error.message);
        return null;
    }
}

module.exports = {
    analyzeCase,
    transcribeAudio
};
