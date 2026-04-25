/**
 * Doctor Routes
 * Handles doctor dashboard and profile endpoints
 */

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly } = require('../middleware/roleMiddleware');
const { uploadLogo, uploadCurve, handleUploadError } = require('../middleware/uploadMiddleware');

// All routes require authentication and doctor role
router.use(authenticate);
router.use(doctorOnly);

// Dashboard
router.get('/dashboard', doctorController.getDashboard);

// Profile
router.get('/profile', doctorController.getProfile);
router.put('/profile', doctorController.updateProfile);

// Prescription PDF customization
router.get('/prescription-config', doctorController.getPrescriptionConfig);
router.put(
    '/prescription-config',
    uploadLogo.single('logo'),
    handleUploadError,
    doctorController.updatePrescriptionConfig
);

// AI Configuration
router.get('/ai-config', doctorController.getAiConfig);
router.put('/ai-config', doctorController.updateAiConfig);
router.put('/ai-config/activate', doctorController.activateAiConfig);
router.get('/ai-config/status', doctorController.getAiStatus);

// Analyses PDF customization
router.get('/analyses-config', doctorController.getAnalysesConfig);
router.put('/analyses-config', doctorController.updateAnalysesConfig);

// Letter PDF customization
router.get('/letter-config', doctorController.getLetterConfig);
router.put('/letter-config', doctorController.updateLetterConfig);

// Growth Curves
router.get('/growth-curves', doctorController.getGrowthCurves);
router.post(
    '/growth-curves',
    uploadCurve.single('curve'),
    handleUploadError,
    doctorController.uploadGrowthCurve
);
router.patch('/growth-curves/:id/calibrate', doctorController.calibrateGrowthCurve);
router.delete('/growth-curves/:id', doctorController.deleteGrowthCurve);

// Medications CSV
const multer = require('multer');
const uploadCSV = multer({ dest: require('path').join(__dirname, '../../uploads/temp') });
router.get('/medications', doctorController.getMedications);
router.get('/medications/search', doctorController.searchMedications);
router.post('/medications/csv', uploadCSV.single('csv'), doctorController.uploadMedicationCSV);
router.delete('/medications', doctorController.deleteMedications);

module.exports = router;
