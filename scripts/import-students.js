/**
 * Student Import Script for MySQL
 * Imports students from CSV file exported from Excel
 * 
 * Usage: node scripts/import-students.js <csv_file>
 * Example: node scripts/import-students.js AIML.csv
 * 
 * CSV Format (from your Excel):
 * Sl.No, Regd No, Student Name, Student No (phone), Email ID
 * 
 * Roll Number Format: 24H71A6101
 * - 24 = Batch year (2024)
 * - H71 = College code
 * - A61 = Department (AIML)
 * - 01 = Student serial
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Department code mapping from roll number
// Format: 24H71A6101 -> A61 = AIML
const DEPT_CODES = {
    'A61': { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
    'A62': { code: 'AIDS', name: 'Artificial Intelligence & Data Science' },
    'A66': { code: 'IT', name: 'Information Technology' },
    'A01': { code: 'CE', name: 'Civil Engineering' },
    'A02': { code: 'EEE', name: 'Electrical & Electronics Engineering' },
    'A03': { code: 'ECE', name: 'Electronics & Communication Engineering' },
    'A04': { code: 'CSE', name: 'Computer Science & Engineering' },
    'A05': { code: 'MECH', name: 'Mechanical Engineering' },
};

async function importStudents() {
    console.log('📥 Student Import Script (MySQL)\n');
    console.log('=========================================\n');

    // Get CSV file from argument or use default
    const csvArg = process.argv[2] || 'students.csv';
    
    // Check if it's an absolute path or relative
    let csvPath;
    if (path.isAbsolute(csvArg)) {
        csvPath = csvArg;
    } else {
        csvPath = path.join(__dirname, '..', 'data', csvArg);
    }

    // Check if CSV exists
    if (!fs.existsSync(csvPath)) {
        console.log(`❌ File not found: ${csvPath}\n`);
        console.log('To import students:');
        console.log('1. Open your Excel file');
        console.log('2. Click "Enable Editing"');
        console.log('3. Go to File → Save As');
        console.log('4. Save to: c:\\college smart security\\data\\');
        console.log('5. Format: CSV (Comma delimited)');
        console.log('6. Run: npm run import <filename.csv>');
        process.exit(1);
    }

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
        console.log(`📡 Connecting to MySQL database: ${config.database}...`);
        connection = await mysql.createConnection(config);
        console.log('✅ Connected\n');

        // Ensure all departments exist
        for (const [, dept] of Object.entries(DEPT_CODES)) {
            await connection.query(
                'INSERT IGNORE INTO departments (code, name) VALUES (?, ?)', 
                [dept.code, dept.name]
            );
        }

        // Get department IDs
        const [deptResult] = await connection.query('SELECT id, code FROM departments');
        const deptMap = {};
        deptResult.forEach(row => deptMap[row.code] = row.id);

        // Read CSV
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        console.log(`📄 Reading: ${csvPath}`);
        console.log(`   ${lines.length} lines found\n`);

        let imported = 0;
        let skipped = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Parse CSV
            const fields = parseCSV(line);
            if (fields.length < 3) continue;

            // Extract fields: Sl.No, Regd No, Student Name, Student No, Email
            const rollNumber = fields[1]?.trim();
            const fullName = fields[2]?.trim();
            const phone = fields[3]?.trim().replace(/[^0-9]/g, '') || null;
            const email = fields[4]?.trim() || null;

            // Skip headers and invalid rows
            if (!rollNumber || !fullName) continue;
            if (rollNumber.toLowerCase().includes('regd') || rollNumber.toLowerCase().includes('reg')) continue;
            if (!/^\d{2}[A-Z]\d{2}[A-Z]\d{2}\d+$/i.test(rollNumber)) continue;

            // Extract department from roll number (e.g., 24H71A6101 -> A61)
            const deptCodeMatch = rollNumber.match(/[A-Z](\d{2})([A-Z]\d{2})/i);
            let departmentId = deptMap['CSE'] || 1;
            let deptName = 'CSE';
            
            if (deptCodeMatch) {
                const deptKey = deptCodeMatch[2].toUpperCase();
                const deptInfo = DEPT_CODES[deptKey];
                if (deptInfo && deptMap[deptInfo.code]) {
                    departmentId = deptMap[deptInfo.code];
                    deptName = deptInfo.code;
                }
            }

            // Calculate year of study from batch year
            const batchYear = parseInt(rollNumber.substring(0, 2));
            const currentYear = new Date().getFullYear();
            const admissionYear = 2000 + batchYear;
            const yearOfStudy = Math.min(4, Math.max(1, currentYear - admissionYear + 1));

            // Default student type (can be updated later via admin panel)
            const studentType = 'day_scholar';

            // Insert student (INSERT IGNORE to skip duplicates)
            await connection.query(`
                INSERT INTO students 
                (roll_number, full_name, email, phone, student_type, department_id, year_of_study, section, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'A', TRUE)
                ON DUPLICATE KEY UPDATE 
                    full_name = VALUES(full_name), 
                    email = VALUES(email), 
                    phone = VALUES(phone)
            `, [rollNumber, fullName, email, phone, studentType, departmentId, yearOfStudy]);

            imported++;
        }

        console.log('✅ Import complete!\n');
        console.log(`   Imported: ${imported} students`);
        console.log(`   Skipped: ${skipped} rows\n`);

        // Show total students
        const [[countResult]] = await connection.query('SELECT COUNT(*) as total FROM students');
        console.log(`📊 Total students in database: ${countResult.total}\n`);

        // Show samples
        console.log('📋 Sample students:');
        const [samples] = await connection.query(`
            SELECT s.roll_number, s.full_name, d.code, s.student_type 
            FROM students s 
            JOIN departments d ON s.department_id = d.id 
            ORDER BY s.id DESC LIMIT 5
        `);
        samples.forEach(row => {
            console.log(`   ${row.roll_number} - ${row.full_name} (${row.code}, ${row.student_type})`);
        });

        console.log('\n🔍 These roll numbers are the barcodes to scan!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.error('\n💡 Run "npm run setup-db" first to create tables');
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

function parseCSV(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

importStudents();
