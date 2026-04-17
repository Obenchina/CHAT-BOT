/**
 * PDF Service
 * Generate medical documents (Ordonnance, Rapport)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const BRAND = {
    primary: '#163A5F',
    secondary: '#67C7D8',
    soft: '#F3FAFC',
    border: '#D7E5F0',
    text: '#1C2B39',
    muted: '#5F7387',
    white: '#FFFFFF'
};

const SPECIALTY_LABELS = {
    general_medicine: 'Medecine generale',
    cardiology: 'Cardiologie',
    dermatology: 'Dermatologie',
    neurology: 'Neurologie',
    pediatrics: 'Pediatrie',
    psychiatry: 'Psychiatrie',
    surgery: 'Chirurgie',
    gynecology: 'Gynecologie',
    ophthalmology: 'Ophtalmologie',
    orthopedics: 'Orthopedie'
};

const GENDER_LABELS = {
    male: 'Homme',
    female: 'Femme'
};

function normalizeText(value, fallback = '') {
    if (value === undefined || value === null) {
        return fallback;
    }

    const text = String(value).trim();
    return text || fallback;
}

function normalizeHexColor(value, fallback) {
    const raw = normalizeText(value);
    if (!raw) {
        return fallback;
    }

    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

function mixWithWhite(hex, ratio = 0.82) {
    const color = normalizeHexColor(hex, BRAND.primary).replace('#', '');
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);
    const mix = (channel) => Math.round(channel + (255 - channel) * ratio);

    return `#${[mix(r), mix(g), mix(b)]
        .map((channel) => channel.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
}

function buildTheme(doctor) {
    const primary = normalizeHexColor(
        doctor?.prescriptionPrimaryColor || doctor?.prescription_primary_color,
        BRAND.primary
    );
    const secondary = normalizeHexColor(
        doctor?.prescriptionAccentColor || doctor?.prescription_accent_color,
        BRAND.secondary
    );

    return {
        ...BRAND,
        primary,
        secondary,
        soft: mixWithWhite(secondary, 0.86),
        border: mixWithWhite(primary, 0.82)
    };
}

function formatDateFr(value) {
    return new Date(value || Date.now()).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatGenericLabel(value) {
    return normalizeText(value)
        .replace(/[_-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => {
            if (word.length <= 3) {
                return word.toUpperCase();
            }

            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

function formatSpecialtyLabel(specialty) {
    const specialtyKey = normalizeText(specialty);
    if (!specialtyKey) {
        return 'Medecine generale';
    }

    return SPECIALTY_LABELS[specialtyKey] || formatGenericLabel(specialtyKey);
}

function formatGenderLabel(gender) {
    const genderKey = normalizeText(gender).toLowerCase();
    return GENDER_LABELS[genderKey] || formatGenericLabel(genderKey || 'patient');
}

function getDoctorDisplayName(doctor) {
    const firstName = normalizeText(doctor.firstName || doctor.first_name);
    const lastName = normalizeText(doctor.lastName || doctor.last_name);
    return `Dr ${`${firstName} ${lastName}`.trim()}`.trim();
}

function getDoctorLogoPath(doctor) {
    return normalizeText(
        doctor?.prescriptionLogoPath ||
        doctor?.prescription_logo_path ||
        doctor?.logoPath ||
        doctor?.logo_path
    );
}

function getDoctorSpecialtyText(doctor) {
    const customText = normalizeText(
        doctor?.prescriptionSpecialtyText || doctor?.prescription_specialty_text
    );

    return customText || formatSpecialtyLabel(doctor?.specialty);
}

function getDoctorServices(doctor) {
    const servicesText = normalizeText(
        doctor?.prescriptionServicesText || doctor?.prescription_services_text
    );

    if (!servicesText) {
        return [];
    }

    return servicesText
        .split(/\r?\n/)
        .map((line) => normalizeText(line))
        .filter(Boolean)
        .slice(0, 6);
}

function getPatientFirstName(patient) {
    return normalizeText(patient.firstName || patient.first_name);
}

function getPatientLastName(patient) {
    return normalizeText(patient.lastName || patient.last_name);
}

function ensureOutputDirectory(filepath) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
}

function getPageBounds(doc) {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    return {
        left,
        right,
        width: right - left,
        bottom: doc.page.height - doc.page.margins.bottom
    };
}

function drawDefaultLogo(doc, theme, x, y) {
    const size = 48;

    doc.save();
    doc.roundedRect(x, y, size, size, 14).fill(theme.secondary);
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(18);
    doc.text('MC', x, y + 15, { width: size, align: 'center' });
    doc.restore();

    return size;
}

function drawLogo(doc, doctor, theme, x, y) {
    const rawLogoPath = getDoctorLogoPath(doctor);
    if (!rawLogoPath) {
        return drawDefaultLogo(doc, theme, x, y);
    }

    const resolvedLogoPath = path.isAbsolute(rawLogoPath)
        ? rawLogoPath
        : path.join(process.cwd(), rawLogoPath);

    try {
        if (fs.existsSync(resolvedLogoPath)) {
            doc.image(resolvedLogoPath, x, y, { fit: [48, 48], align: 'center', valign: 'center' });
            return 48;
        }
    } catch (error) {
        console.warn('Failed to load doctor logo for PDF:', error.message);
    }

    return drawDefaultLogo(doc, theme, x, y);
}

function drawHeader(doc, doctor, date, theme) {
    const bounds = getPageBounds(doc);
    const headerTop = 36;
    const specialtyText = getDoctorSpecialtyText(doctor);
    const services = getDoctorServices(doctor);
    const servicesHeight = services.length ? (services.length * 12) + 6 : 0;
    const contactLines = [
        doctor.phone ? `Mobile: ${doctor.phone}` : null,
        doctor.email ? `Email: ${doctor.email}` : null,
        doctor.address ? `Adresse: ${doctor.address}` : null
    ].filter(Boolean);
    const contactBlockHeight = contactLines.length ? 26 : 0;
    const headerHeight = 112 + servicesHeight + contactBlockHeight;

    doc.roundedRect(bounds.left, headerTop, bounds.width, 10, 5).fill(theme.primary);
    doc.roundedRect(bounds.left, headerTop + 8, bounds.width, headerHeight, 18).fill(theme.soft);

    const logoSize = drawLogo(doc, doctor, theme, bounds.left + 18, headerTop + 28);
    const doctorInfoX = bounds.left + 18 + logoSize + 16;
    const dateBoxWidth = 116;
    const doctorInfoWidth = bounds.width - (doctorInfoX - bounds.left) - dateBoxWidth - 36;

    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(18);
    doc.text(getDoctorDisplayName(doctor), doctorInfoX, headerTop + 28, {
        width: doctorInfoWidth
    });

    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(12);
    doc.text(specialtyText, doctorInfoX, headerTop + 54, {
        width: doctorInfoWidth
    });

    let servicesY = headerTop + 74;
    if (services.length) {
        doc.fillColor(theme.text).font('Helvetica').fontSize(9.5);
        services.forEach((service) => {
            doc.text(`- ${service}`, doctorInfoX, servicesY, {
                width: doctorInfoWidth
            });
            servicesY += 12;
        });
    }

    const dateBoxX = bounds.right - dateBoxWidth - 18;
    doc.roundedRect(dateBoxX, headerTop + 32, dateBoxWidth, 44, 14).fill(theme.white);
    doc.fillColor(theme.muted).font('Helvetica').fontSize(8);
    doc.text('Date', dateBoxX, headerTop + 44, { width: dateBoxWidth, align: 'center' });
    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(11);
    doc.text(formatDateFr(date), dateBoxX, headerTop + 56, { width: dateBoxWidth, align: 'center' });

    if (contactLines.length) {
        const dividerY = headerTop + headerHeight - 34;
        doc.strokeColor(theme.border).lineWidth(1);
        doc.moveTo(bounds.left + 18, dividerY).lineTo(bounds.right - 18, dividerY).stroke();

        doc.fillColor(theme.muted).font('Helvetica').fontSize(9);
        doc.text(contactLines.join('   |   '), bounds.left + 18, dividerY + 10, {
            width: bounds.width - 36,
            align: 'center'
        });
    }

    return headerTop + headerHeight + 26;
}

function drawPatientCard(doc, patient, y, theme) {
    const bounds = getPageBounds(doc);
    const cardHeight = 60;
    const columnWidth = bounds.width / 3;

    doc.roundedRect(bounds.left, y, bounds.width, cardHeight, 16).fillAndStroke(theme.white, theme.border);

    const fields = [
        { label: 'Nom', value: getPatientLastName(patient).toUpperCase() || '-' },
        { label: 'Prenom', value: getPatientFirstName(patient).toUpperCase() || '-' },
        { label: 'Age', value: patient.age ? `${patient.age} ans` : '-' }
    ];

    fields.forEach((field, index) => {
        const fieldX = bounds.left + index * columnWidth + 16;

        doc.fillColor(theme.muted).font('Helvetica').fontSize(9);
        doc.text(field.label, fieldX, y + 14, { width: columnWidth - 24 });

        doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(12);
        doc.text(field.value, fieldX, y + 28, { width: columnWidth - 24 });
    });

    return y + cardHeight + 26;
}

function drawTitle(doc, title, y, theme) {
    const bounds = getPageBounds(doc);

    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(24);
    doc.text(title, bounds.left, y, { width: bounds.width, align: 'center' });

    doc.roundedRect(bounds.left + (bounds.width / 2) - 34, y + 34, 68, 4, 2).fill(theme.secondary);

    return y + 54;
}

function drawContinuationHeader(doc, doctor, title, theme) {
    const bounds = getPageBounds(doc);
    const y = 40;

    doc.roundedRect(bounds.left, y, bounds.width, 52, 16).fill(theme.soft);
    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(13);
    doc.text(getDoctorDisplayName(doctor), bounds.left + 18, y + 18, {
        width: bounds.width / 2
    });

    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(12);
    doc.text(`${title} - suite`, bounds.left, y + 18, {
        width: bounds.width - 18,
        align: 'right'
    });

    return y + 76;
}

function drawMedicationItem(doc, medication, index, y, theme) {
    const bounds = getPageBounds(doc);
    const name = normalizeText(medication.name, 'Medicament');
    const quantity = normalizeText(medication.quantity);
    const details = [medication.dosage, medication.frequency, medication.duration]
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(' - ');

    const itemHeight = details || quantity ? 60 : 48;

    doc.roundedRect(bounds.left, y, bounds.width, itemHeight, 14).fillAndStroke(theme.white, theme.border);

    doc.roundedRect(bounds.left + 14, y + 14, 28, 28, 10).fill(theme.soft);
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11);
    doc.text(String(index + 1), bounds.left + 14, y + 21, { width: 28, align: 'center' });

    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(12);
    doc.text(name, bounds.left + 56, y + 14, {
        width: bounds.width - 140
    });

    if (quantity) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(10);
        doc.text(quantity, bounds.left + bounds.width - 110, y + 16, {
            width: 90,
            align: 'right'
        });
    }

    if (details) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(10);
        doc.text(details, bounds.left + 56, y + 33, {
            width: bounds.width - 80
        });
    }

    return y + itemHeight + 14;
}

function drawSignature(doc, doctor, y, theme) {
    const bounds = getPageBounds(doc);
    const blockWidth = 180;
    const blockX = bounds.right - blockWidth;

    doc.fillColor(theme.muted).font('Helvetica').fontSize(8);
    doc.text('Signature', blockX, y - 12, { width: blockWidth, align: 'center' });

    doc.strokeColor(theme.border).lineWidth(1);
    doc.moveTo(blockX + 18, y).lineTo(blockX + blockWidth - 18, y).stroke();

    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(10);
    doc.text(getDoctorDisplayName(doctor), blockX, y + 8, { width: blockWidth, align: 'center' });
}

function drawSection(doc, title, body, y, theme) {
    const bounds = getPageBounds(doc);

    doc.font('Helvetica').fontSize(10);
    const bodyHeight = doc.heightOfString(body, {
        width: bounds.width - 32
    });
    const sectionHeight = Math.max(58, bodyHeight + 30);

    if (y + sectionHeight > bounds.bottom - 60) {
        doc.addPage();
        y = 40;
    }

    doc.roundedRect(bounds.left, y, bounds.width, sectionHeight, 14).fillAndStroke(theme.white, theme.border);

    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11);
    doc.text(title, bounds.left + 16, y + 14, {
        width: bounds.width - 32
    });

    doc.fillColor(theme.text).font('Helvetica').fontSize(10);
    doc.text(body, bounds.left + 16, y + 31, {
        width: bounds.width - 32
    });

    return y + sectionHeight + 14;
}

/**
 * Generate prescription (Ordonnance) PDF
 * @param {Object} data - Prescription data
 * @returns {Promise<string>} Path to generated PDF
 */
async function generatePrescription(data) {
    const { doctor, patient, prescription, date } = data;
    const theme = buildTheme(doctor);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const filename = `ordonnance_${uuidv4()}.pdf`;
            const filepath = path.join(process.cwd(), 'uploads/documents', filename);

            ensureOutputDirectory(filepath);

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            let yPos = drawHeader(doc, doctor, date, theme);
            yPos = drawPatientCard(doc, patient, yPos, theme);
            yPos = drawTitle(doc, 'ORDONNANCE', yPos, theme);
            yPos += 18;

            if (Array.isArray(prescription) && prescription.length > 0) {
                prescription.forEach((medication, index) => {
                    const bounds = getPageBounds(doc);
                    if (yPos + 74 > bounds.bottom - 80) {
                        doc.addPage();
                        yPos = drawContinuationHeader(doc, doctor, 'ORDONNANCE', theme);
                    }

                    yPos = drawMedicationItem(doc, medication, index, yPos, theme);
                });
            } else if (typeof prescription === 'string' && prescription.trim()) {
                yPos = drawSection(doc, 'Traitement', prescription.trim(), yPos, theme);
            } else {
                yPos = drawSection(doc, 'Traitement', 'Aucun traitement renseigne.', yPos, theme);
            }

            const bounds = getPageBounds(doc);
            if (yPos + 70 > bounds.bottom - 20) {
                doc.addPage();
                yPos = bounds.bottom - 110;
            } else {
                yPos = Math.max(yPos + 22, bounds.bottom - 70);
            }

            drawSignature(doc, doctor, yPos, theme);

            doc.end();

            stream.on('finish', () => {
                resolve(filepath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate medical report PDF
 * @param {Object} data - Report data
 * @returns {Promise<string>} Path to generated PDF
 */
async function generateReport(data) {
    const { doctor, patient, caseData, aiAnalysis, date } = data;
    const theme = buildTheme(doctor);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const filename = `rapport_${uuidv4()}.pdf`;
            const filepath = path.join(process.cwd(), 'uploads/documents', filename);

            ensureOutputDirectory(filepath);

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            let yPos = drawHeader(doc, doctor, date, theme);
            yPos = drawPatientCard(doc, patient, yPos, theme);
            yPos = drawTitle(doc, 'RAPPORT MEDICAL', yPos, theme);
            yPos += 18;

            yPos = drawSection(doc, 'Informations du patient', [
                `Nom: ${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim(),
                `Age: ${patient.age || '-'} ans`,
                `Genre: ${formatGenderLabel(patient.gender)}`
            ].join('\n'), yPos, theme);

            if (caseData?.summary) {
                yPos = drawSection(doc, 'Resume de la consultation', caseData.summary, yPos, theme);
            }

            if (aiAnalysis?.summary) {
                yPos = drawSection(doc, 'Analyse', aiAnalysis.summary, yPos, theme);
            }

            if (caseData?.doctorDiagnosis) {
                yPos = drawSection(doc, 'Diagnostic final', caseData.doctorDiagnosis, yPos, theme);
            }

            if (caseData?.doctorPrescription) {
                yPos = drawSection(doc, 'Traitement prescrit', caseData.doctorPrescription, yPos, theme);
            }

            const bounds = getPageBounds(doc);
            if (yPos + 70 > bounds.bottom - 20) {
                doc.addPage();
                yPos = bounds.bottom - 110;
            } else {
                yPos = Math.max(yPos + 22, bounds.bottom - 70);
            }

            drawSignature(doc, doctor, yPos, theme);

            doc.end();

            stream.on('finish', () => {
                resolve(filepath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate analyses (Bilan Biologique) PDF
 * @param {Object} data - Analyses data
 * @returns {Promise<string>} Path to generated PDF
 */
async function generateAnalyses(data) {
    const { doctor, patient, selectedAnalyses, date } = data;
    const theme = buildTheme(doctor);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const filename = `bilan_${uuidv4()}.pdf`;
            const filepath = path.join(process.cwd(), 'uploads/documents', filename);

            ensureOutputDirectory(filepath);

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            let yPos = drawHeader(doc, doctor, date, theme);
            yPos = drawPatientCard(doc, patient, yPos, theme);
            yPos = drawTitle(doc, 'BILAN BIOLOGIQUE', yPos, theme);
            yPos += 12;

            const bounds = getPageBounds(doc);

            if (Array.isArray(selectedAnalyses) && selectedAnalyses.length > 0) {
                // Draw analyses in a simple vertical list
                const itemHeight = 22;
                let rowY = yPos + 8;

                selectedAnalyses.forEach((analysis, index) => {
                    // Page break check
                    if (rowY + itemHeight > bounds.bottom - 80) {
                        doc.addPage();
                        rowY = drawContinuationHeader(doc, doctor, 'BILAN BIOLOGIQUE', theme) + 8;
                    }

                    // Dash
                    doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(12);
                    doc.text('-', bounds.left + 30, rowY, { width: 15 });

                    // Analysis name
                    doc.fillColor(theme.text).font('Helvetica').fontSize(11);
                    doc.text(normalizeText(analysis), bounds.left + 45, rowY, {
                        width: bounds.width - 70,
                        lineBreak: false
                    });

                    rowY += itemHeight;
                });

                yPos = rowY + 16;
            } else {
                yPos = drawSection(doc, 'Analyses', 'Aucune analyse selectionnee.', yPos, theme);
            }

            // Signature
            if (yPos + 70 > bounds.bottom - 20) {
                doc.addPage();
                yPos = bounds.bottom - 110;
            } else {
                yPos = Math.max(yPos + 22, bounds.bottom - 70);
            }

            drawSignature(doc, doctor, yPos, theme);

            doc.end();

            stream.on('finish', () => {
                resolve(filepath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate orientation letter (Lettre d'Orientation) PDF
 * @param {Object} data - Letter data
 * @returns {Promise<string>} Path to generated PDF
 */
async function generateLetter(data) {
    const { doctor, patient, letterContent, date } = data;
    const theme = buildTheme(doctor);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const filename = `lettre_${uuidv4()}.pdf`;
            const filepath = path.join(process.cwd(), 'uploads/documents', filename);

            ensureOutputDirectory(filepath);

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            let yPos = drawHeader(doc, doctor, date, theme);
            yPos = drawPatientCard(doc, patient, yPos, theme);
            yPos = drawTitle(doc, "LETTRE D'ORIENTATION", yPos, theme);
            yPos += 18;

            const bounds = getPageBounds(doc);

            // Draw letter body
            if (letterContent && letterContent.trim()) {
                const bodyWidth = bounds.width - 32;
                const maxBoxHeight = bounds.bottom - yPos - 90; // maximum available space until signature
                
                let fontSize = 12;
                let lineGap = 6;
                doc.font('Helvetica').fontSize(fontSize);
                
                let textHeight = doc.heightOfString(letterContent.trim(), { width: bodyWidth, lineGap: lineGap });
                
                // Auto-scale font down to ensure fit on one page
                while (textHeight + 40 > maxBoxHeight && fontSize > 6) {
                    fontSize -= 0.5;
                    lineGap = Math.max(2, fontSize * 0.4); // reduce line gap slightly along with font size
                    doc.font('Helvetica').fontSize(fontSize);
                    textHeight = doc.heightOfString(letterContent.trim(), { width: bodyWidth, lineGap: lineGap });
                }

                // If content is extremely long, box height is capped to maxBoxHeight
                const boxHeight = Math.min(Math.max(100, textHeight + 40), maxBoxHeight);

                // Letter body card
                doc.roundedRect(bounds.left, yPos, bounds.width, boxHeight, 14)
                    .fillAndStroke(theme.white, theme.border);

                doc.fillColor(theme.text).font('Helvetica').fontSize(fontSize);
                doc.text(letterContent.trim(), bounds.left + 16, yPos + 20, {
                    width: bodyWidth,
                    height: boxHeight - 40,
                    lineGap: lineGap,
                    align: 'left',
                    ellipsis: true // truncate if it's impossibly long even at size 6
                });

                yPos += boxHeight + 14;
            } else {
                yPos = drawSection(doc, 'Contenu', 'Aucun contenu renseigne.', yPos, theme);
            }

            // Signature
            if (yPos + 70 > bounds.bottom - 20) {
                doc.addPage();
                yPos = bounds.bottom - 110;
            } else {
                yPos = Math.max(yPos + 22, bounds.bottom - 70);
            }

            drawSignature(doc, doctor, yPos, theme);

            doc.end();

            stream.on('finish', () => {
                resolve(filepath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generatePrescription,
    generateReport,
    generateAnalyses,
    generateLetter
};
