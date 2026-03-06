/**
 * Report Routes
 * API endpoints for generating reports.
 */

const express = require('express');
const router = express.Router();
const { reportsController } = require('../controllers');
const { 
    requireAdministrative,
    validateDepartmentAccess,
    asyncHandler 
} = require('../middleware');

// All report routes require administrative access
router.use(requireAdministrative);

// ==========================================
// SUMMARY REPORTS
// ==========================================

/**
 * GET /api/reports/daily
 * Get daily summary report
 * 
 * Query params:
 * - date: Date in YYYY-MM-DD format (default: today)
 */
router.get('/api/reports/daily', 
    validateDepartmentAccess,
    asyncHandler(reportsController.getDailySummary)
);

/**
 * GET /api/reports/attendance
 * Get attendance report for date range
 * 
 * Query params:
 * - startDate: Start date
 * - endDate: End date
 * - departmentId: Filter by department (optional)
 */
router.get('/api/reports/attendance', 
    validateDepartmentAccess,
    asyncHandler(reportsController.getAttendanceReport)
);

// ==========================================
// INCIDENT REPORTS
// ==========================================

/**
 * GET /api/reports/roaming
 * Get roaming incidents report
 * 
 * Query params:
 * - startDate: Start date
 * - endDate: End date
 */
router.get('/api/reports/roaming', 
    validateDepartmentAccess,
    asyncHandler(reportsController.getRoamingReport)
);

/**
 * GET /api/reports/permissions
 * Get permission letters report
 * 
 * Query params:
 * - startDate: Start date
 * - endDate: End date
 */
router.get('/api/reports/permissions', 
    validateDepartmentAccess,
    asyncHandler(reportsController.getPermissionReport)
);

// ==========================================
// EXPORT ROUTES
// ==========================================

/**
 * GET /api/reports/export
 * Export report as CSV
 * 
 * Query params:
 * - type: Report type (attendance, roaming, daily)
 * - startDate: Start date
 * - endDate: End date
 * - format: Export format (csv)
 */
router.get('/api/reports/export', 
    asyncHandler(reportsController.exportReport)
);

module.exports = router;
