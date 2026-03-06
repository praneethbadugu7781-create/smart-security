const mysql = require('mysql2/promise');

async function fixAIDept() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'sarvani1530',
        database: 'smart_gate'
    });
    
    try {
        // Check current state
        const [depts] = await conn.query("SELECT * FROM departments WHERE code IN ('AIDS', 'AIML')");
        console.log('Current AI departments:', depts);
        
        // Update AIDS department to AI
        await conn.query("UPDATE departments SET code = 'AI', name = 'Artificial Intelligence' WHERE code = 'AIDS'");
        console.log('Updated AIDS to AI');
        
        // Move all AIML students to AI department (which was AIDS, id=4)
        const [result] = await conn.query("UPDATE students SET department_id = 4 WHERE department_id = 5");
        console.log('Moved AIML students to AI:', result.affectedRows);
        
        // Delete AIML department
        await conn.query("DELETE FROM departments WHERE code = 'AIML'");
        console.log('Deleted AIML department');
        
        // Verify
        const [newDepts] = await conn.query("SELECT * FROM departments");
        console.log('Updated departments:', newDepts);
        
        const [counts] = await conn.query("SELECT d.code, COUNT(s.id) as student_count FROM departments d LEFT JOIN students s ON d.id = s.department_id GROUP BY d.id, d.code");
        console.log('Student counts by department:', counts);
        
    } finally {
        await conn.end();
    }
}

fixAIDept().catch(console.error);
