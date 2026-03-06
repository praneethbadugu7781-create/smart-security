/**
 * ============================================================
 * Smart Main Gate Entry-Exit & Campus Discipline System
 * ============================================================
 * 
 * Main Application Entry Point
 * 
 * This is a production-ready web-based security system for college
 * gate entry/exit management with:
 * - Pure web camera barcode scanning
 * - Role-based access control
 * - Real-time dashboard updates
 * - Automatic rule validation
 * - No submit buttons (auto-process scans)
 * 
 * Tech Stack:
 * - Node.js + Express.js
 * - MySQL for permanent storage
 * - Session-based authentication
 * - Vanilla JavaScript frontend
 * 
 * ============================================================
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Internal modules
const config = require('./config/app.config');
const db = require('./config/database');
const { registerRoutes } = require('./routes');
const { 
    attachUser, 
    attachTimeContext, 
    auditMiddleware,
    notFoundHandler, 
    errorHandler 
} = require('./middleware');

// ==========================================
// EXPRESS APP INITIALIZATION
// ==========================================

const app = express();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet for security headers (with CSP configured for camera access)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
            scriptSrcAttr: ["'unsafe-inline'"],  // Allow onclick handlers
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'"],
            formAction: ["'self'"],
            // Allow camera access
            // Note: Camera requires HTTPS in production
        }
    },
    crossOriginEmbedderPolicy: false,  // Required for camera
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));

// ==========================================
// PERFORMANCE MIDDLEWARE
// ==========================================

// Gzip compression
app.use(compression());

// ==========================================
// LOGGING
// ==========================================

// HTTP request logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
        skip: (req, res) => req.path === '/health'
    }));
}

// ==========================================
// BODY PARSING
// ==========================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// SESSION CONFIGURATION
// ==========================================

// Memory session store (for development/small deployments)
// For production with multiple servers, use Redis or similar
app.use(session({
    ...config.session
}));

// ==========================================
// VIEW ENGINE
// ==========================================

// Using EJS for server-side rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// STATIC FILES
// ==========================================

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// Serve uploaded files (permission letters)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: 0  // No caching for uploads
}));

// ==========================================
// GLOBAL MIDDLEWARE
// ==========================================

// Attach user from session to request
app.use(attachUser);

// Attach time context for rule validation
app.use(attachTimeContext);

// Audit logging
app.use(auditMiddleware);

// ==========================================
// ROUTES
// ==========================================

registerRoutes(app);

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ==========================================
// DIRECTORY SETUP
// ==========================================

// Ensure upload directories exist
const uploadDirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'permission_letters')
];

for (const dir of uploadDirs) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[SETUP] Created directory: ${dir}`);
    }
}

// ==========================================
// SERVER STARTUP
// ==========================================

async function startServer() {
    try {
        // Test database connection
        const dbConnected = await db.testConnection();
        if (!dbConnected) {
            console.error('[FATAL] Cannot start server without database connection');
            process.exit(1);
        }

        // Start HTTP server
        const PORT = config.server.port;
        const HOST = config.server.host;

        app.listen(PORT, HOST, () => {
            console.log('');
            console.log('============================================================');
            console.log('  Smart Main Gate Entry-Exit & Campus Discipline System');
            console.log('============================================================');
            console.log('');
            console.log(`  Server running at: http://${HOST}:${PORT}`);
            console.log(`  Environment: ${config.server.env}`);
            console.log('');
            console.log('  Endpoints:');
            console.log(`    - Login:      http://${HOST}:${PORT}/login`);
            console.log(`    - Scan:       http://${HOST}:${PORT}/scan (Security only)`);
            console.log(`    - Dashboard:  http://${HOST}:${PORT}/dashboard`);
            console.log(`    - Health:     http://${HOST}:${PORT}/health`);
            console.log('');
            console.log('  Default credentials (CHANGE IN PRODUCTION):');
            console.log('    - Admin:     admin / admin123');
            console.log('    - Security:  security1 / admin123');
            console.log('    - Principal: principal / admin123');
            console.log('');
            console.log('============================================================');
            console.log('');
        });

    } catch (error) {
        console.error('[FATAL] Server startup failed:', error);
        process.exit(1);
    }
}

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] SIGTERM received, shutting down gracefully...');
    
    // Close database connection
    db.close();
    
    console.log('[SHUTDOWN] Cleanup complete');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[SHUTDOWN] SIGINT received, shutting down gracefully...');
    
    db.close();
    
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// ==========================================
// START APPLICATION
// ==========================================

startServer();

module.exports = app;
