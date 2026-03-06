/**
 * Audit Logger Middleware
 * Logs all significant actions for accountability and debugging.
 */

const db = require('../config/database');

/**
 * Log an audit event to the database
 * @param {Object} auditData - Audit information
 */
async function logAudit(auditData) {
    try {
        const sql = `
            INSERT INTO audit_log (
                user_id, username, action, entity_type, entity_id,
                old_values, new_values, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.query(sql, [
            auditData.user_id || null,
            auditData.username || 'system',
            auditData.action,
            auditData.entity_type || null,
            auditData.entity_id || null,
            auditData.old_values ? JSON.stringify(auditData.old_values) : null,
            auditData.new_values ? JSON.stringify(auditData.new_values) : null,
            auditData.ip_address || null,
            auditData.user_agent || null
        ]);
    } catch (error) {
        console.error('[AUDIT] Failed to log audit event:', error.message);
        // Don't throw - audit failures shouldn't break the request
    }
}

/**
 * Create audit logger middleware
 * Attaches audit function to request object
 */
function auditMiddleware(req, res, next) {
    // Helper function to log audit events
    req.audit = async (action, entityType = null, entityId = null, oldValues = null, newValues = null) => {
        await logAudit({
            user_id: req.session?.user?.id,
            username: req.session?.user?.username,
            action,
            entity_type: entityType,
            entity_id: entityId,
            old_values: oldValues,
            new_values: newValues,
            ip_address: req.ip || req.connection?.remoteAddress,
            user_agent: req.get('User-Agent')
        });
    };
    
    next();
}

/**
 * Log authentication events
 */
async function logAuthEvent(action, userId, username, ipAddress, userAgent, success = true) {
    await logAudit({
        user_id: userId,
        username: username,
        action: success ? action : `${action}_FAILED`,
        entity_type: 'user',
        entity_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent
    });
}

/**
 * Log scan event
 */
async function logScanEvent(scanData, userId, username, ipAddress) {
    await logAudit({
        user_id: userId,
        username: username,
        action: 'SCAN_PROCESSED',
        entity_type: 'entry_exit_log',
        entity_id: scanData.logId,
        new_values: {
            roll_number: scanData.roll_number,
            event_type: scanData.event_type,
            is_allowed: scanData.is_allowed
        },
        ip_address: ipAddress
    });
}

/**
 * Log alert creation
 */
async function logAlertCreated(alertData) {
    await logAudit({
        action: 'ALERT_CREATED',
        entity_type: 'alert',
        entity_id: alertData.id,
        new_values: {
            type: alertData.alert_type,
            target_role: alertData.target_role,
            student_id: alertData.student_id
        }
    });
}

/**
 * Log data modification
 */
async function logDataModification(userId, username, action, entityType, entityId, oldValues, newValues, ipAddress) {
    await logAudit({
        user_id: userId,
        username: username,
        action: action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: ipAddress
    });
}

/**
 * Get audit log entries
 * @param {Object} filters - Filter options
 * @returns {Array} Audit log entries
 */
async function getAuditLog(filters = {}) {
    let sql = `
        SELECT * FROM audit_log WHERE 1=1
    `;
    const params = [];

    if (filters.userId) {
        sql += ' AND user_id = ?';
        params.push(filters.userId);
    }
    if (filters.action) {
        sql += ' AND action LIKE ?';
        params.push(`%${filters.action}%`);
    }
    if (filters.entityType) {
        sql += ' AND entity_type = ?';
        params.push(filters.entityType);
    }
    if (filters.startDate) {
        sql += ' AND created_at >= ?';
        params.push(filters.startDate);
    }
    if (filters.endDate) {
        sql += ' AND created_at <= ?';
        params.push(filters.endDate);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(filters.limit));
    } else {
        sql += ' LIMIT 1000';
    }

    return await db.query(sql, params);
}

module.exports = {
    logAudit,
    auditMiddleware,
    logAuthEvent,
    logScanEvent,
    logAlertCreated,
    logDataModification,
    getAuditLog
};
