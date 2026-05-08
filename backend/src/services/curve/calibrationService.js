/**
 * Calibration service for the calibrated-overlay rendering mode.
 *
 * A calibration teaches the system how to map (age, value) pairs to pixel
 * coordinates on a static chart image (typically the doctor's uploaded PDF
 * page). The doctor clicks two known points along each axis; from there the
 * system can render patient measurements in the exact correct position over
 * the original chart.
 *
 * Calibration shape (stored as JSON in doctor_growth_curves.calibration):
 * {
 *   imageWidth: 1170,
 *   imageHeight: 1536,
 *   x: { aA: 1, pxA: 120, aB: 18, pxB: 1100, unit: 'years' },
 *   yPrimary: { axis: 'taille', unit: 'cm', vA: 60, pyA: 1500, vB: 200, pyB: 80 },
 *   ySecondary: { axis: 'poids', unit: 'kg', vA: 0, pyA: 1500, vB: 110, pyB: 80 } | null
 * }
 *
 * Pixel coordinates are in the source image's native pixel space (not the
 * displayed/CSS-scaled space). The frontend converts to CSS percentages at
 * render time using imageWidth / imageHeight.
 */

const SUPPORTED_X_UNITS = new Set(['months', 'years']);
const SUPPORTED_Y_AXES = new Set(['taille', 'poids', 'pc', 'imc']);

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function validateAxisPair(pair, name) {
    if (!pair || typeof pair !== 'object') {
        return `${name} requis`;
    }
    if (!isFiniteNumber(pair.aA) || !isFiniteNumber(pair.aB)) {
        if (!isFiniteNumber(pair.vA) || !isFiniteNumber(pair.vB)) {
            return `${name}: valeurs A et B requises`;
        }
    }
    return null;
}

/**
 * Validate calibration object. Returns { ok, errors }.
 */
function validateCalibration(calibration) {
    const errors = [];
    if (!calibration || typeof calibration !== 'object') {
        return { ok: false, errors: ['Calibration manquante'] };
    }

    if (!isFiniteNumber(calibration.imageWidth) || calibration.imageWidth < 50) {
        errors.push('imageWidth invalide');
    }
    if (!isFiniteNumber(calibration.imageHeight) || calibration.imageHeight < 50) {
        errors.push('imageHeight invalide');
    }

    const x = calibration.x;
    if (!x || !isFiniteNumber(x.aA) || !isFiniteNumber(x.aB)
        || !isFiniteNumber(x.pxA) || !isFiniteNumber(x.pxB)) {
        errors.push("Axe X (âge) : deux points de calibration requis");
    } else if (x.aA === x.aB) {
        errors.push("Axe X : les deux âges de référence doivent être distincts");
    } else if (x.pxA === x.pxB) {
        errors.push("Axe X : les deux pixels de référence doivent être distincts");
    } else if (x.unit && !SUPPORTED_X_UNITS.has(x.unit)) {
        errors.push(`Axe X : unité '${x.unit}' non supportée (months|years)`);
    }

    const yp = calibration.yPrimary;
    if (!yp || !isFiniteNumber(yp.vA) || !isFiniteNumber(yp.vB)
        || !isFiniteNumber(yp.pyA) || !isFiniteNumber(yp.pyB)) {
        errors.push("Axe Y principal : deux points de calibration requis");
    } else if (yp.vA === yp.vB) {
        errors.push("Axe Y principal : les deux valeurs doivent être distinctes");
    } else if (yp.pyA === yp.pyB) {
        errors.push("Axe Y principal : les deux pixels doivent être distincts");
    } else if (yp.axis && !SUPPORTED_Y_AXES.has(yp.axis)) {
        errors.push(`Axe Y principal : '${yp.axis}' non supporté`);
    }

    const ys = calibration.ySecondary;
    if (ys != null) {
        if (!isFiniteNumber(ys.vA) || !isFiniteNumber(ys.vB)
            || !isFiniteNumber(ys.pyA) || !isFiniteNumber(ys.pyB)) {
            errors.push("Axe Y secondaire : deux points de calibration requis");
        } else if (ys.vA === ys.vB) {
            errors.push("Axe Y secondaire : les deux valeurs doivent être distinctes");
        } else if (ys.pyA === ys.pyB) {
            errors.push("Axe Y secondaire : les deux pixels doivent être distincts");
        } else if (ys.axis && !SUPPORTED_Y_AXES.has(ys.axis)) {
            errors.push(`Axe Y secondaire : '${ys.axis}' non supporté`);
        } else if (yp && ys.axis && yp.axis && ys.axis === yp.axis) {
            errors.push("Axe Y secondaire doit être différent du primaire");
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Map an age (in months or years matching x.unit) to a pixel x coordinate.
 * Linear interpolation/extrapolation between the two calibration points.
 */
function ageToPixelX(calibration, ageInUnit) {
    const x = calibration?.x;
    if (!x) return null;
    const slope = (x.pxB - x.pxA) / (x.aB - x.aA);
    return x.pxA + (ageInUnit - x.aA) * slope;
}

/**
 * Map a y-axis value to a pixel y coordinate.
 * @param axisKey 'primary' | 'secondary'
 */
function valueToPixelY(calibration, axisKey, value) {
    const axis = axisKey === 'secondary' ? calibration?.ySecondary : calibration?.yPrimary;
    if (!axis) return null;
    const slope = (axis.pyB - axis.pyA) / (axis.vB - axis.vA);
    return axis.pyA + (value - axis.vA) * slope;
}

/**
 * Convert a measurement to relative (percentage) position on the image.
 * Returns { xPct, yPct } or null if calibration incomplete.
 *
 * @param ageInMonths   the patient's age in MONTHS (canonical representation)
 * @param value         the measurement value (cm | kg | …)
 * @param axisKey       'primary' | 'secondary'
 */
function projectMeasurement(calibration, ageInMonths, value, axisKey = 'primary') {
    const v = validateCalibration(calibration);
    if (!v.ok) return null;
    if (!isFiniteNumber(ageInMonths) || !isFiniteNumber(value)) return null;

    const xUnit = calibration.x.unit || 'years';
    const ageInUnit = xUnit === 'months' ? ageInMonths : ageInMonths / 12;

    const px = ageToPixelX(calibration, ageInUnit);
    const py = valueToPixelY(calibration, axisKey, value);
    if (px == null || py == null) return null;

    const xPct = (px / calibration.imageWidth) * 100;
    const yPct = (py / calibration.imageHeight) * 100;
    return { xPct, yPct, px, py };
}

/**
 * Inverse mapping: pixel (px,py) → (age, value). Useful for hover tooltips.
 */
function pixelToData(calibration, px, py, axisKey = 'primary') {
    const v = validateCalibration(calibration);
    if (!v.ok) return null;
    const xPair = calibration.x;
    const yPair = axisKey === 'secondary' ? calibration.ySecondary : calibration.yPrimary;
    if (!yPair) return null;
    const ageInUnit = xPair.aA + (px - xPair.pxA) * (xPair.aB - xPair.aA) / (xPair.pxB - xPair.pxA);
    const value = yPair.vA + (py - yPair.pyA) * (yPair.vB - yPair.vA) / (yPair.pyB - yPair.pyA);
    return { ageInUnit, value };
}

module.exports = {
    validateCalibration,
    projectMeasurement,
    pixelToData,
    ageToPixelX,
    valueToPixelY,
};
