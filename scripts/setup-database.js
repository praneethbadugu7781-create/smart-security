/**
 * Database Setup Script for MySQL
 * Run: node scripts/setup-database.js
 * 
 * This script creates the 'smart_gate' database and all required tables.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    console.log('🔧 Starting MySQL database setup...\n');

    // Database configuration (without database name for initial connection)
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'sarvani1530',
        multipleStatements: true
    };

    const dbName = process.env.DB_NAME || 'smart_gate';

    let connection;
    try {
        // Connect without database first
        console.log(`📡 Connecting to MySQL at ${config.host}:${config.port}...`);
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to MySQL server\n');

        // Create database
        console.log(`📦 Creating database: ${dbName}`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`✅ Database '${dbName}' ready\n`);

        // Switch to the database
        await connection.query(`USE \`${dbName}\``);

        // Read and execute schema
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        console.log(`📝 Loading schema from: ${schemaPath}`);
        
        let schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Remove CREATE DATABASE and USE statements (we already did that)
        schema = schema.replace(/CREATE DATABASE.*?;/gi, '');
        schema = schema.replace(/USE\s+\w+;/gi, '');
        
        // Remove DELIMITER blocks (stored procedures) as mysql2 doesn't support them directly
        schema = schema.replace(/DELIMITER\s+\/\/[\s\S]*?DELIMITER\s+;/gi, '');
        
        console.log('📝 Executing schema...');
        await connection.query(schema);
        console.log('✅ Schema executed successfully\n');

        // Verify tables were created
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? 
            ORDER BY TABLE_NAME
        `, [dbName]);

        console.log('📋 Created tables:');
        tables.forEach(row => {
            console.log(`   - ${row.TABLE_NAME}`);
        });

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\nNext steps:');
        console.log('  1. Run: npm run seed (to add sample data)');
        console.log('  2. Run: npm start (to start the server)');

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n💡 Check your MySQL credentials in .env file');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Make sure MySQL server is running');
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupDatabase();
