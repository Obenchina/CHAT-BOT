/**
 * Email Service
 * Handles sending OTP verification emails via Gmail SMTP
 */

const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.email.smtpEmail,
        pass: config.email.smtpPassword
    }
});

/**
 * Send verification OTP code to email
 * @param {string} toEmail - Recipient email
 * @param {string} code - 6-digit OTP code
 * @returns {Promise<boolean>} Success status
 */
async function sendVerificationCode(toEmail, code) {
    try {
        const mailOptions = {
            from: `"MediConsult" <${config.email.smtpEmail}>`,
            to: toEmail,
            subject: 'Code de vérification - MediConsult',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%); padding: 32px 24px; text-align: center;">
                        <div style="font-size: 36px; margin-bottom: 8px;">🏥</div>
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">MediConsult</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 14px;">Plateforme de Consultation Médicale</p>
                    </div>
                    
                    <!-- Body -->
                    <div style="padding: 32px 24px;">
                        <h2 style="color: #1E293B; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">Vérification de votre email</h2>
                        <p style="color: #64748B; margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;">
                            Bienvenue sur MediConsult ! Pour finaliser la création de votre compte, veuillez entrer le code de vérification ci-dessous :
                        </p>
                        
                        <!-- OTP Code -->
                        <div style="background: #F1F5F9; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                            <div style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #2563EB; font-family: 'Courier New', monospace;">
                                ${code}
                            </div>
                        </div>
                        
                        <p style="color: #94A3B8; margin: 0; font-size: 13px; line-height: 1.5;">
                            ⏱ Ce code expire dans <strong>10 minutes</strong>.<br>
                            Si vous n'avez pas demandé ce code, ignorez cet email.
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #F8FAFC; padding: 16px 24px; text-align: center; border-top: 1px solid #E2E8F0;">
                        <p style="color: #94A3B8; margin: 0; font-size: 12px;">
                            © ${new Date().getFullYear()} MediConsult — Tous droits réservés
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Email send error:', error.message);
        return false;
    }
}

module.exports = {
    sendVerificationCode
};
