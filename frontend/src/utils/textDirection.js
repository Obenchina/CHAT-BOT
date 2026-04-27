const RTL_TEXT_PATTERN = /[\u0590-\u08FF\uFB1D-\uFEFC]/;

export function isRtlText(value) {
    return RTL_TEXT_PATTERN.test(String(value || ''));
}

export function getTextDirection(value) {
    return isRtlText(value) ? 'rtl' : 'ltr';
}

export function getTextAlign(value) {
    return isRtlText(value) ? 'right' : 'left';
}
