/**
 * Authentication Middleware
 * Handles session-based authentication and role verification.
 * Protects routes based on user authentication status and roles.
 */

const config = require('../config/app.config');

/**
 * Check if user is authenticated
 * Redirects to login if not authenticated
 */
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    
    // For API routes, return JSON error
    if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHENTICATED'
        });
    }
    
    // For page routes, redirect to login
    return res.redirect('/login');
}

/**
 * Check if user has one of the allowed roles
 * @param {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Middleware function
 */
function hasRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHENTICATED'
                });
            }
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;
        
        if (allowedRoles.includes(userRole)) {
            return next();
        }

        // Role not allowed
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                requiredRoles: allowedRoles,
                userRole: userRole
            });
        }

        return res.status(403).render('error', {
            message: 'Access Denied',
            description: 'You do not have permission to access this page.'
        });
    };
}

/**
 * Require security role
 * Only security personnel can access
 */
const requireSecurity = hasRole(config.roles.SECURITY);

/**
 * Require admin role
 * Only administrators can access
 */
const requireAdmin = hasRole(config.roles.ADMIN);

/**
 * Require HOD role
 * Only HODs can access
 */
const requireHOD = hasRole(config.roles.HOD);

/**
 * Require warden role
 * Only hostel wardens can access
 */
const requireWarden = hasRole(config.roles.WARDEN);

/**
 * Require principal role
 * Only principal/management can access
 */
const requirePrincipal = hasRole(config.roles.PRINCIPAL);

/**
 * Require any administrative role (not security)
 * Admins, HODs, Wardens, and Principal can access
 */
const requireAdministrative = hasRole(
    config.roles.ADMIN,
    config.roles.HOD,
    config.roles.WARDEN,
    config.roles.PRINCIPAL
);

/**
 * Require scan permission
 * Only security can perform scans
 */
const canScan = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required for scanning',
            code: 'UNAUTHENTICATED'
        });
    }

    if (req.session.user.role !== config.roles.SECURITY) {
        return res.status(403).json({
            success: false,
            error: 'Only security personnel can perform scans',
            code: 'FORBIDDEN'
        });
    }

    next();
};

/**
 * Attach user to request from session
 * Makes req.user available in all routes
 */
const attachUser = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        res.locals.user = req.session.user;
    }
    next();
};

/**
 * Block security from accessing dashboards
 * Security can only access scan page
 */
const blockSecurity = (req, res, next) => {
    if (req.session && req.session.user) {
        if (req.session.user.role === config.roles.SECURITY) {
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(403).json({
                    success: false,
                    error: 'Security personnel cannot access this resource',
                    code: 'FORBIDDEN'
                });
            }
            return res.redirect('/scan');
        }
    }
    next();
};

/**
 * Validate that HOD can only access their department data
 */
const validateDepartmentAccess = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHENTICATED'
        });
    }

    const user = req.session.user;

    // Principal and Admin can access all departments
    if (user.role === config.roles.PRINCIPAL || user.role === config.roles.ADMIN) {
        return next();
    }

    // HOD can only access their own department
    if (user.role === config.roles.HOD) {
        const requestedDeptId = parseInt(req.params.departmentId || req.query.departmentId || req.body.departmentId);
        
        if (requestedDeptId && requestedDeptId !== user.department_id) {
            return res.status(403).json({
                success: false,
                error: 'You can only access your own department data',
                code: 'FORBIDDEN'
            });
        }
        
        // Force filter to own department
        req.query.departmentId = user.department_id;
        req.departmentFilter = user.department_id;
    }

    next();
};

/**
 * Validate that Warden can only access their hostel data
 */
const validateHostelAccess = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHENTICATED'
        });
    }

    const user = req.session.user;

    // Principal and Admin can access all hostels
    if (user.role === config.roles.PRINCIPAL || user.role === config.roles.ADMIN) {
        return next();
    }

    // Warden can only access their own hostel
    if (user.role === config.roles.WARDEN) {
        const requestedHostelId = parseInt(req.params.hostelId || req.query.hostelId || req.body.hostelId);
        
        if (requestedHostelId && requestedHostelId !== user.hostel_id) {
            return res.status(403).json({
                success: false,
                error: 'You can only access your own hostel data',
                code: 'FORBIDDEN'
            });
        }
        
        // Force filter to own hostel
        req.query.hostelId = user.hostel_id;
        req.hostelFilter = user.hostel_id;
    }

    next();
};

module.exports = {
    isAuthenticated,
    hasRole,
    requireSecurity,
    requireAdmin,
    requireHOD,
    requireWarden,
    requirePrincipal,
    requireAdministrative,
    canScan,
    attachUser,
    blockSecurity,
    validateDepartmentAccess,
    validateHostelAccess
};
