/**
 * Show Students Script for MySQL
 * Run: node scripts/show-students.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function showStudents() {
    // Database configuration
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'sarvani1530',
        database: process.env.DB_NAME || 'smart_gate'
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);

        // Show students
        console.log('\n=== Students in Database (first 20) ===\n');
        const [students] = await connection.query(
            'SELECT id, roll_number, full_name, email, department_id FROM students ORDER BY id DESC LIMIT 20'
        );
        students.forEach((row, i) => {
            console.log(`${i+1}. ${row.id} | ${row.roll_number} | ${row.full_name} | ${row.email} | Dept: ${row.department_id}`);
        });
        
        // Departments
        console.log('\n=== Departments ===\n');
        const [depts] = await connection.query('SELECT id, code, name FROM departments');
        depts.forEach(row => {
            console.log(`ID ${row.id}: ${row.code} - ${row.name}`);
        });
        
        // Count by department
        console.log('\n=== Student Count by Department ===\n');
        const [counts] = await connection.query(`
            SELECT d.code, COUNT(s.id) as count 
            FROM students s 
            LEFT JOIN departments d ON s.department_id = d.id 
            GROUP BY s.department_id 
            ORDER BY count DESC
        `);
        counts.forEach(row => {
            console.log(`${row.code}: ${row.count} students`);
        });
        
        // Total
        const [[total]] = await connection.query('SELECT COUNT(*) as count FROM students');
        console.log(`\nTotal Students: ${total.count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

showStudents();
