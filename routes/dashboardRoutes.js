/**
 * Dashboard Routes
 * Routes for all dashboard pages and related API endpoints.
 */

const express = require('express');
const router = express.Router();
const { dashboardController } = require('../controllers');
const { 
    isAuthenticated, 
    requireSecurity,
    requireAdmin,
    requireHOD,
    requireWarden,
    requirePrincipal,
    requireAdministrative,
    blockSecurity,
    validateDepartmentAccess,
    validateHostelAccess,
    asyncHandler 
} = require('../middleware');

// ==========================================
// SECURITY SCAN PAGE
// ==========================================

/**
 * GET /scan
 * Security scan page - camera opens here
 * Only accessible by security role
 */
router.get('/scan', requireSecurity, asyncHandler(dashboardController.showSecurityScanPage));

// ==========================================
// DASHBOARD PAGES (Role-specific)
// ==========================================

/**
 * GET /dashboard
 * Redirect to role-specific dashboard
 */
router.get('/dashboard', isAuthenticated, (req, res) => {
    const role = req.session.user.role;
    switch (role) {
        case 'security':
            return res.redirect('/scan');
        case 'admin':
            return res.redirect('/dashboard/admin');
        case 'hod':
            return res.redirect('/dashboard/hod');
        case 'warden':
            return res.redirect('/dashboard/warden');
        case 'principal':
            return res.redirect('/dashboard/principal');
        default:
            return res.redirect('/login');
    }
});

/**
 * GET /dashboard/admin
 * Admin dashboard - full access to all data
 */
router.get('/dashboard/admin', requireAdmin, asyncHandler(dashboardController.showAdminDashboard));

/**
 * GET /dashboard/hod
 * HOD dashboard - department-specific data
 */
router.get('/dashboard/hod', requireHOD, asyncHandler(dashboardController.showHODDashboard));

/**
 * GET /dashboard/warden
 * Warden dashboard - hostel-specific data
 */
router.get('/dashboard/warden', requireWarden, asyncHandler(dashboardController.showWardenDashboard));

/**
 * GET /dashboard/principal
 * Principal dashboard - full access with escalations
 */
router.get('/dashboard/principal', requirePrincipal, asyncHandler(dashboardController.showPrincipalDashboard));

// ==========================================
// LIVE FEED API
// ==========================================

/**
 * GET /api/dashboard/live
 * Get live feed data for AJAX polling
 * 
 * Query params:
 * - limit: Number of records (default 20)
 * - since: ISO timestamp to get only newer records
 */
router.get('/api/dashboard/live', 
    isAuthenticated, 
    blockSecurity, 
    asyncHandler(dashboardController.getLiveFeed)
);

// ==========================================
// ALERT MANAGEMENT
// ==========================================

/**
 * POST /api/alerts/:id/read
 * Mark an alert as read
 */
router.post('/api/alerts/:id/read', 
    requireAdministrative, 
    asyncHandler(dashboardController.markAlertRead)
);

/**
 * POST /api/alerts/:id/action
 * Mark an alert as actioned
 * 
 * Body: { action: string } - Description of action taken
 */
router.post('/api/alerts/:id/action', 
    requireAdministrative, 
    asyncHandler(dashboardController.markAlertActioned)
);

// ==========================================
// ROAMING INCIDENT MANAGEMENT
// ==========================================

/**
 * POST /api/roaming/:id/resolve
 * Resolve a roaming incident
 * 
 * Body: { notes: string } - Resolution notes
 */
router.post('/api/roaming/:id/resolve', 
    requireAdministrative,
    validateDepartmentAccess,
    asyncHandler(dashboardController.resolveRoamingIncident)
);

// ==========================================
// PERMISSION LETTER MANAGEMENT
// ==========================================

/**
 * POST /api/permissions/:id/verify
 * Verify a permission letter
 */
router.post('/api/permissions/:id/verify', 
    requireAdministrative,
    asyncHandler(dashboardController.verifyPermission)
);

/**
 * POST /api/permissions/:id/invalidate
 * Invalidate a permission letter
 * 
 * Body: { reason: string }
 */
router.post('/api/permissions/:id/invalidate', 
    requireAdministrative,
    asyncHandler(dashboardController.invalidatePermission)
);

// ==========================================
// USER MANAGEMENT API
// ==========================================

/**
 * GET /api/users
 * Get all system users (admin only)
 */
router.get('/api/users', 
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { User } = require('../models');
        const users = await User.findAll();
        res.json({ success: true, users });
    })
);

module.exports = router;
