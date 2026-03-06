/**
 * Seed Data Script for MySQL
 * Run: node scripts/seed-data.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedData() {
    console.log('🌱 Starting data seeding...\n');

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

        // Hash password
        const defaultPassword = await bcrypt.hash('password123', 12);

        // ============================================
        // 1. CREATE DEPARTMENTS
        // ============================================
        console.log('🏛️ Creating departments...');
        
        const departments = [
            { code: 'CSE', name: 'Computer Science & Engineering' },
            { code: 'ECE', name: 'Electronics & Communication Engineering' },
            { code: 'MECH', name: 'Mechanical Engineering' },
            { code: 'EEE', name: 'Electrical & Electronics Engineering' },
            { code: 'CIVIL', name: 'Civil Engineering' },
            { code: 'AIML', name: 'AI & Machine Learning' }
        ];

        for (const dept of departments) {
            await connection.query(
                `INSERT IGNORE INTO departments (code, name) VALUES (?, ?)`,
                [dept.code, dept.name]
            );
        }
        console.log(`   ✅ Created ${departments.length} departments\n`);

        // ============================================
        // 2. CREATE HOSTELS
        // ============================================
        console.log('🏠 Creating hostels...');
        
        const hostels = [
            { code: 'BHA', name: 'Boys Hostel A', type: 'boys', capacity: 200 },
            { code: 'BHB', name: 'Boys Hostel B', type: 'boys', capacity: 200 },
            { code: 'GH', name: 'Girls Hostel', type: 'girls', capacity: 150 }
        ];

        for (const hostel of hostels) {
            await connection.query(
                `INSERT IGNORE INTO hostels (code, name, type, capacity) VALUES (?, ?, ?, ?)`,
                [hostel.code, hostel.name, hostel.type, hostel.capacity]
            );
        }
        console.log(`   ✅ Created ${hostels.length} hostels\n`);

        // ============================================
        // 3. CREATE USERS
        // ============================================
        console.log('👥 Creating users...');
        
        // Get department IDs
        const [deptRows] = await connection.query('SELECT id, code FROM departments');
        const deptMap = {};
        deptRows.forEach(row => deptMap[row.code] = row.id);

        // Get hostel IDs
        const [hostelRows] = await connection.query('SELECT id, code FROM hostels');
        const hostelMap = {};
        hostelRows.forEach(row => hostelMap[row.code] = row.id);

        const users = [
            { username: 'admin', full_name: 'System Administrator', role: 'admin', email: 'admin@college.edu' },
            { username: 'security1', full_name: 'Main Gate Security', role: 'security', email: 'security@college.edu' },
            { username: 'hod_cse', full_name: 'Dr. Rajesh Kumar', role: 'hod', email: 'hod.cse@college.edu', department_id: deptMap['CSE'] },
            { username: 'hod_ece', full_name: 'Dr. Priya Sharma', role: 'hod', email: 'hod.ece@college.edu', department_id: deptMap['ECE'] },
            { username: 'hod_mech', full_name: 'Dr. Suresh Reddy', role: 'hod', email: 'hod.mech@college.edu', department_id: deptMap['MECH'] },
            { username: 'hod_aiml', full_name: 'Dr. Lakshmi Priya', role: 'hod', email: 'hod.aiml@college.edu', department_id: deptMap['AIML'] },
            { username: 'warden_boys', full_name: 'Mr. Venkat Rao', role: 'warden', email: 'warden.boys@college.edu', hostel_id: hostelMap['BHA'] },
            { username: 'warden_girls', full_name: 'Mrs. Lakshmi Devi', role: 'warden', email: 'warden.girls@college.edu', hostel_id: hostelMap['GH'] },
            { username: 'principal', full_name: 'Dr. K. Ramana Murthy', role: 'principal', email: 'principal@college.edu' }
        ];

        for (const user of users) {
            await connection.query(`
                INSERT INTO users (username, password_hash, full_name, role, email, department_id, hostel_id, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
                ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), email = VALUES(email)
            `, [
                user.username, 
                defaultPassword, 
                user.full_name, 
                user.role, 
                user.email, 
                user.department_id || null, 
                user.hostel_id || null
            ]);
        }
        console.log(`   ✅ Created ${users.length} users\n`);

        // ============================================
        // 4. CREATE SAMPLE STUDENTS
        // ============================================
        console.log('🎓 Creating students...');

        const sections = ['A', 'B', 'C'];
        const studentTypes = ['day_scholar', 'hosteler', 'bus'];
        const deptCodes = Object.keys(deptMap);

        let studentCount = 0;

        for (const deptCode of deptCodes) {
            for (let year = 1; year <= 4; year++) {
                for (const section of sections) {
                    for (let i = 1; i <= 5; i++) {
                        const yearCode = 24 - year;
                        const rollNum = `${yearCode}${deptCode}${String(year * 100 + (sections.indexOf(section) * 20) + i).padStart(3, '0')}`;
                        const type = studentTypes[Math.floor(Math.random() * studentTypes.length)];
                        const hostelId = type === 'hosteler' ? (Math.random() > 0.5 ? hostelMap['BHA'] : hostelMap['BHB']) : null;
                        
                        try {
                            await connection.query(`
                                INSERT IGNORE INTO students 
                                (roll_number, full_name, email, phone, student_type, department_id, year_of_study, section, hostel_id, room_number, is_active) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
                            `, [
                                rollNum,
                                `Student ${rollNum}`,
                                `${rollNum.toLowerCase()}@college.edu`,
                                `98765${String(studentCount).padStart(5, '0')}`,
                                type,
                                deptMap[deptCode],
                                year,
                                section,
                                hostelId,
                                type === 'hosteler' ? `${year}0${i}` : null
                            ]);
                            studentCount++;
                        } catch (err) {
                            // Ignore duplicate key errors
                        }
                    }
                }
            }
        }
        console.log(`   ✅ Created ${studentCount} students\n`);

        // ============================================
        // 5. CREATE SAMPLE ENTRY/EXIT LOGS
        // ============================================
        console.log('📋 Creating sample logs...');

        const [studentResult] = await connection.query('SELECT id, roll_number, student_type FROM students LIMIT 50');
        
        const today = new Date();
        today.setHours(8, 30, 0, 0);

        let logCount = 0;
        for (const row of studentResult) {
            const entryTime = new Date(today);
            entryTime.setMinutes(entryTime.getMinutes() + Math.floor(Math.random() * 60));
            const isLate = entryTime.getHours() >= 9;
            
            try {
                await connection.query(`
                    INSERT INTO entry_exit_logs 
                    (student_id, roll_number, event_type, event_timestamp, is_allowed, student_type, is_late_entry, scanned_by_user_id)
                    VALUES (?, ?, 'entry', ?, TRUE, ?, ?, 2)
                `, [
                    row.id,
                    row.roll_number,
                    entryTime.toISOString().slice(0, 19).replace('T', ' '),
                    row.student_type,
                    isLate
                ]);
                logCount++;
            } catch (err) {
                // Ignore errors
            }
        }
        console.log(`   ✅ Created ${logCount} sample entry logs\n`);

        // ============================================
        // SUMMARY
        // ============================================
        console.log('🎉 Data seeding completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   - Departments: ${departments.length}`);
        console.log(`   - Hostels: ${hostels.length}`);
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Students: ${studentCount}`);
        console.log(`   - Sample logs: ${logCount}`);
        
        console.log('\n🔐 Login Credentials:');
        console.log('   All users have password: password123');
        console.log('\n   Usernames:');
        users.forEach(u => console.log(`   - ${u.username} (${u.role})`));

        console.log('\n🚀 Start the server with: npm start');

    } catch (error) {
        console.error('❌ Error seeding data:', error.message);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.error('\n💡 Run "npm run setup-db" first to create tables');
        }
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

seedData();
