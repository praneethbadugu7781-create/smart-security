/**
 * RoamingLog Model
 * Tracks students found roaming during class hours.
 * Triggers immediate HOD alerts.
 */

const db = require('../config/database');

class RoamingLog {
    /**
     * Create a new roaming log record
     * Called when student is detected roaming during class hours
     * @param {Object} logData - Roaming incident information
     * @returns {Object} Created record with ID
     */
    static async create(logData) {
        const sql = `
            INSERT INTO roaming_logs (
                student_id, roll_number, detected_at, detected_location,
                expected_class, expected_location, alert_sent_to_hod,
                hod_notified_at, hod_user_id, entry_exit_log_id, detected_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            logData.student_id,
            logData.roll_number,
            logData.detected_at || new Date(),
            logData.detected_location || 'campus',
            logData.expected_class || null,
            logData.expected_location || null,
            logData.alert_sent_to_hod || false,
            logData.hod_notified_at || null,
            logData.hod_user_id || null,
            logData.entry_exit_log_id || null,
            logData.detected_by_user_id
        ];
        
        const result = await db.query(sql, params);
        return { id: result.insertId, ...logData };
    }

    /**
     * Find by ID
     * @param {number} id - Roaming log ID
     * @returns {Object|null} Roaming log record
     */
    static async findById(id) {
        const sql = `
            SELECT 
                rl.*,
                s.full_name,
                s.year_of_study,
                s.section,
                d.name AS department_name,
                d.id AS department_id
            FROM roaming_logs rl
            JOIN students s ON rl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE rl.id = ?
        `;
        const results = await db.query(sql, [id]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get today's roaming incidents
     * @param {Object} filters - Filter options
     * @returns {Array} List of roaming incidents
     */
    static async getTodayIncidents(filters = {}) {
        let sql = `
            SELECT 
                rl.*,
                s.full_name,
                s.year_of_study,
                s.section,
                s.student_type,
                d.name AS department_name
            FROM roaming_logs rl
            JOIN students s ON rl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE DATE(rl.detected_at) = CURDATE()
        `;
        const params = [];

        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.isResolved !== undefined) {
            sql += ' AND rl.is_resolved = ?';
            params.push(filters.isResolved);
        }
        if (filters.isEscalated !== undefined) {
            sql += ' AND rl.is_escalated = ?';
            params.push(filters.isEscalated);
        }

        sql += ' ORDER BY rl.detected_at DESC';

        return await db.query(sql, params);
    }

    /**
     * Get unresolved incidents for HOD
     * @param {number} departmentId - Department ID
     * @returns {Array} Unresolved roaming incidents
     */
    static async getUnresolvedForHOD(departmentId) {
        return await this.getTodayIncidents({
            departmentId,
            isResolved: false
        });
    }

    /**
     * Resolve a roaming incident
     * @param {number} id - Roaming log ID
     * @param {number} userId - User resolving
     * @param {string} notes - Resolution notes
     * @returns {boolean} Success status
     */
    static async resolve(id, userId, notes = null) {
        const sql = `
            UPDATE roaming_logs
            SET is_resolved = 1,
                resolution_notes = ?,
                resolved_by_user_id = ?,
                resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.query(sql, [notes, userId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Escalate a roaming incident
     * @param {number} id - Roaming log ID
     * @param {string} escalateTo - 'warden' or 'principal'
     * @returns {boolean} Success status
     */
    static async escalate(id, escalateTo) {
        const sql = `
            UPDATE roaming_logs
            SET is_escalated = 1,
                escalated_to = ?,
                escalated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.query(sql, [escalateTo, id]);
        return result.affectedRows > 0;
    }

    /**
     * Mark alert sent to HOD
     * @param {number} id - Roaming log ID
     * @param {number} hodUserId - HOD user ID
     * @returns {boolean} Success status
     */
    static async markAlertSent(id, hodUserId) {
        const sql = `
            UPDATE roaming_logs
            SET alert_sent_to_hod = 1,
                hod_notified_at = CURRENT_TIMESTAMP,
                hod_user_id = ?
            WHERE id = ?
        `;
        const result = await db.query(sql, [hodUserId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Get student's roaming history
     * @param {number} studentId - Student ID
     * @param {number} days - Number of days to look back
     * @returns {Array} Roaming history
     */
    static async getStudentHistory(studentId, days = 30) {
        const sql = `
            SELECT * FROM roaming_logs
            WHERE student_id = ?
            AND detected_at > DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY detected_at DESC
        `;
        return await db.query(sql, [studentId, days]);
    }

    /**
     * Count today's incidents for a student
     * Used for escalation threshold checking
     * @param {number} studentId - Student ID
     * @returns {number} Count of incidents
     */
    static async countTodayIncidents(studentId) {
        const sql = `
            SELECT COUNT(*) AS count FROM roaming_logs
            WHERE student_id = ?
            AND DATE(detected_at) = CURDATE()
        `;
        const results = await db.query(sql, [studentId]);
        return results[0].count;
    }

    /**
     * Get statistics for dashboard
     * @param {Object} filters - Filter options
     * @returns {Object} Roaming statistics
     */
    static async getStats(filters = {}) {
        let whereClause = "WHERE DATE(rl.detected_at) = CURDATE()";
        const params = [];

        if (filters.departmentId) {
            whereClause += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }

        const sql = `
            SELECT 
                COUNT(*) AS total_incidents,
                COUNT(CASE WHEN rl.is_resolved = 1 THEN 1 END) AS resolved,
                COUNT(CASE WHEN rl.is_resolved = 0 THEN 1 END) AS unresolved,
                COUNT(CASE WHEN rl.is_escalated = 1 THEN 1 END) AS escalated,
                COUNT(DISTINCT rl.student_id) AS unique_students
            FROM roaming_logs rl
            JOIN students s ON rl.student_id = s.id
            ${whereClause}
        `;

        const results = await db.query(sql, params);
        return results[0];
    }
}

module.exports = RoamingLog;
