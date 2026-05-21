/**
 * AI Service
 * Gemini API integration for medical case analysis
 */

const config = require('../config/config');

function clampSummaryToMaxLines(summary, maxLines = 4) {
    if (!summary || typeof summary !== 'string') return summary;
    const normalized = summary.replace(/\r\n/g, '\n').trim();
    if (!normalized) return normalized;
    const lines = normalized.split('\n');
    if (lines.length <= maxLines) return normalized;
    return lines.slice(0, maxLines).join('\n').trim();
}

function safeJsonParse(value, fallback = null) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function calculateAgeDisplay(patient = {}) {
    const rawDate = patient.date_of_birth || patient.dateOfBirth || patient.birth_date || patient.birthDate;
    if (!rawDate) return patient.age || 'unknown';
    const dob = new Date(rawDate);
    if (Number.isNaN(dob.getTime())) return patient.age || 'unknown';

    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (months < 0 || (months === 0 && now.getDate() < dob.getDate())) {
        years -= 1;
        months += 12;
    }
    return years > 0 ? `${years} years` : `${Math.max(0, months)} months`;
}

function formatDateForPrompt(value) {
    if (!value) return 'unknown';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

function formatMedicationList(rawPrescription) {
    const list = safeJsonParse(rawPrescription, Array.isArray(rawPrescription) ? rawPrescription : []);
    if (!Array.isArray(list) || list.length === 0) return 'none recorded';
    return list.map((m, index) => {
        const parts = [m.name, m.dosage, m.frequency, m.duration].filter(Boolean);
        return `${index + 1}. ${parts.join(' | ') || 'Unnamed medication'}`;
    }).join('\n');
}

function buildComprehensiveCaseContext(caseData = {}, responseLanguage = 'fr') {
    const patient = caseData.patient || {};
    const answers = Array.isArray(caseData.answers) ? caseData.answers : [];
    const documents = Array.isArray(caseData.documents) ? caseData.documents : [];
    const aiAnalysis = safeJsonParse(caseData.ai_analysis || caseData.aiAnalysis, caseData.aiAnalysis || null);

    const lines = [
        'COMPREHENSIVE ANONYMIZED CASE DATA',
        'Never mention patient first name or last name. These fields are intentionally excluded.',
        'Expected response language: French.',
        '',
        'Patient facts:',
        `- Gender: ${patient.gender || 'unknown'}`,
        `- Date of birth: ${formatDateForPrompt(patient.date_of_birth || patient.dateOfBirth)}`,
        `- Age: ${calculateAgeDisplay(patient)}`,
        `- Phone: ${patient.phone || 'not provided'}`,
        `- Address: ${patient.address || 'not provided'}`,
        `- Siblings alive: ${patient.siblings_alive ?? patient.siblingsAlive ?? 'unknown'}`,
        `- Siblings deceased: ${patient.siblings_deceased ?? patient.siblingsDeceased ?? 'unknown'}`,
        '',
        `Case metadata: status=${caseData.status || 'unknown'}, created=${formatDateForPrompt(caseData.created_at || caseData.createdAt)}, submitted=${formatDateForPrompt(caseData.submitted_at || caseData.submittedAt)}, reviewed=${formatDateForPrompt(caseData.reviewed_at || caseData.reviewedAt)}.`,
        `Catalogue: ${caseData.catalogue?.name || caseData.catalogueName || 'unknown'}`,
        '',
        'Questionnaire answers and clinical measures:'
    ];

    if (answers.length === 0) {
        lines.push('- No answers recorded.');
    } else {
        answers.forEach((answer, index) => {
            const question = answer.question_text || answer.questionText || answer.question_text_snapshot || `Question ${index + 1}`;
            const answerText = answer.text_answer || answer.textAnswer || answer.transcribed_text || 'No answer recorded';
            const measure = answer.clinical_measure || answer.clinicalMeasure || 'none';
            const type = answer.answer_type || answer.answerType || answer.answer_type_snapshot || 'unknown';
            const section = answer.section_name || answer.sectionName || 'Unsectioned';
            lines.push(`${index + 1}. [${section}] ${question}`);
            lines.push(`   Answer: ${answerText}`);
            lines.push(`   Type: ${type}; clinical_measure: ${measure}; date: ${formatDateForPrompt(answer.created_at || answer.createdAt)}`);
        });
    }

    lines.push('', 'Attached documents:');
    if (documents.length === 0) {
        lines.push('- No documents attached.');
    } else {
        documents.forEach((doc, index) => {
            lines.push(`${index + 1}. ${doc.file_name || doc.fileName || 'Document'} uploaded ${formatDateForPrompt(doc.uploaded_at || doc.uploadedAt)}.`);
        });
    }

    lines.push('', 'Doctor review data:');
    lines.push(`- Doctor diagnosis: ${caseData.doctor_diagnosis || caseData.doctorDiagnosis || 'none recorded'}`);
    lines.push(`- Doctor prescription:\n${formatMedicationList(caseData.doctor_prescription || caseData.doctorPrescription)}`);

    if (aiAnalysis) {
        lines.push('', 'Previous AI analysis:');
        if (aiAnalysis.summary) lines.push(`- Summary: ${aiAnalysis.summary}`);
        const diagnoses = aiAnalysis.diagnoses || aiAnalysis.diagnostics || [];
        if (Array.isArray(diagnoses) && diagnoses.length > 0) {
            diagnoses.forEach((d, index) => {
                lines.push(`- Diagnosis ${index + 1}: ${d.name || d.diagnosis || d.label || 'unknown'} (${d.probability || d.percentage || '?'}%) ${d.reasoning || ''}`);
            });
        }
        if (aiAnalysis.additionalNotes) lines.push(`- Additional notes: ${aiAnalysis.additionalNotes}`);
    }

    lines.push(
        '',
        'Summary requirement:',
        '- Produce a clinically useful synthesis that covers all relevant patient facts, answers, measures, documents, previous AI analysis, doctor diagnosis, and prescription.',
        '- Keep it concise but complete; do not omit major changes or recorded values.',
        '- Do not include patient first name or last name.'
    );

    return lines.join('\n');
}

function buildImageAttachmentParts(attachments = [], provider = 'gemini') {
    if (!Array.isArray(attachments) || attachments.length === 0) return [];
    const fs = require('fs');
    const path = require('path');

    return attachments.flatMap((attachment) => {
        try {
            if (!attachment?.path) return [];
            const abs = path.isAbsolute(attachment.path)
                ? attachment.path
                : path.join(__dirname, '../../uploads', attachment.path);
            const buffer = fs.readFileSync(abs);
            const mimeType = attachment.mime || 'image/png';
            const data = buffer.toString('base64');

            if (provider === 'openai') {
                return [{
                    type: 'image_url',
                    image_url: { url: `data:${mimeType};base64,${data}`, detail: 'high' }
                }];
            }

            return [{ inlineData: { mimeType, data } }];
        } catch (error) {
            console.warn('Skipping chat image attachment:', error.message);
            return [];
        }
    });
}

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
        let baseTextPrompt = buildAnalysisPrompt(caseData, cfg.responseLanguage || 'fr');
        baseTextPrompt += `\n\n${buildComprehensiveCaseContext(caseData, cfg.responseLanguage || 'fr')}`;

        if (cfg.provider === 'openai') {
            // OpenAI multimodal path (Text extraction for PDFs)
            let openaiTextPrompt = baseTextPrompt;
            if (docResult.extractedText) {
                openaiTextPrompt += `\n\n═══════════════════════════════\nContenu extrait des documents joints (PDF):\n═══════════════════════════════\n${docResult.extractedText}`;
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

            console.log(`Processing document for AI: ID=${doc.id}, fileName=${fileName}, path=${filePath}`);

            if (!fileName || !filePath) continue;

            const isImage = fileName.match(/\.(jpg|jpeg|png|webp)$/i);
            const isPdf = fileName.match(/\.(pdf)$/i);

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
function buildAnalysisPrompt(caseData, responseLanguage = 'fr') {
    const { patient, answers, documents } = caseData;
    const hasDocs = documents && documents.length > 0;

    // Use computed age from backend (TIMESTAMPDIFF), fallback to manual calculation from date_of_birth
    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
        const dob = new Date(patient.date_of_birth);
        const now = new Date();
        patientAge = Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    let prompt = `You are a Senior Medical AI Specialist.
Your task is NOT merely to summarize — you must deliver a high-precision, professional clinical analysis.

IMPORTANT PROFESSIONAL NOTE: The patient is Algerian and may have been interviewed in "Algerian Darja" (a spoken Arabic dialect mixed with French and colloquial terms). You must accurately interpret their complaints. Examples:
- "عندي السطر" = pain
- "التخمام" = dizziness or anxiety
- "نحس بالدوخة" = I feel dizzy
- "عندي الحمى" = I have a fever
Always interpret Darja expressions in their correct medical context.

STRICT REQUIREMENTS:
1. CLINICAL SUMMARY: Summarize the case in 4 lines MAXIMUM (never exceed 4 lines, strictly enforced). Never mention the patient's first name or last name. ${hasDocs ? 'Attached documents exist — briefly mention the most important technical findings.' : 'End the summary with: (aucun document joint).'}
2. DIFFERENTIAL DIAGNOSIS: Provide the most probable diagnoses with percentage probability.
3. IMPORTANT ALERTS:
   - For "surgical emergencies" or critical conditions (e.g., testicular torsion, suspected myocardial infarction, acute abdomen, etc.), you MUST start the additionalNotes section with: [!!! URGENCE CHIRURGICALE / MÉDICALE !!!] followed by immediate action guidance for the doctor.

═══════════════════════════════
PATIENT INFORMATION (anonymized — name omitted for privacy):
═══════════════════════════════
- Gender: ${patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : 'Unspecified'}
- Age: ${patientAge || 'Unspecified'} years
- Date of birth: ${patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().slice(0, 10) : 'Unknown'}
- Siblings alive: ${patient.siblings_alive ?? 'Unknown'}
- Siblings deceased: ${patient.siblings_deceased ?? 'Unknown'}

═══════════════════════════════
MEDICAL QUESTIONNAIRE ANSWERS:
═══════════════════════════════`;

    // Add questionnaire answers
    answers.forEach((answer, index) => {
        const answerText = answer.text_answer || answer.textAnswer || 'No answer provided';
        prompt += `\n\n${index + 1}. Question: ${answer.question_text}`;
        prompt += `\n   Answer: ${answerText}`;
    });

    prompt += `

═══════════════════════════════
REQUIRED OUTPUT (JSON FORMAT):
═══════════════════════════════

Return your analysis as the following JSON structure:
{
  "summary": "Professional clinical summary in 4 lines maximum, covering medical history, current symptoms, and key document findings if any.",
  "diagnoses": [
    {
      "name": "Scientific diagnosis name in French medical terminology",
      "probability": 85,
      "reasoning": "Clinical reasoning based on symptoms and examination."
    }
  ],
  "additionalNotes": "Place any emergency alerts or specialized medical advice for the doctor here."
}`;

    prompt += `

CRITICAL LANGUAGE OVERRIDE:
- Return valid JSON only.
- Keep the JSON keys EXACTLY as specified: summary, diagnoses, additionalNotes, name, probability, reasoning.
- ALL human-readable values MUST be written in professional medical French.
- Do NOT write Arabic in the analysis, except when quoting the patient's original Darja wording verbatim.
- Diagnosis names MUST use French medical terminology (e.g., "Bronchiolite aiguë", "Gastro-entérite virale").`;

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
                if (parsed.summary) {
                    parsed.summary = clampSummaryToMaxLines(parsed.summary, 8);
                }
                return parsed;
            }
        }

        // Fallback: return raw response as summary
        return {
            summary: clampSummaryToMaxLines(response, 8),
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
    const systemContent = 'You are a Senior Medical AI Specialist. Analyze the provided medical case data with high clinical precision and return a structured JSON response. All human-readable values must be written in professional medical French. You may quote the patient\'s original Darja wording verbatim when relevant. The patient is Algerian and may have been interviewed in Algerian Darja (Arabic dialect with French terms).';

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
                        { role: 'system', content: systemContent },
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
 * @param {string} targetLang - Target language ('fr' or 'ar')
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(audioPath, aiConfig = null, targetLang = null) {
    const cfg = aiConfig || { provider: 'gemini', apiKey: config.ai.apiKey, model: config.ai.model };

    if (cfg.provider === 'openai') {
        return _transcribeAudioWhisper(audioPath, cfg, targetLang);
    }

    return _transcribeAudioGemini(audioPath, cfg, targetLang);
}

/**
 * Internal: Transcribe audio using Gemini
 */
async function _transcribeAudioGemini(audioPath, cfg, targetLang = null) {
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
        const promptText = targetLang === 'fr'
            ? `You are a medical transcription specialist. Listen to the following audio recording and transcribe it faithfully.

STRICT RULES:
- The speaker is a French-speaking medical professional (doctor or assistant).
- Transcribe the audio ONLY in French. Output nothing but the transcribed text.
- Do NOT add any introduction, explanation, commentary, or formatting.
- If the audio is silent, unclear, or contains no intelligible speech, output exactly: [Audio inaudible]
- Do NOT invent or hallucinate any content that is not in the recording.

Transcribe:`
            : `You are a medical transcription specialist. Listen to the following audio recording and transcribe it faithfully.

IMPORTANT CONTEXT: The speaker is Algerian and speaks in "Algerian Darja" — a spoken Arabic dialect that frequently mixes colloquial Arabic with French words and medical terminology. Examples of Darja expressions:
- "عندي السطر" = I have pain
- "التخمام" = dizziness/anxiety
- "راني نحس بالحمى" = I feel feverish
- "عندي مال دو تات" (mal de tête) = I have a headache
The speaker may also use pure Modern Standard Arabic or pure French for some sentences.

STRICT RULES:
- Transcribe exactly what you hear, preserving the original language (Darja, Arabic, or French) as spoken.
- Output ONLY the transcribed text — no introduction, explanation, or commentary.
- If the audio is silent, unclear, or contains no intelligible speech, output exactly: [Audio inaudible]
- Do NOT invent or hallucinate any content that is not in the recording.
- Do NOT generate content from your training data or the internet.

Transcribe:`;

        const promptParts = [
            {
                text: promptText
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
                return '[Échec de la transcription — veuillez réenregistrer]';
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
async function _transcribeAudioWhisper(audioPath, cfg, targetLang = null) {
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
        const transcriptionPrompt = targetLang === 'fr'
            ? 'Le locuteur parle en français médical. Transcription médicale professionnelle. Diagnostic, prescription, posologie, antécédents, examen clinique.'
            : 'المتحدث جزائري يتحدث بالدارجة الجزائرية مع مصطلحات طبية بالفرنسية. عندي السطر، التخمام، الدوخة، الحمى. Diagnostic, fièvre, douleur, prescription.';

        formData.append('file', blob, path.basename(absoluteAudioPath));
        formData.append('model', 'gpt-4o-mini-transcribe');
        formData.append('prompt', transcriptionPrompt);

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
                    console.warn('Transcription detected as hallucinated, rejecting:', text.substring(0, 80));
                    return '[Échec de la transcription — veuillez réenregistrer]';
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
        /السلام عليكم ورحمة الله وبركاته$/,  // Only greeting and nothing else
        /المتحدث يتحدث بالدارجة الجزائرية/i, // Catch prompt leakage
        /يرجى كتابة النص بدقة/i,            // Catch prompt leakage
        /تحويل الكلام إلى نص/i,            // Catch prompt leakage
        /audio transcription/i,             // Catch prompt leakage
        /medical terms/i                    // Catch prompt leakage
    ];

    // Normalize text for better matching (remove punctuation and extra spaces)
    const normalizedText = text.replace(/[.,!?;:()]/g, '').replace(/\s+/g, ' ').trim();

    for (const pattern of hallucinationPatterns) {
        if (pattern.test(text) || pattern.test(normalizedText)) {
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
function buildChatSystemPrompt(caseData, responseLanguage = 'fr') {
    const { patient, answers, documents } = caseData;

    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
        const dob = new Date(patient.date_of_birth);
        const now = new Date();
        patientAge = Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    let context = `You are a Senior Medical AI Consultant engaged in a clinical discussion with the treating physician about a patient case.

CORE BEHAVIOR RULES:
- Be precise, evidence-based, and clinically actionable in every response.
- Provide only confirmed, well-established medical information. Cite clinical guidelines (HAS, OMS, GINA, etc.) when relevant.
- Never use flattering or filler phrases (e.g., "Great question!", "Absolutely!", "That's an excellent observation!"). Get straight to the clinical point.
- If uncertain about a diagnosis or recommendation, explicitly state the degree of uncertainty.
- When the doctor asks a clinical question, respond with the same rigor expected in a hospital staff meeting.
- Structure your responses clearly: use numbered lists for differential diagnoses, bullet points for recommendations.

PATIENT CONTEXT NOTE: The patient is Algerian and may have been interviewed in "Algerian Darja" (spoken Arabic dialect mixed with French terms). Interpret Darja expressions accurately in their medical context.

═══════════════════════════════
PATIENT CONTEXT:
═══════════════════════════════
- Gender: ${patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : 'Unspecified'}
- Age: ${patientAge || 'Unspecified'} years

═══════════════════════════════
MEDICAL QUESTIONNAIRE ANSWERS:
═══════════════════════════════`;

    context += `\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in professional medical French.
You may quote the patient's original Darja wording verbatim when clinically relevant, but all your analysis, reasoning, and recommendations must be in French.`;

    if (answers && answers.length > 0) {
        answers.forEach((answer, index) => {
            const answerText = answer.text_answer || answer.textAnswer || 'No answer provided';
            context += `\n${index + 1}. ${answer.question_text}: ${answerText}`;
        });
    }

    const aiAnalysis = caseData.ai_analysis || caseData.aiAnalysis;
    if (aiAnalysis) {
        context += `\n\n═══════════════════════════════\nPREVIOUS AI ANALYSIS:\n═══════════════════════════════`;
        if (aiAnalysis.summary) context += `\nSummary: ${aiAnalysis.summary}`;
        if (aiAnalysis.diagnoses) {
            context += `\nSuggested diagnoses:`;
            aiAnalysis.diagnoses.forEach(d => {
                context += `\n- ${d.name}: ${d.reasoning || ''}`;
            });
        }
    }

    context += `\n\n${buildComprehensiveCaseContext(caseData, responseLanguage)}`;
    return context;
}

/**
 * Chat with AI about a patient case
 * @param {string} systemContext - System prompt with patient context
 * @param {Array} chatHistory - Previous messages [{role, content}]
 * @param {string} newMessage - Doctor's new message
 * @param {Object} aiConfig - AI configuration
 * @param {Array} attachments - Optional image attachments for the new doctor message
 * @returns {Promise<string>} AI response text
 */
async function chatWithAI(systemContext, chatHistory, newMessage, aiConfig = null, attachments = []) {
    const cfg = aiConfig || { provider: 'gemini', apiKey: config.ai.apiKey, model: config.ai.model };

    if (!cfg.apiKey) {
        throw Object.assign(new Error('Clé API non configurée'), { code: 'MISSING_API_KEY' });
    }

    if (cfg.provider === 'openai') {
        // OpenAI Chat Completions format
        const imageParts = buildImageAttachmentParts(attachments, 'openai');
        const userContent = imageParts.length > 0
            ? [{ type: 'text', text: newMessage || 'Please analyze the attached medical image in the case context.' }, ...imageParts]
            : newMessage;

        const messages = [
            { role: 'system', content: systemContext },
            ...chatHistory.map(m => ({
                role: m.role === 'doctor' ? 'user' : 'assistant',
                content: m.attachment_path
                    ? `${m.content || ''}\n[Previous image attachment: ${m.attachment_name || 'image'}]`.trim()
                    : m.content
            })),
            { role: 'user', content: userContent }
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
        return data.choices?.[0]?.message?.content || "L'IA n'a pas pu répondre.";
    }

    // Gemini format — use multi-turn conversation
    const apiKey = cfg.apiKey;
    const model = cfg.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = [];

    // Add system context as first user message
    contents.push({ role: 'user', parts: [{ text: systemContext + '\n\nCommencez la conversation. Je suis le médecin traitant.' }] });
    contents.push({ role: 'model', parts: [{ text: 'Bonjour Docteur. Je suis prêt à discuter de ce cas avec vous. Comment puis-je vous aider ?' }] });

    // Add chat history
    chatHistory.forEach(m => {
        contents.push({
            role: m.role === 'doctor' ? 'user' : 'model',
            parts: [{
                text: m.attachment_path
                    ? `${m.content || ''}\n[Previous image attachment: ${m.attachment_name || 'image'}]`.trim()
                    : m.content
            }]
        });
    });

    // Add new message
    const imageParts = buildImageAttachmentParts(attachments, 'gemini');
    contents.push({
        role: 'user',
        parts: [
            { text: newMessage || 'Please analyze the attached medical image in the case context.' },
            ...imageParts
        ]
    });

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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "L'IA n'a pas pu répondre.";
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
        throw Object.assign(new Error('Clé API non configurée'), { code: 'MISSING_API_KEY' });
    }

    const { patient, answers } = caseData;
    let patientAge = patient.age;
    if (!patientAge && patient.date_of_birth) {
        const dob = new Date(patient.date_of_birth);
        patientAge = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const aiAnalysis = caseData.ai_analysis || caseData.aiAnalysis;

    const prompt = `You are an expert clinical pharmacist.
Based on the following patient information, suggest the appropriate medications.

Patient:
- Gender: ${patient.gender === 'male' ? 'Male' : 'Female'}
- Age: ${patientAge || 'Undetermined'} years

${aiAnalysis?.summary ? `Clinical summary: ${aiAnalysis.summary}` : ''}
${aiAnalysis?.diagnoses ? `Diagnoses: ${aiAnalysis.diagnoses.map(d => d.name).join(', ')}` : ''}

Return ONLY a JSON array with the following structure.
CRITICAL: All values (name, dosage, frequency, duration) MUST be written in FRENCH. Never use Arabic or English in the JSON values.

[
  {
    "name": "Medication name (DCI in French)",
    "dosage": "Dosage (e.g., 500mg)",
    "frequency": "Frequency (e.g., 3x/jour)",
    "duration": "Duration (e.g., 7 jours)"
  }
]`;

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
    buildComprehensiveCaseContext,
    suggestMedications,
    clampSummaryToMaxLines
};
