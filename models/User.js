/**
 * User Model
 * Handles authentication and user management.
 * Supports roles: security, admin, hod, warden, principal
 */

const db = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class User {
    /**
     * Find user by username (for login)
     * @param {string} username - The username
     * @returns {Object|null} User record with role info
     */
    static async findByUsername(username) {
        const sql = `
            SELECT 
                u.*,
                d.code AS department_code,
                d.name AS department_name,
                h.code AS hostel_code,
                h.name AS hostel_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN hostels h ON u.hostel_id = h.id
            WHERE u.username = ? AND u.is_active = 1
        `;
        const results = await db.query(sql, [username]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Object|null} User record
     */
    static async findById(id) {
        const sql = `
            SELECT 
                u.id, u.username, u.full_name, u.email, u.phone,
                u.role, u.department_id, u.hostel_id, u.is_active,
                u.last_login, u.created_at,
                d.code AS department_code,
                d.name AS department_name,
                h.code AS hostel_code,
                h.name AS hostel_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN hostels h ON u.hostel_id = h.id
            WHERE u.id = ?
        `;
        const results = await db.query(sql, [id]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get all users with optional role filter
     * @param {string} role - Optional role filter
     * @returns {Array} List of users
     */
    static async findAll(role = null) {
        let sql = `
            SELECT 
                u.id, u.username, u.full_name, u.email, u.phone,
                u.role, u.department_id, u.hostel_id, u.is_active,
                u.last_login, u.created_at,
                d.name AS department_name,
                h.name AS hostel_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN hostels h ON u.hostel_id = h.id
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            sql += ' AND u.role = ?';
            params.push(role);
        }

        sql += ' ORDER BY u.role, u.username';

        return await db.query(sql, params);
    }

    /**
     * Verify password for login
     * @param {string} password - Plain text password
     * @param {string} hash - Stored password hash
     * @returns {boolean} True if password matches
     */
    static async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    /**
     * Hash a password
     * @param {string} password - Plain text password
     * @returns {string} Bcrypt hash
     */
    static async hashPassword(password) {
        return await bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Create a new user
     * @param {Object} userData - User information
     * @returns {Object} Created user with ID
     */
    static async create(userData) {
        const passwordHash = await this.hashPassword(userData.password);
        
        const sql = `
            INSERT INTO users (
                username, password_hash, full_name, email, phone,
                role, department_id, hostel_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            userData.username,
            passwordHash,
            userData.full_name,
            userData.email || null,
            userData.phone || null,
            userData.role,
            userData.department_id || null,
            userData.hostel_id || null
        ];
        
        const result = await db.query(sql, params);
        
        // Return user without password hash
        const { password, ...userWithoutPassword } = userData;
        return { id: result.insertId, ...userWithoutPassword };
    }

    /**
     * Update user's last login timestamp
     * @param {number} id - User ID
     * @returns {boolean} Success status
     */
    static async updateLastLogin(id) {
        const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Update user information
     * @param {number} id - User ID
     * @param {Object} updateData - Fields to update
     * @returns {boolean} Success status
     */
    static async update(id, updateData) {
        const allowedFields = ['full_name', 'email', 'phone', 'department_id', 'hostel_id'];
        const updates = [];
        const params = [];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(updateData[field]);
            }
        }

        // Handle password update separately
        if (updateData.password) {
            const passwordHash = await this.hashPassword(updateData.password);
            updates.push('password_hash = ?');
            params.push(passwordHash);
        }

        if (updates.length === 0) return false;

        params.push(id);
        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        
        const result = await db.query(sql, params);
        return result.affectedRows > 0;
    }

    /**
     * Deactivate user (soft delete)
     * @param {number} id - User ID
     * @returns {boolean} Success status
     */
    static async deactivate(id) {
        const sql = 'UPDATE users SET is_active = 0 WHERE id = ?';
        const result = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Get HOD user for a department
     * @param {number} departmentId - Department ID
     * @returns {Object|null} HOD user
     */
    static async getHodForDepartment(departmentId) {
        const sql = `
            SELECT u.* FROM users u
            JOIN departments d ON d.hod_user_id = u.id
            WHERE d.id = ? AND u.is_active = 1
        `;
        const results = await db.query(sql, [departmentId]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get Warden user for a hostel
     * @param {number} hostelId - Hostel ID
     * @returns {Object|null} Warden user
     */
    static async getWardenForHostel(hostelId) {
        const sql = `
            SELECT u.* FROM users u
            JOIN hostels h ON h.warden_user_id = u.id
            WHERE h.id = ? AND u.is_active = 1
        `;
        const results = await db.query(sql, [hostelId]);
        return results.length > 0 ? results[0] : null;
    }
}

module.exports = User;
