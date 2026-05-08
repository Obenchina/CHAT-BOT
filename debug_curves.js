const {pool} = require('./backend/src/config/database');
(async () => {
    const [rows] = await pool.execute(
        "SELECT id, measure_key, gender, file_path, is_calibrated, template_config FROM doctor_growth_curves WHERE measure_key = 'weight_height'"
    );
    for (const row of rows) {
        const tc = typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config;
        console.log('--- Curve ID:', row.id, '---');
        console.log('measure_key:', row.measure_key);
        console.log('gender:', row.gender);
        console.log('file_path:', row.file_path);
        console.log('is_calibrated:', row.is_calibrated);
        console.log('has measure_configs:', !!tc?.measure_configs);
        if (tc?.measure_configs) {
            console.log('height config:', JSON.stringify(tc.measure_configs.height, null, 2));
            console.log('weight config:', JSON.stringify(tc.measure_configs.weight, null, 2));
        }
        console.log('full template_config keys:', Object.keys(tc || {}));
    }
    if (rows.length === 0) console.log('NO weight_height curves found!');
    process.exit(0);
})();
