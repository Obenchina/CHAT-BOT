/**
 * AiConfig Model
 * Database operations for ai_config table
 * Stores per-doctor AI provider settings (Gemini / OpenAI)
 */

const { pool } = require('../config/database');
const config = require('../config/config');

const AiConfig = {
    /**
     * Get all AI configs for a doctor
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of configs
     */
    async getAllConfigs(doctorId) {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ?',
            [doctorId]
        );
        return rows;
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
                `INSERT INTO ai_config (doctor_id, provider, api_key, model, is_active) VALUES (?, ?, '', ?, true)`,
                [doctorId, provider, provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini']
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
        if (rows.length > 0) return rows[0];

        // Fallback: get any config if none is explicitly active
        const [anyRows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ? LIMIT 1',
            [doctorId]
        );
        return anyRows.length > 0 ? anyRows[0] : null;
    },

    /**
     * Get specific config by provider
     */
    async findByProvider(doctorId, provider) {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_config WHERE doctor_id = ? AND provider = ?',
            [doctorId, provider]
        );
        return rows.length > 0 ? rows[0] : null;
    },

    /**
     * Upsert AI config (insert or update) and set it as active
     * @param {number} doctorId - Doctor ID
     * @param {Object} data - { provider, apiKey, model }
     * @returns {Promise<Object>} Updated active config
     */
    async upsert(doctorId, { provider, apiKey, model }) {
        const [existing] = await pool.execute(
            'SELECT id FROM ai_config WHERE doctor_id = ? AND provider = ?',
            [doctorId, provider]
        );

        if (existing.length > 0) {
            await pool.execute(
                `UPDATE ai_config SET api_key = ?, model = ?, is_active = true WHERE doctor_id = ? AND provider = ?`,
                [apiKey, model, doctorId, provider]
            );
        } else {
            await pool.execute(
                `INSERT INTO ai_config (doctor_id, provider, api_key, model, is_active) VALUES (?, ?, ?, ?, true)`,
                [doctorId, provider, apiKey, model]
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
                model: doctorConfig.model
            };
        }

        const error = new Error('Aucune clé API configurée pour ce compte. Veuillez la configurer dans Paramètres > Configuration IA.');
        error.code = 'MISSING_API_KEY';
        throw error;
    }
};

module.exports = AiConfig;
