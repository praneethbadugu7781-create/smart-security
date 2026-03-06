/**
 * EntryExitLog Model
 * Handles all gate entry/exit scan records.
 * Core table for tracking student movement.
 */

const db = require('../config/database');

class EntryExitLog {
    /**
     * Create a new entry/exit log record
     * Called after every successful scan
     * @param {Object} logData - Log information
     * @returns {Object} Created log with ID
     */
    static async create(logData) {
        const sql = `
            INSERT INTO entry_exit_logs (
                student_id, roll_number, event_type, event_timestamp,
                gate_location, is_allowed, requires_permission, has_permission,
                permission_letter_id, student_type, is_during_class_hours,
                is_late_entry, is_late_return, alert_sent, alert_sent_to,
                scanned_by_user_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            logData.student_id,
            logData.roll_number,
            logData.event_type,
            logData.event_timestamp || new Date(),
            logData.gate_location || 'main_gate',
            logData.is_allowed,
            logData.requires_permission || false,
            logData.has_permission || false,
            logData.permission_letter_id || null,
            logData.student_type,
            logData.is_during_class_hours || false,
            logData.is_late_entry || false,
            logData.is_late_return || false,
            logData.alert_sent || false,
            logData.alert_sent_to || null,
            logData.scanned_by_user_id,
            logData.notes || null
        ];
        
        const result = await db.query(sql, params);
        return { id: result.insertId, ...logData };
    }

    /**
     * Check for duplicate scan within interval
     * Prevents rapid duplicate scans of same student
     * @param {string} rollNumber - Student roll number
     * @param {number} intervalMs - Minimum milliseconds between scans
     * @returns {Object|null} Last scan if within interval
     */
    static async checkDuplicateScan(rollNumber, intervalMs = 30000) {
        const sql = `
            SELECT * FROM entry_exit_logs
            WHERE roll_number = ?
            AND event_timestamp > DATE_SUB(NOW(), INTERVAL ? SECOND)
            ORDER BY event_timestamp DESC
            LIMIT 1
        `;
        const intervalSeconds = Math.ceil(intervalMs / 1000);
        const results = await db.query(sql, [rollNumber, intervalSeconds]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get last scan for a student
     * Used to determine if next scan should be entry or exit
     * @param {string} rollNumber - Student roll number
     * @returns {Object|null} Last scan record
     */
    static async getLastScan(rollNumber) {
        const sql = `
            SELECT * FROM entry_exit_logs
            WHERE roll_number = ?
            ORDER BY event_timestamp DESC
            LIMIT 1
        `;
        const results = await db.query(sql, [rollNumber]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get today's logs with optional filters
     * @param {Object} filters - Filter options
     * @returns {Array} List of logs
     */
    static async getTodayLogs(filters = {}) {
        let sql = `
            SELECT 
                eel.*,
                s.full_name,
                d.name AS department_name
            FROM entry_exit_logs eel
            JOIN students s ON eel.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE DATE(eel.event_timestamp) = CURDATE()
        `;
        const params = [];

        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.hostelId) {
            sql += ' AND s.hostel_id = ?';
            params.push(filters.hostelId);
        }
        if (filters.eventType) {
            sql += ' AND eel.event_type = ?';
            params.push(filters.eventType);
        }
        if (filters.studentType) {
            sql += ' AND eel.student_type = ?';
            params.push(filters.studentType);
        }
        if (filters.requiresPermission !== undefined) {
            sql += ' AND eel.requires_permission = ?';
            params.push(filters.requiresPermission);
        }
        if (filters.alertPending) {
            sql += ' AND eel.alert_sent = 1 AND eel.alert_acknowledged = 0';
        }

        sql += ' ORDER BY eel.event_timestamp DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }

        return await db.query(sql, params);
    }

    /**
     * Get logs for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} filters - Additional filters
     * @returns {Array} List of logs
     */
    static async getLogsByDateRange(startDate, endDate, filters = {}) {
        let sql = `
            SELECT 
                eel.*,
                s.full_name,
                s.student_type,
                d.name AS department_name
            FROM entry_exit_logs eel
            JOIN students s ON eel.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE eel.event_timestamp BETWEEN ? AND ?
        `;
        const params = [startDate, endDate];

        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.studentId) {
            sql += ' AND eel.student_id = ?';
            params.push(filters.studentId);
        }

        sql += ' ORDER BY eel.event_timestamp DESC';

        return await db.query(sql, params);
    }

    /**
     * Get student's logs for today
     * @param {string} rollNumber - Student roll number
     * @returns {Array} Today's logs for student
     */
    static async getStudentTodayLogs(rollNumber) {
        const sql = `
            SELECT * FROM entry_exit_logs
            WHERE roll_number = ?
            AND DATE(event_timestamp) = CURDATE()
            ORDER BY event_timestamp ASC
        `;
        return await db.query(sql, [rollNumber]);
    }

    /**
     * Acknowledge an alert
     * @param {number} logId - Log ID
     * @param {number} userId - User acknowledging
     * @returns {boolean} Success status
     */
    static async acknowledgeAlert(logId, userId) {
        const sql = `
            UPDATE entry_exit_logs 
            SET alert_acknowledged = 1,
                alert_acknowledged_by = ?,
                alert_acknowledged_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.query(sql, [userId, logId]);
        return result.affectedRows > 0;
    }

    /**
     * Get pending alerts for HOD
     * @param {number} departmentId - Department ID
     * @returns {Array} Pending alerts
     */
    static async getPendingAlertsForHOD(departmentId) {
        const sql = `
            SELECT 
                eel.*,
                s.full_name,
                s.year_of_study,
                s.section
            FROM entry_exit_logs eel
            JOIN students s ON eel.student_id = s.id
            WHERE s.department_id = ?
            AND eel.alert_sent = 1
            AND eel.alert_acknowledged = 0
            AND DATE(eel.event_timestamp) = CURDATE()
            ORDER BY eel.event_timestamp DESC
        `;
        return await db.query(sql, [departmentId]);
    }

    /**
     * Get statistics for dashboard
     * @param {Object} filters - Filter options
     * @returns {Object} Statistics
     */
    static async getDashboardStats(filters = {}) {
        let whereClause = "WHERE DATE(eel.event_timestamp) = CURDATE()";
        const params = [];

        if (filters.departmentId) {
            whereClause += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.hostelId) {
            whereClause += ' AND s.hostel_id = ?';
            params.push(filters.hostelId);
        }

        const sql = `
            SELECT 
                COUNT(CASE WHEN eel.event_type = 'entry' THEN 1 END) AS total_entries,
                COUNT(CASE WHEN eel.event_type = 'exit' THEN 1 END) AS total_exits,
                COUNT(CASE WHEN eel.event_type = 'roaming' THEN 1 END) AS roaming_incidents,
                COUNT(CASE WHEN eel.is_late_entry = 1 THEN 1 END) AS late_entries,
                COUNT(CASE WHEN eel.requires_permission = 1 AND eel.has_permission = 0 THEN 1 END) AS unauthorized_exits,
                COUNT(CASE WHEN eel.alert_sent = 1 AND eel.alert_acknowledged = 0 THEN 1 END) AS pending_alerts,
                COUNT(DISTINCT eel.student_id) AS unique_students
            FROM entry_exit_logs eel
            LEFT JOIN students s ON eel.student_id = s.id
            ${whereClause}
        `;

        const results = await db.query(sql, params);
        return results[0] || { total_entries: 0, total_exits: 0, roaming_incidents: 0, late_entries: 0, unauthorized_exits: 0, pending_alerts: 0, unique_students: 0 };
    }

    /**
     * Get recent activity for live feed
     * @param {number} limit - Number of records
     * @param {Object} filters - Filter options
     * @returns {Array} Recent logs
     */
    static async getRecentActivity(limit = 20, filters = {}) {
        let sql = `
            SELECT 
                eel.*,
                s.full_name,
                s.photo_url,
                d.code AS department_code
            FROM entry_exit_logs eel
            JOIN students s ON eel.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE DATE(eel.event_timestamp) = CURDATE()
        `;
        const params = [];

        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }

        sql += ' ORDER BY eel.event_timestamp DESC LIMIT ?';
        params.push(limit);

        return await db.query(sql, params);
    }
}

module.exports = EntryExitLog;
