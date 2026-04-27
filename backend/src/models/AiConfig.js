/**
 * AiConfig Model
 * Database operations for ai_config table
 * Stores per-doctor AI provider settings (Gemini / OpenAI)
 * 
 * API keys are encrypted at rest using AES-256-GCM.
 */

const { pool } = require('../config/database');
const config = require('../config/config');
const crypto = require('crypto');

// ======================
// ENCRYPTION UTILITIES
// ======================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the 32-byte encryption key from environment.
 * Falls back to a deterministic dev key (NOT for production).
 */
function getEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
        // Ensure exactly 32 bytes (SHA-256 hash if key is arbitrary string)
        return crypto.createHash('sha256').update(envKey).digest();
    }
    console.warn('⚠️ ENCRYPTION_KEY not set — using insecure dev fallback. Set ENCRYPTION_KEY in .env for production!');
    return crypto.createHash('sha256').update('dev_only_insecure_encryption_key').digest();
}

/**
 * Encrypt a plaintext string → "iv:authTag:ciphertext" (hex encoded)
 */
function encrypt(plaintext) {
    if (!plaintext) return '';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an "iv:authTag:ciphertext" string → plaintext
 * If the value doesn't look encrypted (no colons), returns it as-is (migration compatibility).
 */
function decrypt(encryptedValue) {
    if (!encryptedValue) return '';

    // If it doesn't contain the expected format, it's likely a legacy plaintext key
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
        return encryptedValue; // Return as-is for backwards compatibility
    }

    try {
        const key = getEncryptionKey();
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption failed — key may have been rotated or value is corrupt:', error.message);
        return encryptedValue; // Return raw value as fallback
    }
}

// ======================
// MODEL
// ======================

const AiConfig = {
    /**
     * Get all AI configs for a doctor
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of configs (with decrypted keys)
     */
    async getAllConfigs(doctorId) {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ?',
            [doctorId]
        );
        // Decrypt API keys before returning
        return rows.map(row => ({ ...row, api_key: decrypt(row.api_key) }));
    },

    /**
     * Set active provider
     */
    async setActiveProvider(doctorId, provider) {
        // First check if the config exists
        const [existing] = await pool.execute(
            'SELECT id FROM ai_config WHERE doctor_id = ? AND provider = ?',
            [doctorId, provider]
        );

        if (existing.length === 0) {
            // Create empty config just to hold the active state
            await pool.execute(
                `INSERT INTO ai_config (doctor_id, provider, api_key, model, is_active, response_language) VALUES (?, ?, '', ?, true, 'ar')`,
                [doctorId, provider, provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-5.4-mini']
            );
        } else {
            // Set the explicitly chosen one to active
            await pool.execute(`UPDATE ai_config SET is_active = true WHERE doctor_id = ? AND provider = ?`, [doctorId, provider]);
        }

        // Set all others to inactive
        await pool.execute(
            `UPDATE ai_config SET is_active = false WHERE doctor_id = ? AND provider != ?`,
            [doctorId, provider]
        );

        return true;
    },

    /**
     * Find active AI config by doctor ID
     */
    async findActiveConfig(doctorId) {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ? AND is_active = true LIMIT 1',
            [doctorId]
        );
        if (rows.length > 0) {
            return { ...rows[0], api_key: decrypt(rows[0].api_key) };
        }

        // Fallback: get any config if none is explicitly active
        const [anyRows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ? LIMIT 1',
            [doctorId]
        );
        return anyRows.length > 0 ? { ...anyRows[0], api_key: decrypt(anyRows[0].api_key) } : null;
    },

    /**
     * Backwards-compatible alias (older controllers expect this name)
     */
    async findActiveByDoctorId(doctorId) {
        return this.findActiveConfig(doctorId);
    },

    /**
     * Get specific config by provider
     */
    async findByProvider(doctorId, provider) {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ? AND provider = ?',
            [doctorId, provider]
        );
        return rows.length > 0 ? { ...rows[0], api_key: decrypt(rows[0].api_key) } : null;
    },

    /**
     * Upsert AI config (insert or update) and set it as active
     * @param {number} doctorId - Doctor ID
     * @param {Object} data - { provider, apiKey, model, responseLanguage }
     * @returns {Promise<Object>} Updated active config
     */
    async upsert(doctorId, { provider, apiKey, model, responseLanguage }) {
        // Encrypt the API key before storage
        const encryptedKey = encrypt(apiKey);
        const normalizedLanguage = responseLanguage === 'fr' ? 'fr' : (responseLanguage === 'ar' ? 'ar' : null);

        const [existing] = await pool.execute(
            'SELECT id FROM ai_config WHERE doctor_id = ? AND provider = ?',
            [doctorId, provider]
        );

        if (existing.length > 0) {
            await pool.execute(
                `UPDATE ai_config
                 SET api_key = ?, model = ?, is_active = true, response_language = COALESCE(?, response_language, 'ar')
                 WHERE doctor_id = ? AND provider = ?`,
                [encryptedKey, model, normalizedLanguage, doctorId, provider]
            );
        } else {
            await pool.execute(
                `INSERT INTO ai_config (doctor_id, provider, api_key, model, is_active, response_language) VALUES (?, ?, ?, ?, true, ?)`,
                [doctorId, provider, encryptedKey, model, normalizedLanguage || 'ar']
            );
        }

        // Set all OTHER configs to inactive
        await pool.execute(
            `UPDATE ai_config SET is_active = false WHERE doctor_id = ? AND provider != ?`,
            [doctorId, provider]
        );

        return this.findActiveConfig(doctorId);
    },

    /**
     * Get effective AI config for a doctor
     */
    async getEffectiveConfig(doctorId) {
        const doctorConfig = await this.findActiveConfig(doctorId);

        if (doctorConfig && doctorConfig.api_key) {
            return {
                provider: doctorConfig.provider,
                apiKey: doctorConfig.api_key,
                model: doctorConfig.model,
                responseLanguage: doctorConfig.response_language || 'ar'
            };
        }

        const error = new Error('Aucune clé API configurée pour ce compte. Veuillez la configurer dans Paramètres > Configuration IA.');
        error.code = 'MISSING_API_KEY';
        throw error;
    }
};

module.exports = AiConfig;
