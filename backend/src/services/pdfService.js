/**
 * PDF Service
 * Generate medical documents (Ordonnance, Rapport)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate prescription (Ordonnance) PDF
 * @param {Object} data - Prescription data
 * @returns {Promise<string>} Path to generated PDF
 */
async function generatePrescription(data) {
    const { doctor, patient, prescription, diagnosis, date } = data;

    return new Promise((resolve, reject) => {
        try {
            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Generate unique filename
            const filename = `ordonnance_${uuidv4()}.pdf`;
            const filepath = path.join(process.cwd(), 'uploads/documents', filename);

            // Pipe to file
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // ======================
            // HEADER
            // ======================

            // Left Side: Doctor Info
            doc.font('Helvetica-Bold').fontSize(16);
            doc.text(`Dr ${doctor.firstName} ${doctor.lastName}`, 50, 50);

            doc.font('Helvetica').fontSize(10);
            doc.text(doctor.specialty || 'Médecine Générale', 50, 75);
            doc.text(`Mobile: ${doctor.phone || ''}`);
            doc.text(`Email: ${doctor.email || ''}`);
            doc.text(`Address: ${doctor.address || ''}`);

            // Right Side: Date
            const formattedDate = new Date(date || Date.now()).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });

            doc.font('Helvetica').fontSize(11);
            doc.text(`le ${formattedDate}`, 400, 75);


            // ======================
            // SEPARATOR & PATIENT
            // ======================
            doc.moveDown(2);
            doc.lineWidth(2).moveTo(50, 140).lineTo(545, 140).stroke();

            doc.font('Helvetica-Bold').fontSize(11);
            doc.text('Nom:', 50, 155);
            doc.font('Helvetica').text(patient.lastName.toUpperCase(), 85, 155);

            doc.font('Helvetica-Bold').text('Prénom:', 250, 155);
            doc.font('Helvetica').text(patient.firstName.toUpperCase(), 300, 155);

            doc.font('Helvetica-Bold').text('Age:', 450, 155);
            doc.font('Helvetica').text(`${patient.age} ans`, 480, 155);

            // ======================
            // TITLE
            // ======================
            doc.moveDown(4);
            doc.font('Helvetica-Bold').fontSize(22);
            // Centered title, ensure enough width to avoid wrapping
            doc.text('ORDONNANCE', 50, 220, { align: 'center', width: 500, underline: true });
            doc.moveDown(2);

            // ======================
            // MEDICATION List
            // ======================
            doc.fontSize(11);
            let yPos = 280;

            if (Array.isArray(prescription)) {
                prescription.forEach(med => {
                    // Bullet
                    doc.font('Helvetica-Bold').text('-', 50, yPos);

                    // Med Name & Form
                    doc.font('Helvetica-Bold').text(`${med.name || ''}`, 65, yPos);

                    // Quantity (Right aligned in parenthesis)
                    if (med.quantity) {
                        doc.font('Helvetica').text(`(${med.quantity})`, 450, yPos, { align: 'right' });
                    }

                    yPos += 15;

                    // Dosage / Frequency / Duration
                    const details = [med.dosage, med.frequency, med.duration].filter(Boolean).join(' - ');
                    doc.font('Helvetica-Oblique').text(details, 80, yPos);

                    yPos += 25; // Space between items
                });
            } else if (typeof prescription === 'string') {
                // Fallback for string keys
                doc.font('Helvetica').text(prescription, 65, yPos);
            }

            // ======================
            // FOOTER SIGNATURE
            // ======================
            const signatureY = 700;
            doc.font('Helvetica-Oblique').fontSize(10);
            doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, 350, signatureY, {
                align: 'center',
                underline: true
            });

            // Finalize PDF
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

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const filename = `rapport_${uuidv4()}.pdf`;
            const filepath = path.join(process.cwd(), 'uploads/documents', filename);

            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // Header
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`);
            doc.fontSize(11).font('Helvetica');
            doc.text(doctor.specialty || 'Médecin');

            doc.moveDown(2);

            // Title
            doc.fontSize(18).font('Helvetica-Bold');
            doc.text('RAPPORT MÉDICAL', { align: 'center' });
            doc.moveDown();

            // Date
            const formattedDate = new Date(date || Date.now()).toLocaleDateString('fr-FR');
            doc.fontSize(11).font('Helvetica');
            doc.text(`Date: ${formattedDate}`, { align: 'right' });
            doc.moveDown(2);

            // Patient Info
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text('Informations du patient');
            doc.fontSize(11).font('Helvetica');
            doc.text(`Nom: ${patient.firstName} ${patient.lastName}`);
            doc.text(`Âge: ${patient.age} ans`);
            doc.text(`Genre: ${patient.gender}`);
            doc.moveDown();

            // Case Summary
            if (caseData) {
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Résumé de la consultation');
                doc.fontSize(11).font('Helvetica');
                doc.text(caseData.summary || 'Non disponible');
                doc.moveDown();
            }

            // AI Analysis
            if (aiAnalysis) {
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Analyse');
                doc.fontSize(11).font('Helvetica');
                doc.text(aiAnalysis.summary || 'Non disponible');
                doc.moveDown();
            }

            // Diagnosis
            if (caseData?.doctorDiagnosis) {
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Diagnostic final');
                doc.fontSize(11).font('Helvetica');
                doc.text(caseData.doctorDiagnosis);
                doc.moveDown();
            }

            // Treatment
            if (caseData?.doctorPrescription) {
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Traitement prescrit');
                doc.fontSize(11).font('Helvetica');
                doc.text(caseData.doctorPrescription);
            }

            doc.moveDown(3);

            // Signature
            doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, { align: 'right' });

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
    generateReport
};
