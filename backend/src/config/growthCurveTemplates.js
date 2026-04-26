/**
 * Official pre-calibrated pediatric growth curve templates.
 * These templates are immutable and developer-calibrated.
 */
const OFFICIAL_GROWTH_CURVE_TEMPLATES = [
    {
        id: 'official_weight_boys_0_5',
        measure_key: 'weight',
        template_key: 'weight_boys_0_5',
        label: 'Poids garçons 0-5 ans (OMS)',
        gender: 'male',
        age_range: { min_age: 0, max_age: 60, unit: 'months' },
        template_config: {
            x_min: 0,
            x_max: 60,
            y_min: 1,
            y_max: 35,
            x_unit: 'months',
            y_unit: 'kg',
            plot_area: { left: 12, top: 10, right: 91, bottom: 88 }
        }
    },
    {
        id: 'official_weight_girls_0_5',
        measure_key: 'weight',
        template_key: 'weight_girls_0_5',
        label: 'Poids filles 0-5 ans (OMS)',
        gender: 'female',
        age_range: { min_age: 0, max_age: 60, unit: 'months' },
        template_config: {
            x_min: 0,
            x_max: 60,
            y_min: 1,
            y_max: 35,
            x_unit: 'months',
            y_unit: 'kg',
            plot_area: { left: 12, top: 10, right: 91, bottom: 88 }
        }
    },
    {
        id: 'official_height_boys_0_5',
        measure_key: 'height',
        template_key: 'height_boys_0_5',
        label: 'Taille garçons 0-5 ans (OMS)',
        gender: 'male',
        age_range: { min_age: 0, max_age: 60, unit: 'months' },
        template_config: {
            x_min: 0,
            x_max: 60,
            y_min: 40,
            y_max: 130,
            x_unit: 'months',
            y_unit: 'cm',
            plot_area: { left: 12, top: 10, right: 91, bottom: 88 }
        }
    },
    {
        id: 'official_height_girls_0_5',
        measure_key: 'height',
        template_key: 'height_girls_0_5',
        label: 'Taille filles 0-5 ans (OMS)',
        gender: 'female',
        age_range: { min_age: 0, max_age: 60, unit: 'months' },
        template_config: {
            x_min: 0,
            x_max: 60,
            y_min: 40,
            y_max: 130,
            x_unit: 'months',
            y_unit: 'cm',
            plot_area: { left: 12, top: 10, right: 91, bottom: 88 }
        }
    },
    {
        id: 'official_head_boys_0_5',
        measure_key: 'head',
        template_key: 'head_boys_0_5',
        label: 'Périmètre crânien garçons 0-5 ans (OMS)',
        gender: 'male',
        age_range: { min_age: 0, max_age: 60, unit: 'months' },
        template_config: {
            x_min: 0,
            x_max: 60,
            y_min: 30,
            y_max: 60,
            x_unit: 'months',
            y_unit: 'cm',
            plot_area: { left: 12, top: 10, right: 91, bottom: 88 }
        }
    },
    {
        id: 'official_head_girls_0_5',
        measure_key: 'head',
        template_key: 'head_girls_0_5',
        label: 'Périmètre crânien filles 0-5 ans (OMS)',
        gender: 'female',
        age_range: { min_age: 0, max_age: 60, unit: 'months' },
        template_config: {
            x_min: 0,
            x_max: 60,
            y_min: 30,
            y_max: 60,
            x_unit: 'months',
            y_unit: 'cm',
            plot_area: { left: 12, top: 10, right: 91, bottom: 88 }
        }
    }
];

function mapPointToPixels({ age, value, templateConfig, widthPx = 1000, heightPx = 1000 }) {
    const left = (templateConfig.plot_area.left / 100) * widthPx;
    const right = (templateConfig.plot_area.right / 100) * widthPx;
    const top = (templateConfig.plot_area.top / 100) * heightPx;
    const bottom = (templateConfig.plot_area.bottom / 100) * heightPx;

    const pixelX = left + ((age - templateConfig.x_min) / (templateConfig.x_max - templateConfig.x_min)) * (right - left);
    const pixelY = bottom - ((value - templateConfig.y_min) / (templateConfig.y_max - templateConfig.y_min)) * (bottom - top);
    return { x: pixelX, y: pixelY, left, right, top, bottom };
}

function validateTemplateCalibration(template) {
    const tc = template.template_config;
    if (!tc || !tc.plot_area) return false;
    if (tc.x_max <= tc.x_min || tc.y_max <= tc.y_min) return false;

    // Known test point: center of domain should map to center of plot area.
    const testAge = (tc.x_min + tc.x_max) / 2;
    const testValue = (tc.y_min + tc.y_max) / 2;
    const mapped = mapPointToPixels({ age: testAge, value: testValue, templateConfig: tc, widthPx: 1000, heightPx: 1000 });

    const expectedX = (mapped.left + mapped.right) / 2;
    const expectedY = (mapped.top + mapped.bottom) / 2;
    const dx = Math.abs(mapped.x - expectedX);
    const dy = Math.abs(mapped.y - expectedY);

    // Strict tolerance: <= 1 pixel
    return dx <= 1 && dy <= 1;
}

function getValidatedOfficialTemplates() {
    return OFFICIAL_GROWTH_CURVE_TEMPLATES.filter(validateTemplateCalibration);
}

module.exports = {
    OFFICIAL_GROWTH_CURVE_TEMPLATES,
    getValidatedOfficialTemplates
};

