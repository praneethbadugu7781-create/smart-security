/**
 * Alert Model
 * Real-time alert queue for dashboard notifications.
 * Supports role-based and department/hostel-specific targeting.
 */

const db = require('../config/database');

class Alert {
    /**
     * Create a new alert
     * @param {Object} alertData - Alert information
     * @returns {Object} Created alert with ID
     */
    static async create(alertData) {
        const sql = `
            INSERT INTO alerts (
                target_role, target_department_id, target_hostel_id,
                alert_type, priority, title, message,
                student_id, entry_exit_log_id, roaming_log_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            alertData.target_role,
            alertData.target_department_id || null,
            alertData.target_hostel_id || null,
            alertData.alert_type,
            alertData.priority || 'medium',
            alertData.title,
            alertData.message,
            alertData.student_id || null,
            alertData.entry_exit_log_id || null,
            alertData.roaming_log_id || null
        ];
        
        const result = await db.query(sql, params);
        return { id: result.insertId, ...alertData };
    }

    /**
     * Get alerts for a specific user based on their role
     * @param {Object} user - User object with role and department/hostel info
     * @param {boolean} unreadOnly - Only return unread alerts
     * @returns {Array} List of alerts
     */
    static async getForUser(user, unreadOnly = true) {
        let sql = `
            SELECT 
                a.*,
                s.full_name AS student_name,
                s.roll_number,
                d.name AS department_name,
                h.name AS hostel_name
            FROM alerts a
            LEFT JOIN students s ON a.student_id = s.id  
            LEFT JOIN departments d ON a.target_department_id = d.id
            LEFT JOIN hostels h ON a.target_hostel_id = h.id
            WHERE 1=1
        `;
        const params = [];

        // Role-based filtering
        if (user.role === 'hod') {
            // HOD sees alerts for their department
            sql += ' AND (a.target_role = ? AND a.target_department_id = ?)';
            params.push('hod', user.department_id);
        } else if (user.role === 'warden') {
            // Warden sees alerts for their hostel
            sql += ' AND (a.target_role = ? AND a.target_hostel_id = ?)';
            params.push('warden', user.hostel_id);
        } else if (user.role === 'principal') {
            // Principal sees all alerts targeted to principal OR escalated
            sql += ' AND (a.target_role = ? OR a.priority = ?)';
            params.push('principal', 'critical');
        } else if (user.role === 'admin') {
            // Admin sees all alerts
            sql += ' AND 1=1';
        } else {
            // Security should not see alerts
            return [];
        }

        if (unreadOnly) {
            sql += ' AND a.is_read = 0';
        }

        sql += " ORDER BY CASE a.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, a.created_at DESC";
        sql += ' LIMIT 100';

        return await db.query(sql, params);
    }

    /**
     * Mark alert as read
     * @param {number} id - Alert ID
     * @param {number} userId - User who read it
     * @returns {boolean} Success status
     */
    static async markAsRead(id, userId) {
        const sql = `
            UPDATE alerts
            SET is_read = 1,
                read_by_user_id = ?,
                read_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.query(sql, [userId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Mark alert as actioned
     * @param {number} id - Alert ID
     * @param {number} userId - User who actioned it
     * @param {string} action - Action taken description
     * @returns {boolean} Success status
     */
    static async markAsActioned(id, userId, action) {
        const sql = `
            UPDATE alerts
            SET is_actioned = 1,
                action_taken = ?,
                actioned_by_user_id = ?,
                actioned_at = CURRENT_TIMESTAMP,
                is_read = 1,
                read_by_user_id = COALESCE(read_by_user_id, ?),
                read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
            WHERE id = ?
        `;
        const result = await db.query(sql, [action, userId, userId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Get unread count for user
     * @param {Object} user - User object
     * @returns {number} Count of unread alerts
     */
    static async getUnreadCount(user) {
        let sql = `SELECT COUNT(*) AS count FROM alerts WHERE is_read = 0`;
        const params = [];

        if (user.role === 'hod') {
            sql += ' AND target_role = ? AND target_department_id = ?';
            params.push('hod', user.department_id);
        } else if (user.role === 'warden') {
            sql += ' AND target_role = ? AND target_hostel_id = ?';
            params.push('warden', user.hostel_id);
        } else if (user.role === 'principal') {
            sql += ' AND (target_role = ? OR priority = ?)';
            params.push('principal', 'critical');
        }

        const results = await db.query(sql, params);
        return results[0].count;
    }

    /**
     * Create roaming alert for HOD
     * Convenience method for roaming detection
     * @param {Object} student - Student record
     * @param {number} roamingLogId - Roaming log ID
     * @param {number} hodUserId - HOD user ID
     * @returns {Object} Created alert
     */
    static async createRoamingAlert(student, roamingLogId, hodUserId) {
        return await this.create({
            target_role: 'hod',
            target_department_id: student.department_id,
            alert_type: 'roaming',
            priority: 'high',
            title: `Roaming Alert: ${student.full_name}`,
            message: `Student ${student.roll_number} (${student.full_name}) was detected roaming during class hours.`,
            student_id: student.id,
            roaming_log_id: roamingLogId
        });
    }

    /**
     * Create unauthorized exit alert
     * @param {Object} student - Student record
     * @param {number} logId - Entry/exit log ID
     * @returns {Object} Created alert
     */
    static async createUnauthorizedExitAlert(student, logId) {
        return await this.create({
            target_role: 'hod',
            target_department_id: student.department_id,
            alert_type: 'unauthorized_exit',
            priority: 'high',
            title: `Unauthorized Exit: ${student.full_name}`,
            message: `Student ${student.roll_number} attempted to exit during class hours without permission.`,
            student_id: student.id,
            entry_exit_log_id: logId
        });
    }

    /**
     * Create late return alert for warden
     * @param {Object} student - Student record
     * @param {number} logId - Entry/exit log ID
     * @returns {Object} Created alert
     */
    static async createLateReturnAlert(student, logId) {
        return await this.create({
            target_role: 'warden',
            target_hostel_id: student.hostel_id,
            alert_type: 'late_return',
            priority: 'medium',
            title: `Late Return: ${student.full_name}`,
            message: `Hosteler ${student.roll_number} returned after curfew time.`,
            student_id: student.id,
            entry_exit_log_id: logId
        });
    }

    /**
     * Delete old read alerts (cleanup)
     * @param {number} daysOld - Delete alerts older than this many days
     * @returns {number} Number of deleted alerts
     */
    static async cleanupOld(daysOld = 30) {
        const sql = `
            DELETE FROM alerts
            WHERE is_read = 1
            AND is_actioned = 1
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        const result = await db.query(sql, [daysOld]);
        return result.affectedRows;
    }
}

module.exports = Alert;
