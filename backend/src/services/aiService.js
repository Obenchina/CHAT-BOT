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
async function analyzeCase(caseData, aiConfig = null) {
    try {
        // Determine config
        const cfg = aiConfig || { provider: 'gemini', apiKey: config.ai.apiKey, model: config.ai.model };

        if (!cfg.apiKey) {
            console.warn('AI API key not configured');
            return {
                summary: 'AI analysis not available - API key not configured',
                symptoms: [],
                hypotheses: [],
                recommendations: []
            };
        }

        // Process documents (images and PDFs)
        const docResult = await processCaseDocuments(caseData);

        // Build base text prompt
        let baseTextPrompt = buildAnalysisPrompt(caseData);

        if (cfg.provider === 'openai') {
            // OpenAI multimodal path (Text extraction for PDFs)
            let openaiTextPrompt = baseTextPrompt;
            if (docResult.extractedText) {
                openaiTextPrompt += `\n\n═══════════════════════════════\nمحتويات مستخرجة من المستندات المرفقة (PDF):\n═══════════════════════════════\n${docResult.extractedText}`;
            }

            const userContent = [
                { type: 'text', text: openaiTextPrompt },
                ...docResult.openaiImages
            ];
            const response = await callOpenAIAPI(userContent, cfg);
            return parseAnalysisResponse(response);
        }

        // Gemini multimodal path (Raw PDFs)
        const promptParts = [
            { text: baseTextPrompt },
            ...docResult.geminiImages
        ];

        const response = await callGeminiAPI(promptParts, cfg);
        return parseAnalysisResponse(response);
    } catch (error) {
        console.error('AI analysis error:', error.message);

        // Propagate structural AI errors (keys/quota) up so they can be handled explicitly
        if (error.code === 'QUOTA_EXCEEDED' || error.code === 'API_ERROR' || error.code === 'MISSING_API_KEY') {
            throw error;
        }

        return {
            summary: "L'analyse IA a échoué (Erreur inattendue).",
            symptoms: [],
            hypotheses: [],
            recommendations: [],
            error: error.message
        };
    }
}

/**
 * Process case documents (images to base64, PDFs to text)
 * @param {Object} caseData - Case data
 * @returns {Promise<Object>} Formatted image parts and extracted text
 */
async function processCaseDocuments(caseData) {
    const fs = require('fs').promises;
    const path = require('path');

    let PDFParser = null;
    try {
        PDFParser = require('pdf2json');
    } catch (e) {
        console.warn('pdf2json not installed, PDF text extraction will be disabled.');
    }

    const result = {
        extractedText: '',
        geminiImages: [],
        openaiImages: []
    };

    console.log(`[processCaseDocuments] Total documents received: ${caseData.documents ? caseData.documents.length : 0}`);

    if (caseData.documents && caseData.documents.length > 0) {
        for (const doc of caseData.documents) {
            const fileName = doc.file_name || doc.fileName;
            const filePath = doc.file_path || doc.filePath;
            let docType = doc.document_type || doc.type || doc.documentType;

            console.log(`Processing document for AI: ID=${doc.id}, fileName=${fileName}, type=${docType}, path=${filePath}`);

            if (!fileName || !filePath) continue;

            const isImage = fileName.match(/\.(jpg|jpeg|png|webp)$/i) || (docType && docType.startsWith('image/'));
            const isPdf = fileName.match(/\.(pdf)$/i) || docType === 'application/pdf' || docType === 'general';

            if (isImage || isPdf) {
                try {
                    const absolutePath = path.isAbsolute(filePath)
                        ? filePath
                        : path.join(__dirname, '../../uploads', filePath);

                    const fileBuffer = await fs.readFile(absolutePath);

                    if (isPdf && fileName.toLowerCase().endsWith('.pdf')) {
                        // 1. Add raw PDF to Gemini directly (Gemini supports application/pdf)
                        result.geminiImages.push({
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: fileBuffer.toString('base64')
                            }
                        });
                        console.log(`Added raw PDF to Gemini payload: ${fileName}`);

                        // 2. Extract text for OpenAI fallback (and general text parsing)
                        if (PDFParser) {
                            try {
                                const pdfData = await new Promise((resolve, reject) => {
                                    const pdfParser = new PDFParser(this, 1);
                                    pdfParser.on('pdfParser_dataError', errData => reject(new Error(errData.parserError)));
                                    pdfParser.on('pdfParser_dataReady', () => {
                                        resolve(pdfParser.getRawTextContent());
                                    });
                                    pdfParser.parseBuffer(fileBuffer);
                                });
                                result.extractedText += `\n--- محتويات مستند PDF: ${fileName} ---\n${pdfData}\n`;
                                console.log(`Extracted text from PDF for OpenAI: ${fileName}`);
                            } catch (pdfErr) {
                                console.error(`Failed to parse PDF ${fileName}:`, pdfErr.message);
                            }
                        }
                    } else if (isImage && !fileName.toLowerCase().endsWith('.pdf')) {
                        const base64Data = fileBuffer.toString('base64');
                        const ext = path.extname(fileName).toLowerCase().replace('.', '');
                        const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;

                        // Gemini format
                        result.geminiImages.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        });

                        // OpenAI format
                        result.openaiImages.push({
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Data}`
                            }
                        });

                        console.log(`Added image to analysis payload: ${fileName} as ${mimeType}`);
                    }
                } catch (error) {
                    console.error(`Failed to process document ${fileName}:`, error.message);
                }
            }
        }
    }

    return result;
}

/**
 * Build analysis prompt from case data (Arabic)
 * @param {Object} caseData - Case data
 * @returns {string} Formatted prompt
 */
function buildAnalysisPrompt(caseData) {
    const { patient, answers, documents } = caseData;
    const hasDocs = documents && documents.length > 0;

    // Use computed age from backend (TIMESTAMPDIFF), fallback to manual calculation from date_of_birth
    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
        const dob = new Date(patient.date_of_birth);
        const now = new Date();
        patientAge = Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    let prompt = `أنت "طبيب استشاري ذكي" (Senior Medical AI Specialist).
مهمتك ليست مجرد التلخيص، بل تقديم تحليل سريري احترافي عالي الدقة.

ملاحظة مهنية هامة: المريض جزائري ويتحدث بـ "الدارجة الجزائرية" (بما فيها من مصطلحات فرنسية وعامية). يجب أن تفهم شكواه بدقة (مثلاً: "عندي السطر" تعني ألم، "التخمام" قد تعني دوار أو قلق، إلخ).

مطلوباتك الصارمة: 1. التلخيص السريري: لخص الحالة في 4 أسطر كحد أقصى بصرامة (لا تتجاوز 4 أسطر أبداً). لا تذكر اسم أو لقب المريض أبداً. ${hasDocs ? 'يوجد مستندات مرفقة، اذكر أهم التفاصيل التقنية باختصار.' : 'اذكر في نهاية الملخص: (لا توجد مستندات).'}
2. التشخيص التفريقي: قدم التشخيصات الأكثر احتمالية مع نسبة مئوية.
3. ملاحظات مهمة:
   - في حالات "الطوارئ الجراحية" أو الحالات الخطيرة (مثل التواء الخصية Torsion، أو اشتباه احتشاء عضلة القلب، إلخ)، يجب أن يبدأ ردك في قسم الملاحظات بعبارة: [!!! URGENCE CHIRURGICALE / MÉDICALE !!!] مع توجيه الطبيب للإجراء الفوري.

═══════════════════════════════
معلومات المريض (بدون اسم لأسباب الخصوصية):
═══════════════════════════════
- الجنس: ${patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : 'غير محدد'}
- العمر: ${patientAge || 'غير محدد'} سنة

═══════════════════════════════
إجابات الاستبيان الطبي:
═══════════════════════════════`;

    // Add questionnaire answers
    answers.forEach((answer, index) => {
        const answerText = answer.text_answer || answer.textAnswer || answer.transcribed_text || 'لم يتم تقديم إجابة';
        prompt += `\n\n${index + 1}. السؤال: ${answer.question_text}`;
        prompt += `\n   الإجابة: ${answerText}`;
    });

    prompt += `

═══════════════════════════════
المطلوب (Format JSON):
═══════════════════════════════

قدم تحليلك بصيغة JSON التالية (بالعربية):
{
  "summary": "ملخص سريري احترافي في 4 أسطر كحد أقصى يتضمن التاريخ المرضي والأعراض الحالية وتفاصيل الملفات المرفقة إن وجدت.",
  "diagnoses": [
    {
      "name": "الاسم العلمي بالفرنسية + العربي (مثال: Appendicite - التهاب الزائدة 80%)",
      "reasoning": "التبرير السريري بناءً على الأعراض والفحص."
    }
  ],
  "additionalNotes": "ضع هنا أي تنبيهات طوارئ أو نصائح طبية تخصصية للطبيب."
}`;

    return prompt;
}

/**
 * Call Gemini API
 * @param {Array} promptParts - Analysis prompt content parts
 * @returns {Promise<string>} API response
 */
async function callGeminiAPI(promptParts, cfg = null) {
    const apiKey = cfg ? cfg.apiKey : config.ai.apiKey;
    const model = cfg ? cfg.model : config.ai.model;
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
                        maxOutputTokens: 8192
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

            // Handle 429 Too Many Requests OR 503 Service Unavailable
            if (response.status === 429 || response.status === 503) {
                const errorType = response.status === 429 ? 'Rate Limit (429)' : 'Service Unavailable (503)';
                console.warn(`Gemini API ${errorType} hit.`);

                // Calculate delay: Use Retry-After header if available, else exponential backoff
                let delay = 5000 * Math.pow(2, retryCount); // Default: 5s, 10s, 20s

                const retryAfterHeader = response.headers.get('Retry-After');
                if (retryAfterHeader) {
                    delay = parseInt(retryAfterHeader, 10) * 1000; // Convert seconds to ms
                    console.log(`Retry-After header found: waiting ${delay}ms`);
                } else {
                    console.log(`Using exponential backoff: ${delay}ms`);
                }

                if (retryCount === MAX_RETRIES) {
                    throw new Error(`Gemini API ${errorType} - failed after ${MAX_RETRIES} retries.`);
                }

                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue; // Retry loop
            }

            // Other errors (400, 401, etc.) — don't retry
            const errorText = await response.text();

            let errorMessage = "Erreur de l'API Gemini.";
            let errorCode = 'API_ERROR';

            try {
                const parsed = JSON.parse(errorText);
                if (parsed.error && parsed.error.message) {
                    const rawMessage = parsed.error.message;
                    if (parsed.error.code === 403 || parsed.error.status === 'PERMISSION_DENIED' || rawMessage.toLowerCase().includes('quota') || rawMessage.toLowerCase().includes('billing') || rawMessage.toLowerCase().includes('credit')) {
                        errorCode = 'QUOTA_EXCEEDED';
                        errorMessage = "Problème d'abonnement ou quota Gemini épuisé. Veuillez vérifier votre compte ou facturation Google.";
                    } else if (parsed.error.code === 400 && (rawMessage.toLowerCase().includes('api_key') || rawMessage.toLowerCase().includes('key invalid')) || response.status === 400 || response.status === 401) {
                        errorCode = 'API_ERROR';
                        errorMessage = "Clé API Gemini invalide.";
                    } else {
                        errorMessage = `Erreur Gemini: ${rawMessage}`;
                    }
                }
            } catch (e) {
                if (response.status === 403 || errorText.toLowerCase().includes('quota')) {
                    errorCode = 'QUOTA_EXCEEDED';
                    errorMessage = "Quota Gemini épuisé. Veuillez vérifier l'abonnement.";
                } else if (response.status === 400 || response.status === 401) {
                    errorMessage = "Erreur de requête Gemini (souvent clé API invalide).";
                }
            }

            const customError = new Error(errorMessage);
            customError.code = errorCode;
            throw customError;

        } catch (error) {
            // If max retries reached, throw
            if (retryCount >= MAX_RETRIES) {
                throw error;
            }
            // Retry on network/transient errors
            console.error(`Error during API call (attempt ${retryCount + 1}): ${error.message}`);
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
        // Remove markdown code block wrappers if present (```json ... ```)
        let cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

        // Try to extract JSON from response
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate that we got at least a summary
            if (parsed.summary || parsed.diagnoses || parsed.medications) {
                return parsed;
            }
        }

        // Fallback: return raw response as summary
        return {
            summary: response,
            diagnoses: [],
            medications: [],
            additionalNotes: ''
        };
    } catch (error) {
        console.error('Parse response error:', error.message);
        console.error('Raw response (first 200 chars):', response.substring(0, 200));

        // Try to salvage partial JSON by extracting summary at minimum
        try {
            const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/);
            if (summaryMatch) {
                return {
                    summary: summaryMatch[1],
                    diagnoses: [],
                    medications: [],
                    additionalNotes: 'Analyse partielle — le résultat AI a été tronqué.'
                };
            }
        } catch (e) { /* ignore */ }

        return {
            summary: 'Échec de l\'analyse IA. Veuillez réessayer.',
            diagnoses: [],
            medications: [],
            additionalNotes: ''
        };
    }
}

/**
 * Call OpenAI API (ChatGPT)
 * @param {Array|string} userContent - Text or array of multimodal components
 * @param {Object} cfg - { apiKey, model }
 * @returns {Promise<string>} API response text
 */
async function callOpenAIAPI(userContent, cfg) {
    const apiKey = cfg.apiKey;
    const model = cfg.model || 'gpt-4o-mini';
    const url = 'https://api.openai.com/v1/chat/completions';

    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
        try {
            console.log(`Calling OpenAI API (Model: ${model}, Attempt: ${retryCount + 1})...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: 'أنت طبيب مساعد ذكي (AI Medical Assistant). مهمتك تحليل البيانات الطبية المدخلة واستخراج ملخص تشخيصي دقيق للطبيب. ملاحظة ثقافية هامة: المريض جزائري ويتحدث بالدارجة الجزائرية (Algerian Darja) والتي قد تتضمن مزيجاً من العربية والفرنسية ومصطلحات محلية. يجب عليك فهم هذه المصطلحات بدقة عند تحليل الأعراض. قدم إجابتك دائماً بصيغة JSON منسقة بالعربية. قسم الأدوية يجب أن يكون بالفرنسية العلمية. المريض موجود بالفعل عند الطبيب ويتم فحصه، لا تقترح زيارة طبيب إلا في حالات الطوارئ الشديدة.' },
                        { role: 'user', content: userContent }
                    ],
                    temperature: 0.3,
                    max_tokens: 4096
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0]?.message?.content) {
                    return data.choices[0].message.content;
                }
                throw new Error('Invalid OpenAI API response format');
            }

            if (response.status === 429 || response.status === 503) {
                let delay = 5000 * Math.pow(2, retryCount);
                if (retryCount === MAX_RETRIES) {
                    throw new Error(`OpenAI API error ${response.status} - failed after ${MAX_RETRIES} retries.`);
                }
                console.log(`OpenAI rate limited, waiting ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
            }

            const errorText = await response.text();

            let errorMessage = "Erreur de l'API OpenAI.";
            let errorCode = 'API_ERROR';

            try {
                const parsed = JSON.parse(errorText);
                if (parsed.error && parsed.error.message) {
                    const rawMessage = parsed.error.message;
                    if (parsed.error.type === 'insufficient_quota' || parsed.error.code === 'insufficient_quota' || rawMessage.toLowerCase().includes('quota') || rawMessage.toLowerCase().includes('billing') || rawMessage.toLowerCase().includes('credit')) {
                        errorCode = 'QUOTA_EXCEEDED';
                        errorMessage = "Crédit OpenAI épuisé ou limite de facturation atteinte. Veuillez vérifier les paramètres sur OpenAI.";
                    } else if (parsed.error.code === 'invalid_api_key' || response.status === 401) {
                        errorCode = 'API_ERROR';
                        errorMessage = "Clé API OpenAI invalide.";
                    } else {
                        errorMessage = `Erreur OpenAI: ${rawMessage}`;
                    }
                }
            } catch (e) {
                if (response.status === 401) {
                    errorMessage = "Clé API OpenAI non autorisée ou invalide.";
                } else if (response.status === 429) {
                    errorCode = 'QUOTA_EXCEEDED';
                    errorMessage = "Quota OpenAI dépassé ou limite de taux atteinte.";
                }
            }

            const customError = new Error(errorMessage);
            customError.code = errorCode;
            throw customError;
        } catch (error) {
            if (retryCount >= MAX_RETRIES) throw error;
            let delay = 5000 * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
        }
    }
}

/**
 * Transcribe audio to text using AI
 * Sends audio as base64 inline data
 * @param {string} audioPath - Path to audio file
 * @param {Object} aiConfig - Optional AI config { provider, apiKey, model }
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(audioPath, aiConfig = null) {
    const cfg = aiConfig || { provider: 'gemini', apiKey: config.ai.apiKey, model: config.ai.model };

    if (cfg.provider === 'openai') {
        return _transcribeAudioWhisper(audioPath, cfg);
    }

    return _transcribeAudioGemini(audioPath, cfg);
}

/**
 * Internal: Transcribe audio using Gemini
 */
async function _transcribeAudioGemini(audioPath, cfg) {
    try {
        const path = require('path');
        const fs = require('fs').promises;

        // Get absolute path to audio file
        const absoluteAudioPath = path.isAbsolute(audioPath)
            ? audioPath
            : path.join(__dirname, '../../uploads', audioPath);

        console.log('Transcribing audio file (Gemini API):', absoluteAudioPath);

        // Check if file exists
        const fsSync = require('fs');
        if (!fsSync.existsSync(absoluteAudioPath)) {
            console.error('Audio file not found:', absoluteAudioPath);
            return null;
        }

        // Read audio file and convert to base64
        const audioBuffer = await fs.readFile(absoluteAudioPath);
        const base64Audio = audioBuffer.toString('base64');

        // Detect MIME type from file extension
        const ext = path.extname(absoluteAudioPath).toLowerCase();
        const mimeMap = {
            '.webm': 'audio/webm',
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac'
        };
        const mimeType = mimeMap[ext] || 'audio/webm';

        console.log(`Audio: ${path.basename(absoluteAudioPath)}, MIME: ${mimeType}, Size: ${(audioBuffer.length / 1024).toFixed(1)}KB`);

        // Build prompt parts: transcription instruction + audio data
        const promptParts = [
            {
                text: `أنت متخصص في تحويل الكلام إلى نص في سياق طبي. استمع للتسجيل الصوتي التالي وقم بنسخه حرفياً إلى نص عربي.

ملاحظة مهمة: المتحدث جزائري، وقد يتكلم بالدارجة الجزائرية أو بمزيج من الدارجة الجزائرية والعربية الفصحى أو بالفصحى فقط. اكتب ما تسمعه بالضبط كما نطقه المتحدث.

قواعد صارمة:
- اكتب النص فقط بدون أي مقدمة أو شرح أو تعليق
- اكتب ما تسمعه حرفياً كما نُطق
- إذا كان الصوت صامتاً أو غير واضح أو لا يحتوي على كلام مفهوم، اكتب بالضبط: [صوت غير واضح]
- لا تختلق أو تتخيل كلاماً غير موجود في التسجيل
- لا تكتب أي محتوى من خيالك أو من الإنترنت

انسخ الصوت:`
            },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            }
        ];

        // Call Gemini API (reuse existing function with retry logic)
        const response = await callGeminiAPI(promptParts, cfg);

        if (response) {
            // Clean up the response — remove any markdown or extra formatting
            let text = response.trim();
            // Remove potential markdown code blocks
            text = text.replace(/```[\s\S]*?```/g, '').trim();
            // Remove leading/trailing quotes
            text = text.replace(/^["']|["']$/g, '').trim();

            // Anti-hallucination filter: detect nonsensical/random text
            if (isHallucinatedTranscription(text)) {
                console.warn('Gemini transcription detected as hallucinated, rejecting:', text.substring(0, 80));
                return '[فشل تحويل الصوت إلى نص — يرجى إعادة التسجيل]';
            }

            console.log('Gemini Transcription SUCCESS:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            return text;
        }

        console.error('Gemini returned empty response for transcription');
        return null;

    } catch (error) {
        console.error('Gemini transcription error:', error.message);

        // Re-throw known API errors so the frontend UI can alert the user
        if (error.code === 'QUOTA_EXCEEDED' || error.code === 'API_ERROR' || error.code === 'MISSING_API_KEY') {
            throw error;
        }

        // Check for specific Gemini API Rate Limit signatures
        if (error.message && (error.message.includes('Rate Limit') || error.message.includes('429'))) {
            const apiError = new Error("Crédit API épuisé ou limite atteinte (Rate Limit). Veuillez vérifier votre abonnement OpenAI/Gemini.");
            apiError.code = 'QUOTA_EXCEEDED';
            throw apiError;
        }

        return null; // Return null for non-API-breaking generic errors to allow flow continuation
    }
}

/**
 * Internal: Transcribe audio using OpenAI Whisper
 */
async function _transcribeAudioWhisper(audioPath, cfg) {
    try {
        const path = require('path');
        const fs = require('fs').promises;

        const absoluteAudioPath = path.isAbsolute(audioPath)
            ? audioPath
            : path.join(__dirname, '../../uploads', audioPath);

        console.log('Transcribing audio file (OpenAI Whisper Whisper-1 API):', absoluteAudioPath);

        const fsSync = require('fs');
        if (!fsSync.existsSync(absoluteAudioPath)) {
            console.error('Audio file not found:', absoluteAudioPath);
            return null;
        }

        const audioBuffer = await fs.readFile(absoluteAudioPath);

        // Native FormData in Node 18+
        const formData = new FormData();
        const blob = new Blob([audioBuffer]);
        formData.append('file', blob, path.basename(absoluteAudioPath));
        formData.append('model', 'gpt-4o-mini-transcribe');
        formData.append('prompt', 'المتحدث يتحدث بالدارجة الجزائرية وقد يستخدم كلمات فرنسية أو مصطلحات طبية. يرجى كتابة النص بدقة كما نُطق.');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfg.apiKey}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            if (data.text) {
                let text = data.text.trim();

                // Anti-hallucination filter
                if (isHallucinatedTranscription(text)) {
                    console.warn('Whisper transcription detected as hallucinated, rejecting:', text.substring(0, 80));
                    return '[فشل تحويل الصوت إلى نص — يرجى إعادة التسجيل]';
                }

                console.log('Whisper Transcription SUCCESS:', text.substring(0, 100) + '...');
                return text;
            }
        }

        // Handle explicit errors
        const errorText = await response.text();
        let errorMessage = "Erreur de l'API OpenAI Whisper.";
        let errorCode = 'API_ERROR';

        try {
            const parsed = JSON.parse(errorText);
            if (parsed.error && parsed.error.message) {
                const rawMessage = parsed.error.message;
                if (parsed.error.code === 'insufficient_quota' || rawMessage.toLowerCase().includes('quota')) {
                    errorCode = 'QUOTA_EXCEEDED';
                    errorMessage = "Crédit OpenAI épuisé ou limite atteinte.";
                } else if (parsed.error.code === 'invalid_api_key' || response.status === 401) {
                    errorCode = 'API_ERROR';
                    errorMessage = "Clé API OpenAI invalide.";
                } else {
                    errorMessage = `Erreur Whisper: ${rawMessage}`;
                }
            }
        } catch (e) {
            if (response.status === 401) errorMessage = "Clé API OpenAI invalide.";
            if (response.status === 429) {
                errorCode = 'QUOTA_EXCEEDED';
                errorMessage = "Quota OpenAI dépassé.";
            }
        }

        const customError = new Error(errorMessage);
        customError.code = errorCode;
        throw customError;

    } catch (error) {
        console.error('Whisper transcription error:', error.message);
        if (error.code === 'QUOTA_EXCEEDED' || error.code === 'API_ERROR' || error.code === 'MISSING_API_KEY') {
            throw error;
        }
        return null; // Return null so pipeline can continue without blocking entire request flow on STT failure
    }
}

/**
 * Anti-hallucination filter for transcription results.
 * Detects when the AI model generates nonsensical or fabricated text
 * instead of actual speech transcription (e.g. "اشتركو في القناة").
 * @param {string} text - Transcribed text to validate
 * @returns {boolean} true if the text appears hallucinated
 */
function isHallucinatedTranscription(text) {
    if (!text || text.length === 0) return true;

    // Known hallucination patterns (common AI artifacts when audio is empty/unclear)
    const hallucinationPatterns = [
        /اشتركو/i,
        /اشترك/i,
        /القناة/i,
        /subscribe/i,
        /like.*comment/i,
        /بسم الله الرحمن الرحيم$/,  // Only this phrase and nothing else
        /thank you for watching/i,
        /شكرا للمشاهدة/i,
        /مرحبا بكم/i,
        /السلام عليكم ورحمة الله وبركاته$/  // Only greeting and nothing else
    ];

    for (const pattern of hallucinationPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }

    // If transcription is extremely short (1-2 chars) and not a valid yes/no answer
    if (text.length <= 2 && !['لا', 'نعم', 'لا', 'اه'].includes(text)) {
        return true;
    }

    return false;
}

/**
 * Build system prompt for doctor-AI chat with patient context
 */
function buildChatSystemPrompt(caseData) {
    const { patient, answers, documents } = caseData;
    
    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
        const dob = new Date(patient.date_of_birth);
        const now = new Date();
        patientAge = Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    let context = `أنت مساعد طبي ذكي (Senior Medical AI Consultant).
أنت في محادثة مع الطبيب المعالج حول حالة مريض.
يجب أن تكون إجاباتك دقيقة، علمية، ومفيدة سريرياً.
أجب بالعربية مع المصطلحات الطبية بالفرنسية/الإنجليزية عند الحاجة.

═══════════════════════════════
سياق المريض:
═══════════════════════════════
- الجنس: ${patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : 'غير محدد'}
- العمر: ${patientAge || 'غير محدد'} سنة

═══════════════════════════════
إجابات الاستبيان الطبي:
═══════════════════════════════`;

    if (answers && answers.length > 0) {
        answers.forEach((answer, index) => {
            const answerText = answer.text_answer || answer.textAnswer || answer.transcribed_text || 'لم يتم تقديم إجابة';
            context += `\n${index + 1}. ${answer.question_text}: ${answerText}`;
        });
    }

    const aiAnalysis = caseData.ai_analysis || caseData.aiAnalysis;
    if (aiAnalysis) {
        context += `\n\n═══════════════════════════════\nالتحليل السابق للذكاء الاصطناعي:\n═══════════════════════════════`;
        if (aiAnalysis.summary) context += `\nالملخص: ${aiAnalysis.summary}`;
        if (aiAnalysis.diagnoses) {
            context += `\nالتشخيصات المقترحة:`;
            aiAnalysis.diagnoses.forEach(d => {
                context += `\n- ${d.name}: ${d.reasoning || ''}`;
            });
        }
    }

    return context;
}

/**
 * Chat with AI about a patient case
 * @param {string} systemContext - System prompt with patient context
 * @param {Array} chatHistory - Previous messages [{role, content}]
 * @param {string} newMessage - Doctor's new message
 * @param {Object} aiConfig - AI configuration
 * @returns {Promise<string>} AI response text
 */
async function chatWithAI(systemContext, chatHistory, newMessage, aiConfig = null) {
    const cfg = aiConfig || { provider: 'gemini', apiKey: config.ai.apiKey, model: config.ai.model };

    if (!cfg.apiKey) {
        throw Object.assign(new Error('مفتاح API غير مُعَدّ'), { code: 'MISSING_API_KEY' });
    }

    if (cfg.provider === 'openai') {
        // OpenAI Chat Completions format
        const messages = [
            { role: 'system', content: systemContext },
            ...chatHistory.map(m => ({
                role: m.role === 'doctor' ? 'user' : 'assistant',
                content: m.content
            })),
            { role: 'user', content: newMessage }
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfg.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: cfg.model || 'gpt-4o-mini',
                messages,
                temperature: 0.4,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) throw Object.assign(new Error('Quota dépassé'), { code: 'QUOTA_EXCEEDED' });
            throw Object.assign(new Error(`Erreur OpenAI: ${errText}`), { code: 'API_ERROR' });
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'لم يتمكن الذكاء الاصطناعي من الرد.';
    }

    // Gemini format — use multi-turn conversation
    const apiKey = cfg.apiKey;
    const model = cfg.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = [];
    
    // Add system context as first user message
    contents.push({ role: 'user', parts: [{ text: systemContext + '\n\nابدأ المحادثة. أنا الطبيب المعالج.' }] });
    contents.push({ role: 'model', parts: [{ text: 'مرحباً دكتور. أنا مستعد لمناقشة هذه الحالة معك. كيف يمكنني مساعدتك؟' }] });
    
    // Add chat history
    chatHistory.forEach(m => {
        contents.push({
            role: m.role === 'doctor' ? 'user' : 'model',
            parts: [{ text: m.content }]
        });
    });
    
    // Add new message
    contents.push({ role: 'user', parts: [{ text: newMessage }] });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
        })
    });

    if (!response.ok) {
        if (response.status === 429) throw Object.assign(new Error('Quota dépassé'), { code: 'QUOTA_EXCEEDED' });
        const errText = await response.text();
        throw Object.assign(new Error(`Erreur Gemini: ${errText}`), { code: 'API_ERROR' });
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتمكن الذكاء الاصطناعي من الرد.';
}

/**
 * Suggest medications for a case (called on-demand by doctor)
 * @param {Object} caseData - Full case data
 * @param {Object} aiConfig - AI configuration
 * @returns {Promise<Array>} Suggested medications
 */
async function suggestMedications(caseData, aiConfig = null) {
    const cfg = aiConfig || { provider: 'gemini', apiKey: config.ai.apiKey, model: config.ai.model };

    if (!cfg.apiKey) {
        throw Object.assign(new Error('مفتاح API غير مُعَدّ'), { code: 'MISSING_API_KEY' });
    }

    const { patient, answers } = caseData;
    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
        const dob = new Date(patient.date_of_birth);
        patientAge = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const aiAnalysis = caseData.ai_analysis || caseData.aiAnalysis;
    
    const prompt = `أنت صيدلي سريري خبير (Expert Clinical Pharmacist).
بناءً على المعلومات التالية، اقترح الأدوية المناسبة.

المريض:
- الجنس: ${patient.gender === 'male' ? 'ذكر' : 'أنثى'}
- العمر: ${patientAge || 'غير محدد'} سنة

${aiAnalysis?.summary ? `ملخص الحالة: ${aiAnalysis.summary}` : ''}
${aiAnalysis?.diagnoses ? `التشخيصات: ${aiAnalysis.diagnoses.map(d => d.name).join(', ')}` : ''}

أجب بصيغة JSON فقط:
[
  {
    "name": "اسم الدواء (DCI بالفرنسية)",
    "dosage": "الجرعة",
    "frequency": "عدد المرات يومياً",
    "duration": "المدة"
  }
]

ملاحظة: هذا اقتراح فقط. الطبيب هو من يقرر الوصفة النهائية.`;

    let responseText;
    if (cfg.provider === 'openai') {
        responseText = await callOpenAIAPI([{ type: 'text', text: prompt }], cfg);
    } else {
        responseText = await callGeminiAPI([{ text: prompt }], cfg);
    }

    // Parse JSON from response
    try {
        const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error('Failed to parse medication suggestion:', e.message);
    }

    return [];
}

module.exports = {
    analyzeCase,
    transcribeAudio,
    chatWithAI,
    buildChatSystemPrompt,
    suggestMedications
};
