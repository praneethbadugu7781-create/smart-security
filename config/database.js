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

// Support Railway's MySQL environment variables (both formats)
const dbConfig = {
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
    // MySQL specific settings
    charset: 'utf8mb4',
    timezone: '+00:00',
    dateStrings: false
};

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
        
        return pool;
    } catch (error) {
        console.error('[DATABASE] Failed to create connection pool:', error.message);
        throw error;
    }
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
