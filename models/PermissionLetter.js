/**
 * PermissionLetter Model
 * Handles permission letter photos and validation.
 * Required for mid-day exits during class hours.
 */

const db = require('../config/database');

class PermissionLetter {
    /**
     * Create a new permission letter record
     * Called when security photographs a permission letter
     * @param {Object} letterData - Permission letter information
     * @returns {Object} Created record with ID
     */
    static async create(letterData) {
        const sql = `
            INSERT INTO permission_letters (
                student_id, roll_number, reason,
                permitted_exit_time, permitted_return_time, permission_date,
                photo_filename, photo_path, photo_mime_type,
                issued_by_name, issued_by_designation,
                uploaded_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            letterData.student_id,
            letterData.roll_number,
            letterData.reason || 'Not specified',
            letterData.permitted_exit_time || null,
            letterData.permitted_return_time || null,
            letterData.permission_date || new Date().toISOString().split('T')[0],
            letterData.photo_filename,
            letterData.photo_path,
            letterData.photo_mime_type,
            letterData.issued_by_name || null,
            letterData.issued_by_designation || null,
            letterData.uploaded_by_user_id
        ];
        
        const result = await db.query(sql, params);
        return { id: result.insertId, ...letterData };
    }

    /**
     * Find valid unused permission letter for student today
     * Used during exit scan to check if permission exists
     * @param {string} rollNumber - Student roll number
     * @returns {Object|null} Valid permission letter
     */
    static async findValidForToday(rollNumber) {
        const sql = `
            SELECT * FROM permission_letters
            WHERE roll_number = ?
            AND permission_date = CURDATE()
            AND is_used = 0
            AND is_valid = 1
            ORDER BY uploaded_at DESC
            LIMIT 1
        `;
        const results = await db.query(sql, [rollNumber]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Find by ID
     * @param {number} id - Permission letter ID
     * @returns {Object|null} Permission letter record
     */
    static async findById(id) {
        const sql = `
            SELECT 
                pl.*,
                s.full_name,
                d.name AS department_name
            FROM permission_letters pl
            JOIN students s ON pl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE pl.id = ?
        `;
        const results = await db.query(sql, [id]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Mark permission letter as used
     * Called when student exits using this permission
     * @param {number} id - Permission letter ID
     * @param {number} logId - Entry/exit log ID
     * @returns {boolean} Success status
     */
    static async markAsUsed(id, logId) {
        const sql = `
            UPDATE permission_letters
            SET is_used = 1,
                used_at = CURRENT_TIMESTAMP,
                used_for_log_id = ?
            WHERE id = ?
        `;
        const result = await db.query(sql, [logId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Verify permission letter (by admin/HOD)
     * @param {number} id - Permission letter ID
     * @param {number} userId - User verifying
     * @returns {boolean} Success status
     */
    static async verify(id, userId) {
        const sql = `
            UPDATE permission_letters
            SET is_verified = 1,
                verified_by_user_id = ?,
                verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.query(sql, [userId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Invalidate permission letter
     * @param {number} id - Permission letter ID
     * @param {string} reason - Reason for invalidation
     * @returns {boolean} Success status
     */
    static async invalidate(id, reason) {
        const sql = `
            UPDATE permission_letters
            SET is_valid = 0,
                invalidated_reason = ?
            WHERE id = ?
        `;
        const result = await db.query(sql, [reason, id]);
        return result.affectedRows > 0;
    }

    /**
     * Get all permission letters for a date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Object} filters - Additional filters
     * @returns {Array} List of permission letters
     */
    static async getByDate(date, filters = {}) {
        let sql = `
            SELECT 
                pl.*,
                s.full_name,
                s.year_of_study,
                s.section,
                d.name AS department_name
            FROM permission_letters pl
            JOIN students s ON pl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE pl.permission_date = ?
        `;
        const params = [date];

        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.isUsed !== undefined) {
            sql += ' AND pl.is_used = ?';
            params.push(filters.isUsed);
        }
        if (filters.isVerified !== undefined) {
            sql += ' AND pl.is_verified = ?';
            params.push(filters.isVerified);
        }

        sql += ' ORDER BY pl.uploaded_at DESC';

        return await db.query(sql, params);
    }

    /**
     * Get student's permission history
     * @param {number} studentId - Student ID
     * @param {number} limit - Number of records
     * @returns {Array} Permission letter history
     */
    static async getStudentHistory(studentId, limit = 30) {
        const sql = `
            SELECT * FROM permission_letters
            WHERE student_id = ?
            ORDER BY permission_date DESC, uploaded_at DESC
            LIMIT ?
        `;
        return await db.query(sql, [studentId, limit]);
    }

    /**
     * Get unverified permission letters (for admin review)
     * @param {Object} filters - Filter options
     * @returns {Array} Unverified permission letters
     */
    static async getUnverified(filters = {}) {
        let sql = `
            SELECT 
                pl.*,
                s.full_name,
                d.name AS department_name
            FROM permission_letters pl
            JOIN students s ON pl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE pl.is_verified = 0
            AND pl.is_valid = 1
        `;
        const params = [];

        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }

        sql += ' ORDER BY pl.uploaded_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }

        return await db.query(sql, params);
    }
}

module.exports = PermissionLetter;
