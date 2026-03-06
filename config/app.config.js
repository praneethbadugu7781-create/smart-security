/**
 * Smart Main Gate Entry-Exit & Campus Discipline System
 * Application Configuration
 * 
 * Central configuration for all environment-specific settings.
 * All time values are in milliseconds unless otherwise specified.
 */

module.exports = {
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0',
        env: process.env.NODE_ENV || 'development'
    },
    
    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'college-security-super-secret-key-change-in-production',
        name: 'college_security_sid',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
            httpOnly: true,                                  // Prevent XSS
            maxAge: 12 * 60 * 60 * 1000,                    // 12 hours
            sameSite: 'strict'                              // CSRF protection
        }
    },
    
    // College timing configuration (24-hour format, IST)
    collegeTiming: {
        // Regular class hours
        classStartTime: '09:00',      // 9:00 AM
        classEndTime: '16:30',        // 4:30 PM
        
        // Morning entry window
        morningEntryStart: '07:00',   // 7:00 AM
        morningEntryEnd: '10:00',     // 10:00 AM - late entry after this
        
        // Evening exit window (normal allowed exit)
        eveningExitStart: '16:00',    // 4:00 PM
        eveningExitEnd: '18:00',      // 6:00 PM
        
        // Hostel curfew time
        hostelCurfew: '21:00',        // 9:00 PM
        
        // Weekend days (0 = Sunday, 6 = Saturday)
        weekendDays: [0],             // Only Sunday is weekend
        
        // Break times (no roaming alerts during these)
        breaks: [
            { start: '10:30', end: '10:45', name: 'Short Break' },
            { start: '12:30', end: '13:30', name: 'Lunch Break' },
            { start: '15:00', end: '15:15', name: 'Tea Break' }
        ]
    },
    
    // Scan configuration
    scan: {
        // Minimum time between duplicate scans for same student (milliseconds)
        duplicateScanInterval: 30000,     // 30 seconds
        
        // Time window to pair entry-exit as single trip (milliseconds)
        tripPairingWindow: 60000,         // 1 minute
        
        // Maximum time for permission letter validity (hours)
        permissionLetterValidityHours: 8,
        
        // Roaming detection: time between scans that triggers roaming alert
        roamingDetectionMinutes: 15,
        
        // Number of roaming incidents before auto-escalation
        roamingEscalationThreshold: 3
    },
    
    // Upload configuration  
    upload: {
        // Permission letter photos
        permissionLetterPath: './uploads/permission_letters/',
        
        // Maximum file size (bytes)
        maxFileSize: 5 * 1024 * 1024,     // 5 MB
        
        // Allowed MIME types
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    },
    
    // Role definitions
    roles: {
        SECURITY: 'security',
        ADMIN: 'admin',
        HOD: 'hod',
        WARDEN: 'warden',
        PRINCIPAL: 'principal'
    },
    
    // Student types
    studentTypes: {
        DAY_SCHOLAR: 'day_scholar',
        HOSTELER: 'hosteler',
        BUS: 'bus'
    },
    
    // Entry-Exit event types
    eventTypes: {
        ENTRY: 'entry',
        EXIT: 'exit',
        ROAMING: 'roaming'
    },
    
    // Real-time notification settings
    notifications: {
        // How often to check for new alerts (milliseconds)
        pollInterval: 2000,               // 2 seconds
        
        // Dashboard auto-refresh interval (milliseconds)
        dashboardRefreshInterval: 5000    // 5 seconds
    },
    
    // Departments list (customize for your college)
    departments: [
        { code: 'CSE', name: 'Computer Science & Engineering' },
        { code: 'ECE', name: 'Electronics & Communication Engineering' },
        { code: 'EEE', name: 'Electrical & Electronics Engineering' },
        { code: 'ME', name: 'Mechanical Engineering' },
        { code: 'CE', name: 'Civil Engineering' },
        { code: 'AI', name: 'Artificial Intelligence' },
        { code: 'IT', name: 'Information Technology' },
        { code: 'MBA', name: 'Master of Business Administration' },
        { code: 'MCA', name: 'Master of Computer Applications' }
    ],
    
    // Hostels list (customize for your college)
    hostels: [
        { code: 'BH1', name: 'Boys Hostel 1', type: 'boys' },
        { code: 'BH2', name: 'Boys Hostel 2', type: 'boys' },
        { code: 'GH1', name: 'Girls Hostel 1', type: 'girls' },
        { code: 'GH2', name: 'Girls Hostel 2', type: 'girls' }
    ]
};
