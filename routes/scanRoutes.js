/**
 * Scan Routes
 * API endpoints for barcode scanning operations.
 * These are the most critical routes - security uses them constantly.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { scanController } = require('../controllers');
const { canScan, isAuthenticated, asyncHandler } = require('../middleware');
const config = require('../config/app.config');

// ==========================================
// FILE UPLOAD CONFIGURATION
// For permission letter photos
// ==========================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.upload.permissionLetterPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `permission-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.upload.maxFileSize
    }
});

// ==========================================
// SCAN API ROUTES
// ==========================================

/**
 * POST /api/scan
 * Process a barcode scan
 * 
 * Request body: { roll_number: string }
 * Response: Scan result with student info and validation status
 * 
 * CRITICAL: This endpoint must be fast (~200ms target)
 * - No submit button on frontend
 * - Auto-triggered by barcode detection
 * - Auto-processed with no confirmation
 */
router.post('/api/scan', canScan, asyncHandler(scanController.processScan));

/**
 * POST /api/scan/permission
 * Upload permission letter photo
 * 
 * Request: multipart/form-data with photo file and roll_number
 * 
 * Used when security photographs a permission letter
 * before allowing mid-day exit
 */
router.post('/api/scan/permission', 
    canScan, 
    upload.single('photo'), 
    asyncHandler(scanController.uploadPermissionLetter)
);

/**
 * GET /api/scan/recent
 * Get recent scan activity for live feed
 * 
 * Query params: limit (optional, default 20)
 */
router.get('/api/scan/recent', isAuthenticated, asyncHandler(scanController.getRecentScans));

/**
 * GET /api/scan/stats
 * Get dashboard statistics
 * 
 * Returns counts for entries, exits, roaming, etc.
 */
router.get('/api/scan/stats', isAuthenticated, asyncHandler(scanController.getDashboardStats));

module.exports = router;
