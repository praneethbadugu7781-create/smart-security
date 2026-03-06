/**
 * Student Model
 * Handles all database operations related to students.
 * The roll_number field is the key identifier from barcode scans.
 */

const db = require('../config/database');

class Student {
    /**
     * Find student by roll number (barcode value)
     * This is the primary lookup method used during scanning
     * @param {string} rollNumber - The roll number from barcode
     * @returns {Object|null} Student record with department and hostel info
     */
    static async findByRollNumber(rollNumber) {
        const sql = `
            SELECT 
                s.*,
                d.code AS department_code,
                d.name AS department_name,
                d.hod_user_id,
                h.code AS hostel_code,
                h.name AS hostel_name,
                h.warden_user_id
            FROM students s
            JOIN departments d ON s.department_id = d.id
            LEFT JOIN hostels h ON s.hostel_id = h.id
            WHERE s.roll_number = ? AND s.is_active = 1
        `;
        const results = await db.query(sql, [rollNumber]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Find student by ID
     * @param {number} id - Student ID
     * @returns {Object|null} Student record
     */
    static async findById(id) {
        const sql = `
            SELECT 
                s.*,
                d.code AS department_code,
                d.name AS department_name,
                h.code AS hostel_code,
                h.name AS hostel_name
            FROM students s
            JOIN departments d ON s.department_id = d.id
            LEFT JOIN hostels h ON s.hostel_id = h.id
            WHERE s.id = ?
        `;
        const results = await db.query(sql, [id]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get all students with optional filters
     * @param {Object} filters - Filter options
     * @returns {Array} List of students
     */
    static async findAll(filters = {}) {
        let sql = `
            SELECT 
                s.*,
                d.code AS department_code,
                d.name AS department_name,
                h.name AS hostel_name
            FROM students s
            JOIN departments d ON s.department_id = d.id
            LEFT JOIN hostels h ON s.hostel_id = h.id
            WHERE s.is_active = 1
        `;
        const params = [];

        // Apply filters
        if (filters.departmentId) {
            sql += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.departmentCode) {
            sql += ' AND d.code = ?';
            params.push(filters.departmentCode);
        }
        if (filters.studentType) {
            sql += ' AND s.student_type = ?';
            params.push(filters.studentType);
        }
        if (filters.hostelId) {
            sql += ' AND s.hostel_id = ?';
            params.push(filters.hostelId);
        }
        if (filters.yearOfStudy) {
            sql += ' AND s.year_of_study = ?';
            params.push(filters.yearOfStudy);
        }
        if (filters.search) {
            sql += ' AND (s.roll_number LIKE ? OR s.full_name LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        sql += ' ORDER BY s.roll_number ASC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }

        return await db.query(sql, params);
    }

    /**
     * Get students by department (for HOD dashboard)
     * @param {number} departmentId - Department ID
     * @returns {Array} List of students in department
     */
    static async findByDepartment(departmentId) {
        return await this.findAll({ departmentId });
    }

    /**
     * Get students by hostel (for Warden dashboard)
     * @param {number} hostelId - Hostel ID
     * @returns {Array} List of students in hostel
     */
    static async findByHostel(hostelId) {
        return await this.findAll({ hostelId });
    }

    /**
     * Create a new student
     * @param {Object} studentData - Student information
     * @returns {Object} Created student with ID
     */
    static async create(studentData) {
        const sql = `
            INSERT INTO students (
                roll_number, full_name, email, phone, parent_phone,
                student_type, department_id, year_of_study, section,
                hostel_id, room_number, bus_route, bus_stop, photo_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            studentData.roll_number,
            studentData.full_name,
            studentData.email || null,
            studentData.phone || null,
            studentData.parent_phone || null,
            studentData.student_type,
            studentData.department_id,
            studentData.year_of_study,
            studentData.section || null,
            studentData.hostel_id || null,
            studentData.room_number || null,
            studentData.bus_route || null,
            studentData.bus_stop || null,
            studentData.photo_url || null
        ];
        
        const result = await db.query(sql, params);
        return { id: result.insertId, ...studentData };
    }

    /**
     * Update student information
     * @param {number} id - Student ID
     * @param {Object} updateData - Fields to update
     * @returns {boolean} Success status
     */
    static async update(id, updateData) {
        const allowedFields = [
            'full_name', 'email', 'phone', 'parent_phone',
            'student_type', 'department_id', 'year_of_study', 'section',
            'hostel_id', 'room_number', 'bus_route', 'bus_stop', 'photo_url'
        ];

        const updates = [];
        const params = [];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(updateData[field]);
            }
        }

        if (updates.length === 0) return false;

        params.push(id);
        const sql = `UPDATE students SET ${updates.join(', ')} WHERE id = ?`;
        
        const result = await db.query(sql, params);
        return result.affectedRows > 0;
    }

    /**
     * Increment roaming count for student
     * @param {number} id - Student ID
     * @returns {boolean} Success status
     */
    static async incrementRoamingCount(id) {
        const sql = 'UPDATE students SET roaming_count = roaming_count + 1 WHERE id = ?';
        const result = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Increment late count for student
     * @param {number} id - Student ID
     * @returns {boolean} Success status
     */
    static async incrementLateCount(id) {
        const sql = 'UPDATE students SET late_count = late_count + 1 WHERE id = ?';
        const result = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Deactivate student (soft delete)
     * @param {number} id - Student ID
     * @returns {boolean} Success status
     */
    static async deactivate(id) {
        const sql = 'UPDATE students SET is_active = 0 WHERE id = ?';
        const result = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Get today's status for a student
     * Includes entry/exit counts and last event
     * @param {string} rollNumber - Student roll number
     * @returns {Object} Status information
     */
    static async getTodayStatus(rollNumber) {
        const sql = `
            SELECT 
                s.id AS student_id,
                s.roll_number,
                s.full_name,
                s.student_type,
                s.department_id,
                s.hostel_id,
                (SELECT event_type FROM entry_exit_logs 
                 WHERE roll_number = ? ORDER BY event_timestamp DESC LIMIT 1) AS last_event_type,
                (SELECT event_timestamp FROM entry_exit_logs 
                 WHERE roll_number = ? ORDER BY event_timestamp DESC LIMIT 1) AS last_event_time,
                (SELECT COUNT(*) FROM entry_exit_logs 
                 WHERE roll_number = ? AND DATE(event_timestamp) = CURDATE() 
                 AND event_type = 'entry') AS today_entries,
                (SELECT COUNT(*) FROM entry_exit_logs 
                 WHERE roll_number = ? AND DATE(event_timestamp) = CURDATE() 
                 AND event_type = 'exit') AS today_exits
            FROM students s
            WHERE s.roll_number = ? AND s.is_active = 1
        `;
        const results = await db.query(sql, [rollNumber, rollNumber, rollNumber, rollNumber, rollNumber]);
        return results.length > 0 ? results[0] : null;
    }
}

module.exports = Student;
