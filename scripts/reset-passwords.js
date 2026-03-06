/**
 * Reset all user passwords to 'admin123'
 */
const bcrypt = require('bcrypt');
const db = require('../config/database');

async function resetPasswords() {
    try {
        // Create new hash for 'admin123'
        const newHash = await bcrypt.hash('admin123', 10);
        console.log('New hash created for password: admin123');
        
        // Update all users
        await db.query('UPDATE users SET password_hash = ?', [newHash]);
        console.log('All user passwords reset to: admin123');
        
        // Verify
        const users = await db.query('SELECT username, role FROM users');
        console.log('\nUsers that can now login with admin123:');
        users.forEach(u => console.log(`  - ${u.username} (${u.role})`));
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

resetPasswords();
