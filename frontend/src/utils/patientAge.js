function normalizeDateOnly(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
        return isNaN(dateInput.getTime()) ? null : dateInput;
    }
    if (typeof dateInput === 'string') {
        // Accept YYYY-MM-DD or ISO string
        const datePart = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
        const d = new Date(datePart);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function diffDays(dob, now) {
    const ms = now.getTime() - dob.getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function diffMonths(dob, now) {
    let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    // If current day is before DOB day, subtract one month
    if (now.getDate() < dob.getDate()) months -= 1;
    return Math.max(0, months);
}

function diffYears(dob, now) {
    let years = now.getFullYear() - dob.getFullYear();
    const hasHadBirthdayThisYear =
        now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!hasHadBirthdayThisYear) years -= 1;
    return Math.max(0, years);
}

/**
 * Compute patient age display from date_of_birth.
 * Rules:
 * - < 1 month: display in days
 * - < 1 year: display in months
 * - >= 1 year: display in years
 */
export function computeAgeDisplay(dateOfBirth, nowInput = new Date()) {
    const dob = normalizeDateOnly(dateOfBirth);
    const now = normalizeDateOnly(nowInput) || new Date();
    if (!dob) return { value: null, unit: null, label: '—' };
    if (dob > now) return { value: null, unit: null, label: '—' };

    const days = diffDays(dob, now);
    if (days < 31) {
        const value = Math.max(0, days);
        return { value, unit: 'days', label: `${value} jour${value > 1 ? 's' : ''}` };
    }

    const months = diffMonths(dob, now);
    if (months < 12) {
        const value = Math.max(0, months);
        return { value, unit: 'months', label: `${value} mois` };
    }

    const years = diffYears(dob, now);
    const value = Math.max(0, years);
    return { value, unit: 'years', label: `${value} an${value > 1 ? 's' : ''}` };
}

export function formatDateOnlyDisplay(dateInput, locale = 'fr-FR') {
    const d = normalizeDateOnly(dateInput);
    if (!d) return '—';
    try {
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        // Fallback (should be rare)
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy}`;
    }
}

