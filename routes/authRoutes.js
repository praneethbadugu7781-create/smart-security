/**
 * Authentication Routes
 * Handles login, logout, and session management endpoints.
 */

const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { asyncHandler } = require('../middleware');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

/**
 * GET /login
 * Render login page
 */
router.get('/login', asyncHandler(authController.showLoginPage));

/**
 * POST /login
 * Traditional form-based login (fallback for mobile)
 */
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.redirect('/login?error=Please enter username and password');
    }
    
    const { User } = require('../models');
    const user = await User.findByUsername(username.trim().toLowerCase());
    
    if (!user || !(await User.verifyPassword(password, user.password_hash))) {
        return res.redirect('/login?error=Invalid username or password');
    }
    
    if (!user.is_active) {
        return res.redirect('/login?error=Account disabled');
    }
    
    // Create session
    req.session.user = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        hostel_id: user.hostel_id,
        hostel_name: user.hostel_name
    };
    
    // Redirect based on role
    const config = require('../config/app.config');
    let redirect = '/';
    if (user.role === 'security') redirect = '/scan';
    else if (user.role === 'admin') redirect = '/dashboard/admin';
    else if (user.role === 'hod') redirect = '/dashboard/hod';
    else if (user.role === 'warden') redirect = '/dashboard/warden';
    else if (user.role === 'principal') redirect = '/dashboard/principal';
    
    return res.redirect(redirect);
}));

/**
 * POST /api/auth/login
 * Process login request
 */
router.post('/api/auth/login', asyncHandler(authController.login));

/**
 * GET /setup-admin
 * Emergency route to create admin user if none exists
 */
router.get('/setup-admin', asyncHandler(async (req, res) => {
    const bcrypt = require('bcryptjs');
    const db = require('../config/database');
    
    let output = '<h2>Setup Admin</h2>';
    
    try {
        // Test DB connection
        output += '<p>Testing database connection...</p>';
        
        // Check tables
        const tables = await db.query("SHOW TABLES");
        output += `<p>Tables found: ${JSON.stringify(tables.map(t => Object.values(t)[0]))}</p>`;
        
        // Check if users table exists
        const usersTable = tables.find(t => Object.values(t)[0] === 'users');
        if (!usersTable) {
            output += '<p style="color:red">Users table not found! Creating...</p>';
            await db.query(`
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
            output += '<p style="color:green">Users table created!</p>';
        }
        
        // Check for admin user
        const users = await db.query("SELECT id, username, role FROM users");
        output += `<p>Existing users: ${JSON.stringify(users)}</p>`;
        
        // Create/update admin
        const hash = await bcrypt.hash('admin123', 10);
        output += `<p>Generated hash: ${hash.substring(0, 20)}...</p>`;
        
        const adminExists = users.find(u => u.username === 'admin');
        
        if (adminExists) {
            await db.query("UPDATE users SET password_hash = ?, is_active = 1 WHERE username = 'admin'", [hash]);
            output += '<p style="color:green">Admin password updated to: admin123</p>';
        } else {
            await db.query(
                "INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)",
                ['admin', hash, 'System Administrator', 'admin', 1]
            );
            output += '<p style="color:green">Admin user created!</p>';
        }
        
        // Verify
        const verifyUsers = await db.query("SELECT id, username, role, is_active FROM users WHERE username = 'admin'");
        output += `<p>Verified admin: ${JSON.stringify(verifyUsers)}</p>`;
        
        output += '<h3 style="color:green">Login with: admin / admin123</h3>';
        output += '<p><a href="/login">Go to Login</a></p>';
        
    } catch (error) {
        output += `<p style="color:red">Error: ${error.message}</p>`;
        output += `<pre>${error.stack}</pre>`;
    }
    
    res.send(output);
}));

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================

/**
 * POST /api/auth/logout
 * Process logout request
 */
router.post('/api/auth/logout', asyncHandler(authController.logout));

/**
 * GET /logout
 * Logout and redirect
 */
router.get('/logout', asyncHandler(authController.logout));

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/api/auth/me', asyncHandler(authController.getCurrentUser));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/api/auth/change-password', asyncHandler(authController.changePassword));

module.exports = router;
