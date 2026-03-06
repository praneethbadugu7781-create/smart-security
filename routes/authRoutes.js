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
    
    try {
        // Check if admin exists
        const users = await db.query("SELECT * FROM users WHERE username = 'admin'");
        
        if (users && users.length > 0) {
            // Update password
            const hash = await bcrypt.hash('admin123', 10);
            await db.query("UPDATE users SET password_hash = ? WHERE username = 'admin'", [hash]);
            return res.send('Admin password reset to: admin123');
        }
        
        // Create admin user
        const hash = await bcrypt.hash('admin123', 10);
        await db.query(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
            ['admin', hash, 'System Administrator', 'admin']
        );
        
        res.send('Admin user created! Login: admin / admin123');
    } catch (error) {
        res.send('Error: ' + error.message);
    }
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
