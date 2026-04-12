/**
 * File Upload Middleware
 * Handles file uploads using Multer with custom configuration
 */

const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

// ======================
// STORAGE CONFIGURATION
// ======================

// Configure storage for medical documents
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/documents'));
    },
    filename: (req, file, cb) => {
        // Generate unique filename with original extension
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// Configure storage for audio recordings
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/audio'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// Configure storage for doctor logos
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/logos');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// ======================
// FILE FILTERS
// ======================

// Filter for document uploads (medical files only)
const documentFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExtensions = /\.(jpg|jpeg|png|webp|gif|pdf|doc|docx)$/i;

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non autorisé. Formats acceptés: JPG, PNG, WebP, GIF, PDF, DOC, DOCX'), false);
    }
};

// Filter for audio uploads
const audioFilter = (req, file, cb) => {
    const allowedTypes = [
        'audio/webm',
        'audio/mp3',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only audio files are allowed.'), false);
    }
};

// Filter for clinic logo uploads
const logoFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = /\.(jpg|jpeg|png|webp)$/i;

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
        cb(null, true);
    } else {
        cb(new Error('Type de logo non autorise. Formats acceptes: JPG, PNG, WebP'), false);
    }
};

// ======================
// MULTER INSTANCES
// ======================

// Upload handler for medical documents
const uploadDocument = multer({
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: {
        fileSize: config.upload.maxFileSize // 10MB default
    }
});

// Upload handler for audio recordings
const uploadAudio = multer({
    storage: audioStorage,
    fileFilter: audioFilter,
    limits: {
        fileSize: config.upload.maxFileSize
    }
});

// Upload handler for doctor logos
const uploadLogo = multer({
    storage: logoStorage,
    fileFilter: logoFilter,
    limits: {
        fileSize: config.upload.maxFileSize
    }
});

// ======================
// ERROR HANDLER
// ======================

/**
 * Middleware to handle Multer errors
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next function
 */
function handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds the limit.'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    next();
}

module.exports = {
    uploadDocument,
    uploadAudio,
    uploadLogo,
    handleUploadError
};
