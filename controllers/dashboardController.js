/**
 * Dashboard Controller
 * Handles dashboard rendering and data for all roles.
 */

const { Student, EntryExitLog, PermissionLetter, RoamingLog, Alert } = require('../models');
const config = require('../config/app.config');

/**
 * Render security scan page
 */
async function showSecurityScanPage(req, res) {
    res.render('scan', {
        title: 'Security Scan - Gate Entry/Exit',
        user: req.session.user,
        config: {
            duplicateScanInterval: config.scan.duplicateScanInterval,
            soundEnabled: true
        }
    });
}

/**
 * Render admin dashboard
 */
async function showAdminDashboard(req, res) {
    try {
        // Default stats for dashboard
        const defaultStats = {
            total_entries: 0,
            total_exits: 0,
            roaming_incidents: 0,
            late_entries: 0,
            unauthorized_exits: 0,
            pending_alerts: 0,
            unique_students: 0
        };
        
        let stats = defaultStats;
        let recentLogs = [];
        let pendingAlerts = [];
        
        try {
            stats = await EntryExitLog.getDashboardStats({}) || defaultStats;
        } catch (e) {
            console.log('[Dashboard] Stats error, using defaults:', e.message);
        }
        
        try {
            recentLogs = await EntryExitLog.getRecentActivity(50) || [];
        } catch (e) {
            console.log('[Dashboard] Recent logs error:', e.message);
        }
        
        try {
            pendingAlerts = await Alert.getForUser(req.session.user, true) || [];
        } catch (e) {
            console.log('[Dashboard] Alerts error:', e.message);
        }
        
        res.render('dashboard/admin', {
            title: 'Admin Dashboard',
            user: req.session.user,
            stats,
            recentLogs,
            pendingAlerts,
            departments: config.departments || [],
            hostels: config.hostels || []
        });
    } catch (error) {
        console.error('[ADMIN DASHBOARD ERROR]', error);
        res.status(500).render('error', {
            message: 'Failed to load dashboard',
            description: error.message,
            statusCode: 500
        });
    }
}

/**
 * Render HOD dashboard (department-specific)
 */
async function showHODDashboard(req, res) {
    try {
        const departmentId = req.session.user.department_id;
        
        // Get department-specific stats
        const stats = await EntryExitLog.getDashboardStats({ departmentId });
        const recentLogs = await EntryExitLog.getTodayLogs({ departmentId, limit: 50 });
        const roamingIncidents = await RoamingLog.getUnresolvedForHOD(departmentId);
        const pendingAlerts = await Alert.getForUser(req.session.user, true);
        const unreadAlertCount = await Alert.getUnreadCount(req.session.user);
        
        // Get pending permission letters for verification
        const pendingPermissions = await PermissionLetter.getUnverified({ departmentId, limit: 20 });
        
        res.render('dashboard/hod', {
            title: `HOD Dashboard - ${req.session.user.department_name}`,
            user: req.session.user,
            stats,
            recentLogs,
            roamingIncidents,
            pendingAlerts,
            unreadAlertCount,
            pendingPermissions,
            departmentName: req.session.user.department_name
        });
    } catch (error) {
        console.error('[HOD DASHBOARD ERROR]', error);
        res.status(500).render('error', {
            message: 'Failed to load dashboard',
            description: error.message
        });
    }
}

/**
 * Render Warden dashboard (hostel-specific)
 */
async function showWardenDashboard(req, res) {
    try {
        const hostelId = req.session.user.hostel_id;
        
        // Get hostel-specific data
        const stats = await EntryExitLog.getDashboardStats({ hostelId });
        const recentLogs = await EntryExitLog.getTodayLogs({ 
            hostelId,
            studentType: 'hosteler',
            limit: 50 
        });
        const pendingAlerts = await Alert.getForUser(req.session.user, true);
        const unreadAlertCount = await Alert.getUnreadCount(req.session.user);
        
        // Get hostelers currently outside campus
        const hostelersOutside = await getHostelersOutside(hostelId);
        
        res.render('dashboard/warden', {
            title: `Warden Dashboard - ${req.session.user.hostel_name}`,
            user: req.session.user,
            stats,
            recentLogs,
            pendingAlerts,
            unreadAlertCount,
            hostelersOutside,
            hostelName: req.session.user.hostel_name
        });
    } catch (error) {
        console.error('[WARDEN DASHBOARD ERROR]', error);
        res.status(500).render('error', {
            message: 'Failed to load dashboard',
            description: error.message
        });
    }
}

/**
 * Render Principal dashboard (all access)
 */
async function showPrincipalDashboard(req, res) {
    try {
        // Get overall stats
        const stats = await EntryExitLog.getDashboardStats({});
        const roamingStats = await RoamingLog.getStats({});
        const recentLogs = await EntryExitLog.getRecentActivity(30);
        const pendingAlerts = await Alert.getForUser(req.session.user, true);
        const unreadAlertCount = await Alert.getUnreadCount(req.session.user);
        
        // Get escalated incidents
        const escalatedIncidents = await RoamingLog.getTodayIncidents({ isEscalated: true });
        
        // Department-wise summary
        const departmentSummary = await getDepartmentSummary();
        
        res.render('dashboard/principal', {
            title: 'Principal Dashboard',
            user: req.session.user,
            stats,
            roamingStats,
            recentLogs,
            pendingAlerts,
            unreadAlertCount,
            escalatedIncidents,
            departmentSummary,
            departments: config.departments,
            hostels: config.hostels
        });
    } catch (error) {
        console.error('[PRINCIPAL DASHBOARD ERROR]', error);
        res.status(500).render('error', {
            message: 'Failed to load dashboard',
            description: error.message
        });
    }
}

/**
 * Get live feed data for AJAX polling
 */
async function getLiveFeed(req, res) {
    try {
        const filters = {};
        const user = req.session.user;
        
        // Apply role-based filters
        if (user.role === 'hod') {
            filters.departmentId = user.department_id;
        } else if (user.role === 'warden') {
            filters.hostelId = user.hostel_id;
        }
        
        const limit = parseInt(req.query.limit) || 20;
        const since = req.query.since ? new Date(req.query.since) : null;
        
        let logs = await EntryExitLog.getRecentActivity(limit, filters);
        
        // Filter by since if provided
        if (since) {
            logs = logs.filter(log => new Date(log.event_timestamp) > since);
        }
        
        // Get pending alerts
        const alerts = await Alert.getForUser(user, true);
        const unreadCount = await Alert.getUnreadCount(user);
        
        // Get current stats
        const stats = await EntryExitLog.getDashboardStats(filters);
        
        res.json({
            success: true,
            logs: logs.map(formatLogForFeed),
            alerts: alerts.slice(0, 10),
            unreadAlertCount: unreadCount,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[LIVE FEED ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load live feed'
        });
    }
}

/**
 * Mark alert as read
 */
async function markAlertRead(req, res) {
    try {
        const alertId = parseInt(req.params.id);
        const userId = req.session.user.id;
        
        await Alert.markAsRead(alertId, userId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[MARK ALERT READ ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark alert as read'
        });
    }
}

/**
 * Mark alert as actioned
 */
async function markAlertActioned(req, res) {
    try {
        const alertId = parseInt(req.params.id);
        const { action } = req.body;
        const userId = req.session.user.id;
        
        await Alert.markAsActioned(alertId, userId, action || 'Acknowledged');
        
        res.json({ success: true });
    } catch (error) {
        console.error('[MARK ALERT ACTIONED ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to action alert'
        });
    }
}

/**
 * Resolve roaming incident
 */
async function resolveRoamingIncident(req, res) {
    try {
        const incidentId = parseInt(req.params.id);
        const { notes } = req.body;
        const userId = req.session.user.id;
        
        await RoamingLog.resolve(incidentId, userId, notes);
        
        res.json({ success: true, message: 'Incident resolved' });
    } catch (error) {
        console.error('[RESOLVE ROAMING ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve incident'
        });
    }
}

/**
 * Verify permission letter
 */
async function verifyPermission(req, res) {
    try {
        const permissionId = parseInt(req.params.id);
        const userId = req.session.user.id;
        
        await PermissionLetter.verify(permissionId, userId);
        
        res.json({ success: true, message: 'Permission verified' });
    } catch (error) {
        console.error('[VERIFY PERMISSION ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify permission'
        });
    }
}

/**
 * Invalidate permission letter
 */
async function invalidatePermission(req, res) {
    try {
        const permissionId = parseInt(req.params.id);
        const { reason } = req.body;
        
        await PermissionLetter.invalidate(permissionId, reason || 'Invalidated by administrator');
        
        res.json({ success: true, message: 'Permission invalidated' });
    } catch (error) {
        console.error('[INVALIDATE PERMISSION ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate permission'
        });
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get hostelers currently outside campus
 */
async function getHostelersOutside(hostelId) {
    const db = require('../config/database');
    const sql = `
        SELECT 
            s.id, s.roll_number, s.full_name, s.room_number,
            eel.event_timestamp AS left_at
        FROM students s
        JOIN (
            SELECT student_id, event_type, event_timestamp,
                   ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY event_timestamp DESC) as rn
            FROM entry_exit_logs
            WHERE DATE(event_timestamp) = CURDATE()
        ) eel ON s.id = eel.student_id AND eel.rn = 1
        WHERE s.hostel_id = ?
        AND s.student_type = 'hosteler'
        AND s.is_active = TRUE
        AND eel.event_type = 'exit'
        ORDER BY eel.event_timestamp DESC
    `;
    return await db.query(sql, [hostelId]);
}

/**
 * Get department-wise summary for principal
 */
async function getDepartmentSummary() {
    const db = require('../config/database');
    const sql = `
        SELECT 
            d.id, d.code, d.name,
            COUNT(DISTINCT CASE WHEN eel.event_type = 'entry' THEN eel.student_id END) AS entries_today,
            COUNT(DISTINCT CASE WHEN eel.event_type = 'exit' THEN eel.student_id END) AS exits_today,
            COUNT(DISTINCT CASE WHEN eel.event_type = 'roaming' THEN eel.student_id END) AS roaming_today
        FROM departments d
        LEFT JOIN students s ON d.id = s.department_id
        LEFT JOIN entry_exit_logs eel ON s.id = eel.student_id AND DATE(eel.event_timestamp) = CURDATE()
        GROUP BY d.id, d.code, d.name
        ORDER BY d.code
    `;
    return await db.query(sql, []);
}

/**
 * Format log entry for live feed
 */
function formatLogForFeed(log) {
    return {
        id: log.id,
        roll_number: log.roll_number,
        student_name: log.full_name,
        department: log.department_code,
        event_type: log.event_type,
        is_allowed: log.is_allowed,
        timestamp: log.event_timestamp,
        time_ago: getTimeAgo(log.event_timestamp),
        photo_url: log.photo_url,
        flags: {
            is_late: log.is_late_entry || log.is_late_return,
            requires_permission: log.requires_permission,
            has_permission: log.has_permission,
            alert_sent: log.alert_sent
        }
    };
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

module.exports = {
    showSecurityScanPage,
    showAdminDashboard,
    showHODDashboard,
    showWardenDashboard,
    showPrincipalDashboard,
    getLiveFeed,
    markAlertRead,
    markAlertActioned,
    resolveRoamingIncident,
    verifyPermission,
    invalidatePermission
};
