/**
 * Middleware Index
 * Central export for all middleware modules.
 */

const auth = require('./auth');
const timeValidation = require('./timeValidation');
const auditLogger = require('./auditLogger');
const errorHandler = require('./errorHandler');

module.exports = {
    // Authentication middleware
    ...auth,
    
    // Time validation middleware
    ...timeValidation,
    
    // Audit logging
    ...auditLogger,
    
    // Error handling
    ...errorHandler
};
