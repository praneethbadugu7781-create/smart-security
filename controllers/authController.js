/**
 * Authentication Controller
 * Handles login, logout, and session management.
 */

const { User } = require('../models');
const { logAuthEvent } = require('../middleware/auditLogger');
const config = require('../config/app.config');

/**
 * Render login page
 */
async function showLoginPage(req, res) {
    // If already logged in, redirect to appropriate dashboard
    if (req.session && req.session.user) {
        return res.redirect(getRedirectPath(req.session.user.role));
    }
    
    res.render('login', {
        title: 'Login - College Security System',
        error: req.query.error || null
    });
}

/**
 * Process login request
 */
async function login(req, res) {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }
        
        // Find user
        const user = await User.findByUsername(username.trim().toLowerCase());
        
        if (!user) {
            await logAuthEvent('LOGIN', null, username, req.ip, req.get('User-Agent'), false);
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }
        
        // Verify password
        const isValidPassword = await User.verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
            await logAuthEvent('LOGIN', user.id, username, req.ip, req.get('User-Agent'), false);
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }
        
        // Check if user is active
        if (!user.is_active) {
            await logAuthEvent('LOGIN', user.id, username, req.ip, req.get('User-Agent'), false);
            return res.status(403).json({
                success: false,
                error: 'Account is disabled. Contact administrator.'
            });
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
        
        // Update last login
        await User.updateLastLogin(user.id);
        
        // Log successful login
        await logAuthEvent('LOGIN', user.id, username, req.ip, req.get('User-Agent'), true);
        
        // Determine redirect path
        const redirectPath = getRedirectPath(user.role);
        
        return res.json({
            success: true,
            message: 'Login successful',
            user: {
                username: user.username,
                full_name: user.full_name,
                role: user.role
            },
            redirect: redirectPath
        });
        
    } catch (error) {
        console.error('[LOGIN ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
}

/**
 * Process logout request
 */
async function logout(req, res) {
    try {
        const userId = req.session?.user?.id;
        const username = req.session?.user?.username;
        
        // Log logout event
        if (userId) {
            await logAuthEvent('LOGOUT', userId, username, req.ip, req.get('User-Agent'), true);
        }
        
        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('[LOGOUT ERROR]', err);
            }
            res.redirect('/login');
        });
        
    } catch (error) {
        console.error('[LOGOUT ERROR]', error);
        res.redirect('/login');
    }
}

/**
 * Get current user info
 */
async function getCurrentUser(req, res) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }
    
    return res.json({
        success: true,
        user: req.session.user
    });
}

/**
 * Change password
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.user.id;
        
        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current and new password are required'
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 8 characters'
            });
        }
        
        // Get user with password
        const user = await User.findByUsername(req.session.user.username);
        
        // Verify current password
        const isValid = await User.verifyPassword(currentPassword, user.password_hash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }
        
        // Update password
        await User.update(userId, { password: newPassword });
        
        return res.json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('[CHANGE PASSWORD ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
}

/**
 * Get redirect path based on role
 */
function getRedirectPath(role) {
    switch (role) {
        case config.roles.SECURITY:
            return '/scan';
        case config.roles.ADMIN:
            return '/dashboard/admin';
        case config.roles.HOD:
            return '/dashboard/hod';
        case config.roles.WARDEN:
            return '/dashboard/warden';
        case config.roles.PRINCIPAL:
            return '/dashboard/principal';
        default:
            return '/';
    }
}

module.exports = {
    showLoginPage,
    login,
    logout,
    getCurrentUser,
    changePassword
};
