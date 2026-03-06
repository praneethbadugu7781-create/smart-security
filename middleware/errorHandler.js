/**
 * Error Handler Middleware
 * Centralized error handling for the application.
 */

/**
 * 404 Not Found handler
 * Catches unmatched routes
 */
function notFoundHandler(req, res, next) {
    if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Resource not found',
            path: req.path
        });
    }
    
    res.status(404).render('error', {
        title: 'Page Not Found',
        statusCode: 404,
        message: '404 - Page Not Found',
        description: 'The page you are looking for does not exist.'
    });
}

/**
 * Global error handler
 * Handles all uncaught errors
 */
function errorHandler(err, req, res, next) {
    // Log error for debugging
    console.error('[ERROR]', new Date().toISOString());
    console.error('[ERROR] Path:', req.method, req.path);
    console.error('[ERROR] Message:', err.message);
    if (process.env.NODE_ENV !== 'production') {
        console.error('[ERROR] Stack:', err.stack);
    }

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Handle specific error types
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            success: false,
            error: 'Invalid CSRF token',
            code: 'CSRF_ERROR'
        });
    }

    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry',
            code: 'DUPLICATE_ENTRY'
        });
    }

    if (err.code === 'ER_NO_REFERENCED_ROW') {
        return res.status(400).json({
            success: false,
            error: 'Referenced record not found',
            code: 'INVALID_REFERENCE'
        });
    }

    // JSON response for API routes
    if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(statusCode).json({
            success: false,
            error: process.env.NODE_ENV === 'production' 
                ? 'An error occurred' 
                : err.message,
            code: err.code || 'INTERNAL_ERROR'
        });
    }

    // HTML response for page routes
    res.status(statusCode).render('error', {
        title: 'Error',
        statusCode: statusCode,
        message: statusCode === 500 ? 'Internal Server Error' : err.message,
        description: process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again later.'
            : err.message
    });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Create a custom error with status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Error} Custom error
 */
function createError(message, statusCode = 500) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

/**
 * Validation error helper
 * @param {string} message - Validation message
 * @returns {Error} Validation error
 */
function validationError(message) {
    return createError(message, 400);
}

/**
 * Not found error helper
 * @param {string} resource - Resource name
 * @returns {Error} Not found error
 */
function notFoundError(resource = 'Resource') {
    return createError(`${resource} not found`, 404);
}

/**
 * Unauthorized error helper
 * @param {string} message - Error message
 * @returns {Error} Unauthorized error
 */
function unauthorizedError(message = 'Unauthorized') {
    return createError(message, 401);
}

/**
 * Forbidden error helper
 * @param {string} message - Error message
 * @returns {Error} Forbidden error
 */
function forbiddenError(message = 'Access denied') {
    return createError(message, 403);
}

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler,
    createError,
    validationError,
    notFoundError,
    unauthorizedError,
    forbiddenError
};
