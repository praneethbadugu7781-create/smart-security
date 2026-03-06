/**
 * Import Students from Excel File
 * Reads the multi-sheet Excel file and imports all students
 * Run: node scripts/import-from-excel.js
 */

const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

const EXCEL_FILE = 'c:\\Users\\Lenovo\\Downloads\\aiml.csv.xlsx';

async function importStudents() {
    console.log('📊 Starting Excel Import...\n');

    // Database config
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'sarvani1530',
        database: process.env.DB_NAME || 'smart_gate'
    };

    let connection;
    try {
        // Connect to database
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to MySQL\n');

        // Read Excel file
        console.log(`📁 Reading: ${EXCEL_FILE}`);
        const workbook = xlsx.readFile(EXCEL_FILE);
        console.log(`   Found ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}\n`);

        // Clear existing data
        console.log('🗑️ Clearing existing students and related data...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DELETE FROM entry_exit_logs');
        await connection.query('DELETE FROM roaming_logs');
        await connection.query('DELETE FROM permission_letters');
        await connection.query('DELETE FROM alerts');
        await connection.query('DELETE FROM students');
        await connection.query('DELETE FROM departments');
        await connection.query('DELETE FROM hostels');
        await connection.query('ALTER TABLE students AUTO_INCREMENT = 1');
        await connection.query('ALTER TABLE departments AUTO_INCREMENT = 1');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('   ✅ Cleared\n');

        // Create departments from sheet names
        console.log('🏛️ Creating departments from sheets...');
        const deptMap = {};
        
        const deptFullNames = {
            'CE': 'Civil Engineering',
            'EEE': 'Electrical & Electronics Engineering',
            'ME': 'Mechanical Engineering',
            'AIDS': 'Artificial Intelligence & Data Science',
            'AIML': 'Artificial Intelligence & Machine Learning',
            'ECE': 'Electronics & Communication Engineering',
            'CSE': 'Computer Science & Engineering',
            'IT': 'Information Technology'
        };

        for (const sheetName of workbook.SheetNames) {
            const fullName = deptFullNames[sheetName] || sheetName;
            const [result] = await connection.query(
                'INSERT INTO departments (code, name) VALUES (?, ?)',
                [sheetName, fullName]
            );
            deptMap[sheetName] = result.insertId;
            console.log(`   ✅ ${sheetName} - ${fullName}`);
        }
        console.log('');

        // Create default hostels
        console.log('🏠 Creating hostels...');
        const hostels = [
            { code: 'BHA', name: 'Boys Hostel A', type: 'boys', capacity: 300 },
            { code: 'BHB', name: 'Boys Hostel B', type: 'boys', capacity: 300 },
            { code: 'GHA', name: 'Girls Hostel A', type: 'girls', capacity: 200 },
            { code: 'GHB', name: 'Girls Hostel B', type: 'girls', capacity: 200 }
        ];
        for (const h of hostels) {
            await connection.query(
                'INSERT INTO hostels (code, name, type, capacity) VALUES (?, ?, ?, ?)',
                [h.code, h.name, h.type, h.capacity]
            );
        }
        console.log('   ✅ Created 4 hostels\n');

        // Import students from each sheet
        let totalImported = 0;
        
        for (const sheetName of workbook.SheetNames) {
            console.log(`\n📋 Processing sheet: ${sheetName}`);
            
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            
            // Find header row (contains 'Regd No' or 'Student Name')
            let headerRow = -1;
            for (let i = 0; i < Math.min(10, data.length); i++) {
                const row = data[i];
                if (row && row.some(cell => 
                    cell && (
                        String(cell).toLowerCase().includes('regd') || 
                        String(cell).toLowerCase().includes('roll') ||
                        String(cell).toLowerCase().includes('student name')
                    )
                )) {
                    headerRow = i;
                    break;
                }
            }
            
            if (headerRow === -1) {
                console.log(`   ⚠️ Could not find header row, skipping...`);
                continue;
            }
            
            const headers = data[headerRow];
            console.log(`   Headers at row ${headerRow + 1}: ${headers.filter(h => h).join(', ')}`);
            
            // Find column indices
            let regdCol = -1, nameCol = -1, phoneCol = -1, emailCol = -1;
            
            headers.forEach((h, i) => {
                if (!h) return;
                const header = String(h).toLowerCase();
                if (header.includes('regd') || header.includes('roll')) regdCol = i;
                if (header.includes('student name') || header === 'name') nameCol = i;
                if (header.includes('student no') || header.includes('phone') || header.includes('mobile')) phoneCol = i;
                if (header.includes('email')) emailCol = i;
            });
            
            console.log(`   Column mapping: Regd=${regdCol}, Name=${nameCol}, Phone=${phoneCol}, Email=${emailCol}`);
            
            if (regdCol === -1 || nameCol === -1) {
                console.log(`   ⚠️ Missing required columns, skipping...`);
                continue;
            }
            
            // Determine year from roll number pattern
            // e.g., 24H71A0101 -> 24 means 2024 admission -> 1st year (assuming current year 2026)
            
            let sheetImported = 0;
            
            for (let i = headerRow + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || !row[regdCol]) continue;
                
                const rollNumber = String(row[regdCol]).trim().toUpperCase();
                const fullName = row[nameCol] ? String(row[nameCol]).trim() : '';
                const phone = row[phoneCol] ? String(row[phoneCol]).replace(/\D/g, '').slice(-10) : '';
                const email = row[emailCol] ? String(row[emailCol]).trim() : '';
                
                if (!rollNumber || !fullName || rollNumber.toLowerCase().includes('regd')) continue;
                
                // Extract year from roll number (first 2 digits)
                const yearMatch = rollNumber.match(/^(\d{2})/);
                let yearOfStudy = 1;
                if (yearMatch) {
                    const admissionYear = 2000 + parseInt(yearMatch[1]);
                    const currentYear = new Date().getFullYear();
                    yearOfStudy = Math.min(4, Math.max(1, currentYear - admissionYear + 1));
                }
                
                // Default section A
                const section = 'A';
                
                // All students as day_scholar by default (can be updated later)
                const studentType = 'day_scholar';
                
                try {
                    await connection.query(
                        `INSERT INTO students 
                         (roll_number, full_name, email, phone, student_type, department_id, year_of_study, section, is_active)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                        [rollNumber, fullName, email || null, phone || null, studentType, deptMap[sheetName], yearOfStudy, section]
                    );
                    sheetImported++;
                } catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        console.log(`   ⚠️ Duplicate: ${rollNumber}`);
                    } else {
                        console.log(`   ❌ Error for ${rollNumber}: ${err.message}`);
                    }
                }
            }
            
            console.log(`   ✅ Imported ${sheetImported} students from ${sheetName}`);
            totalImported += sheetImported;
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ IMPORT COMPLETE: ${totalImported} students imported`);
        console.log('='.repeat(50));

        // Show summary
        const [summary] = await connection.query(`
            SELECT d.code, d.name, COUNT(s.id) as count 
            FROM departments d 
            LEFT JOIN students s ON s.department_id = d.id 
            GROUP BY d.id 
            ORDER BY d.code
        `);
        
        console.log('\n📊 Summary by department:');
        summary.forEach(row => {
            console.log(`   ${row.code}: ${row.count} students`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

importStudents().catch(console.error);
