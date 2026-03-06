/**
 * Smart Main Gate Entry-Exit & Campus Discipline System
 * Database Configuration
 * 
 * MySQL database configuration using mysql2 with connection pool.
 * Production-ready with reconnection handling and query promise wrapper.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================
// DATABASE CONFIGURATION
// ============================================

// Parse MySQL URL if provided (Railway provides MYSQL_URL or MYSQL_PUBLIC_URL)
function parseDbConfig() {
    const dbUrl = process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || process.env.DATABASE_URL;
    
    if (dbUrl) {
        try {
            const url = new URL(dbUrl);
            console.log('[DATABASE] Using connection URL');
            return {
                host: url.hostname,
                port: parseInt(url.port) || 3306,
                user: url.username,
                password: url.password,
                database: url.pathname.slice(1), // Remove leading slash
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
                charset: 'utf8mb4',
                timezone: '+00:00',
                dateStrings: false
            };
        } catch (e) {
            console.log('[DATABASE] Invalid URL, using individual vars');
        }
    }
    
    // Fall back to individual environment variables
    return {
        host: process.env.MYSQLHOST || process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.DB_PORT) || 3306,
        user: process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.DB_USER || 'root',
        password: process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || 'sarvani1530',
        database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || process.env.DB_NAME || 'smart_gate',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        charset: 'utf8mb4',
        timezone: '+00:00',
        dateStrings: false
    };
}

const dbConfig = parseDbConfig();

// Connection pool instance
let pool = null;

// ============================================
// DATABASE INITIALIZATION
// ============================================

/**
 * Initialize the MySQL connection pool
 * @returns {Promise<mysql.Pool>} MySQL connection pool
 */
async function initDatabase() {
    if (pool) return pool;
    
    try {
        pool = mysql.createPool(dbConfig);
        
        // Test the connection
        const connection = await pool.getConnection();
        console.log('[DATABASE] MySQL connection pool created');
        console.log(`[DATABASE] Host: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`[DATABASE] Database: ${dbConfig.database}`);
        connection.release();
        
        // Auto-create tables if they don't exist
        await autoInitSchema();
        
        return pool;
    } catch (error) {
        console.error('[DATABASE] Failed to create connection pool:', error.message);
        throw error;
    }
}

/**
 * Auto-initialize database schema if tables don't exist
 */
async function autoInitSchema() {
    try {
        // Check if departments table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'departments'");
        if (tables.length === 0) {
            console.log('[DATABASE] Tables not found, creating schema...');
            await createSchema();
            await seedInitialData();
            console.log('[DATABASE] Schema created successfully');
        } else {
            // Check if users exist, if not seed them
            const [users] = await pool.query("SELECT COUNT(*) as count FROM users");
            if (users[0].count === 0) {
                console.log('[DATABASE] No users found, seeding initial data...');
                await seedInitialData();
            }
        }
    } catch (error) {
        console.error('[DATABASE] Auto-init schema error:', error.message);
    }
}

/**
 * Create all database tables
 */
async function createSchema() {
    const bcrypt = require('bcryptjs');
    
    // Create tables in order (respecting foreign keys)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS departments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            code VARCHAR(10) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            hod_user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS hostels (
            id INT PRIMARY KEY AUTO_INCREMENT,
            code VARCHAR(10) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            type ENUM('boys', 'girls') NOT NULL,
            warden_user_id INT NULL,
            capacity INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(15),
            role ENUM('security', 'admin', 'hod', 'warden', 'principal') NOT NULL,
            department_id INT NULL,
            hostel_id INT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS students (
            id INT PRIMARY KEY AUTO_INCREMENT,
            roll_number VARCHAR(20) NOT NULL UNIQUE,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(15),
            parent_phone VARCHAR(15),
            student_type ENUM('day_scholar', 'hosteler', 'bus') NOT NULL DEFAULT 'day_scholar',
            department_id INT NOT NULL,
            year_of_study TINYINT DEFAULT 1,
            section VARCHAR(5),
            hostel_id INT NULL,
            room_number VARCHAR(10) NULL,
            bus_route VARCHAR(50) NULL,
            bus_stop VARCHAR(100) NULL,
            photo_url VARCHAR(255) NULL,
            is_active BOOLEAN DEFAULT TRUE,
            admission_date DATE,
            roaming_count INT DEFAULT 0,
            late_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS entry_exit_logs (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            roll_number VARCHAR(20) NOT NULL,
            event_type ENUM('entry', 'exit', 'roaming') NOT NULL,
            event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            gate_location VARCHAR(50) DEFAULT 'main_gate',
            is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
            requires_permission BOOLEAN DEFAULT FALSE,
            has_permission BOOLEAN DEFAULT FALSE,
            permission_letter_id BIGINT NULL,
            student_type ENUM('day_scholar', 'hosteler', 'bus') NOT NULL DEFAULT 'day_scholar',
            is_during_class_hours BOOLEAN DEFAULT FALSE,
            is_late_entry BOOLEAN DEFAULT FALSE,
            is_late_return BOOLEAN DEFAULT FALSE,
            alert_sent BOOLEAN DEFAULT FALSE,
            alert_sent_to VARCHAR(50) NULL,
            alert_acknowledged BOOLEAN DEFAULT FALSE,
            alert_acknowledged_by INT NULL,
            alert_acknowledged_at TIMESTAMP NULL,
            scanned_by_user_id INT NOT NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS permission_letters (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            roll_number VARCHAR(20) NOT NULL,
            reason TEXT NOT NULL,
            permitted_exit_time TIME NULL,
            permitted_return_time TIME NULL,
            permission_date DATE NOT NULL,
            photo_filename VARCHAR(255) NOT NULL,
            photo_path VARCHAR(500) NOT NULL,
            photo_mime_type VARCHAR(50) NOT NULL,
            issued_by_name VARCHAR(100),
            issued_by_designation VARCHAR(100),
            is_verified BOOLEAN DEFAULT FALSE,
            verified_by_user_id INT NULL,
            verified_at TIMESTAMP NULL,
            is_used BOOLEAN DEFAULT FALSE,
            used_at TIMESTAMP NULL,
            used_for_log_id BIGINT NULL,
            is_valid BOOLEAN DEFAULT TRUE,
            invalidated_reason VARCHAR(255) NULL,
            uploaded_by_user_id INT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS roaming_logs (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            student_id INT NOT NULL,
            roll_number VARCHAR(20) NOT NULL,
            detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            detected_location VARCHAR(100) DEFAULT 'campus',
            expected_class VARCHAR(100) NULL,
            expected_location VARCHAR(100) NULL,
            alert_sent_to_hod BOOLEAN DEFAULT FALSE,
            hod_notified_at TIMESTAMP NULL,
            hod_user_id INT NULL,
            is_resolved BOOLEAN DEFAULT FALSE,
            resolution_notes TEXT NULL,
            resolved_by_user_id INT NULL,
            resolved_at TIMESTAMP NULL,
            is_escalated BOOLEAN DEFAULT FALSE,
            escalated_to ENUM('warden', 'principal') NULL,
            escalated_at TIMESTAMP NULL,
            entry_exit_log_id BIGINT NULL,
            detected_by_user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS alerts (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            target_role ENUM('hod', 'warden', 'principal', 'admin') NOT NULL,
            target_department_id INT NULL,
            target_hostel_id INT NULL,
            alert_type ENUM('roaming', 'unauthorized_exit', 'late_return', 'permission_required', 'escalation') NOT NULL,
            priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            student_id INT NULL,
            entry_exit_log_id BIGINT NULL,
            roaming_log_id BIGINT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            read_by_user_id INT NULL,
            read_at TIMESTAMP NULL,
            is_actioned BOOLEAN DEFAULT FALSE,
            action_taken VARCHAR(255) NULL,
            actioned_by_user_id INT NULL,
            actioned_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NULL,
            action VARCHAR(100) NOT NULL,
            table_name VARCHAR(50),
            record_id VARCHAR(50),
            old_values JSON,
            new_values JSON,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * Seed initial data (departments, users)
 */
async function seedInitialData() {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    // Insert departments
    await pool.query(`
        INSERT IGNORE INTO departments (code, name) VALUES
        ('CSE', 'Computer Science & Engineering'),
        ('ECE', 'Electronics & Communication Engineering'),
        ('EEE', 'Electrical & Electronics Engineering'),
        ('ME', 'Mechanical Engineering'),
        ('CE', 'Civil Engineering'),
        ('AI', 'Artificial Intelligence'),
        ('IT', 'Information Technology')
    `);
    
    // Insert hostels
    await pool.query(`
        INSERT IGNORE INTO hostels (code, name, type) VALUES
        ('BH1', 'Boys Hostel 1', 'boys'),
        ('GH1', 'Girls Hostel 1', 'girls')
    `);
    
    // Insert default users one by one to ensure they get created
    try {
        await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
            ['admin', passwordHash, 'System Administrator', 'admin']
        );
        console.log('[DATABASE] Created admin user');
    } catch (e) {
        if (!e.message.includes('Duplicate')) console.error('[DATABASE] Admin user error:', e.message);
    }
    
    try {
        await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
            ['security1', passwordHash, 'Security Guard 1', 'security']
        );
        console.log('[DATABASE] Created security user');
    } catch (e) {
        if (!e.message.includes('Duplicate')) console.error('[DATABASE] Security user error:', e.message);
    }
    
    try {
        await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
            ['principal', passwordHash, 'Principal', 'principal']
        );
        console.log('[DATABASE] Created principal user');
    } catch (e) {
        if (!e.message.includes('Duplicate')) console.error('[DATABASE] Principal user error:', e.message);
    }
    
    console.log('[DATABASE] Initial data seeded');
    console.log('[DATABASE] Default login: admin / admin123');
}

/**
 * Get the database pool
 * @returns {mysql.Pool} MySQL connection pool
 */
function getDatabase() {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return pool;
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
    try {
        if (!pool) await initDatabase();
        const [rows] = await pool.query('SELECT 1 as result');
        return rows[0].result === 1;
    } catch (error) {
        console.error('[DATABASE] Connection test failed:', error.message);
        return false;
    }
}

// ============================================
// QUERY EXECUTION
// ============================================

/**
 * Execute a SQL query with parameters
 * Returns array of rows for SELECT, or result object for INSERT/UPDATE/DELETE
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array|Object>} Query results
 */
async function query(sql, params = []) {
    try {
        if (!pool) await initDatabase();
        
        // Use pool.query instead of pool.execute for better LIMIT compatibility
        const [results, fields] = await pool.query(sql, params);
        
        // For SELECT queries, results is an array of rows
        if (Array.isArray(results)) {
            return results;
        }
        
        // For INSERT/UPDATE/DELETE, return the result info
        return {
            insertId: results.insertId,
            affectedRows: results.affectedRows,
            changedRows: results.changedRows || 0
        };
    } catch (error) {
        console.error('[DATABASE] Query error:', error.message);
        console.error('[DATABASE] Query:', sql);
        console.error('[DATABASE] Params:', params);
        throw error;
    }
}

/**
 * Execute raw SQL (for schema setup, multiple statements)
 * @param {string} sql - SQL statement(s)
 * @returns {Promise<void>}
 */
async function exec(sql) {
    if (!pool) await initDatabase();
    
    // Get a connection for multi-statement execution
    const connection = await pool.getConnection();
    try {
        // For multi-statement execution, split by semicolons
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        for (const statement of statements) {
            await connection.query(statement);
        }
    } finally {
        connection.release();
    }
}

/**
 * Execute multiple queries in a transaction
 * @param {Array<{sql: string, params: Array}>} queries - Array of query objects
 * @returns {Promise<Array>} Results of all queries
 */
async function transaction(queries) {
    if (!pool) await initDatabase();
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const { sql, params } of queries) {
            const [result] = await connection.execute(sql, params || []);
            results.push(result);
        }
        
        await connection.commit();
        return results;
    } catch (error) {
        await connection.rollback();
        console.error('[DATABASE] Transaction failed:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Get a connection from the pool for complex operations
 * Remember to release() the connection when done!
 * @returns {Promise<mysql.PoolConnection>} Database connection
 */
async function getConnection() {
    if (!pool) await initDatabase();
    return await pool.getConnection();
}

/**
 * Close all connections in the pool
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[DATABASE] Connection pool closed');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape a value for use in SQL
 * @param {any} value - Value to escape
 * @returns {string} Escaped value
 */
function escape(value) {
    return mysql.escape(value);
}

/**
 * Escape an identifier (table/column name)
 * @param {string} identifier - Identifier to escape
 * @returns {string} Escaped identifier
 */
function escapeId(identifier) {
    return mysql.escapeId(identifier);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    initDatabase,
    getDatabase,
    query,
    exec,
    transaction,
    getConnection,
    testConnection,
    close,
    escape,
    escapeId,
    // For backward compatibility
    saveDatabase: async () => {} // No-op for MySQL (auto-persisted)
};
