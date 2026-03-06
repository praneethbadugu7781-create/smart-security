/**
 * Routes Index
 * Combines all route modules for the application.
 */

const express = require('express');
const authRoutes = require('./authRoutes');
const scanRoutes = require('./scanRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const studentRoutes = require('./studentRoutes');
const reportRoutes = require('./reportRoutes');

/**
 * Register all routes on the Express app
 * @param {express.Application} app - Express application instance
 */
function registerRoutes(app) {
    // Quick test login - direct route for mobile
    app.get('/quick-login', (req, res) => {
        const { User } = require('../models');
        
        // Auto-login as security1
        User.findByUsername('security1').then(user => {
            if (user) {
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
                res.redirect('/scan');
            } else {
                res.send('User not found');
            }
        }).catch(err => {
            res.send('Error: ' + err.message);
        });
    });

    // Authentication routes (login, logout)
    app.use('/', authRoutes);
    
    // Scan routes (barcode processing)
    app.use('/', scanRoutes);
    
    // Dashboard routes (all role dashboards)
    app.use('/', dashboardRoutes);
    
    // Student management routes
    app.use('/', studentRoutes);
    
    // Report routes
    app.use('/', reportRoutes);
    
    // Root redirect
    app.get('/', (req, res) => {
        if (req.session && req.session.user) {
            return res.redirect('/dashboard');
        }
        return res.redirect('/login');
    });
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });
}

module.exports = {
    registerRoutes,
    authRoutes,
    scanRoutes,
    dashboardRoutes,
    studentRoutes,
    reportRoutes
};
