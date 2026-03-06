/**
 * Reports Controller
 * Generates various reports for dashboards.
 */

const db = require('../config/database');
const { EntryExitLog, RoamingLog, PermissionLetter } = require('../models');

/**
 * Get daily summary report
 */
async function getDailySummary(req, res) {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const filters = {};
        
        // Apply role-based filters
        if (req.session.user.role === 'hod') {
            filters.departmentId = req.session.user.department_id;
        } else if (req.session.user.role === 'warden') {
            filters.hostelId = req.session.user.hostel_id;
        }
        
        // Build where clause
        let whereClause = `DATE(eel.event_timestamp) = ?`;
        const params = [date];
        
        if (filters.departmentId) {
            whereClause += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        if (filters.hostelId) {
            whereClause += ' AND s.hostel_id = ?';
            params.push(filters.hostelId);
        }
        
        // Get summary stats
        const summarySql = `
            SELECT 
                COUNT(*) AS total_scans,
                COUNT(DISTINCT eel.student_id) AS unique_students,
                COUNT(CASE WHEN eel.event_type = 'entry' THEN 1 END) AS entries,
                COUNT(CASE WHEN eel.event_type = 'exit' THEN 1 END) AS exits,
                COUNT(CASE WHEN eel.event_type = 'roaming' THEN 1 END) AS roaming,
                COUNT(CASE WHEN eel.is_late_entry = TRUE THEN 1 END) AS late_entries,
                COUNT(CASE WHEN eel.is_late_return = TRUE THEN 1 END) AS late_returns,
                COUNT(CASE WHEN eel.requires_permission = TRUE THEN 1 END) AS required_permissions,
                COUNT(CASE WHEN eel.requires_permission = TRUE AND eel.has_permission = TRUE THEN 1 END) AS had_permissions,
                COUNT(CASE WHEN eel.is_allowed = FALSE THEN 1 END) AS denied
            FROM entry_exit_logs eel
            JOIN students s ON eel.student_id = s.id
            WHERE ${whereClause}
        `;
        
        const summaryResult = await db.query(summarySql, params);
        
        // Get hourly breakdown
        const hourlySql = `
            SELECT 
                HOUR(eel.event_timestamp) AS hour,
                COUNT(CASE WHEN eel.event_type = 'entry' THEN 1 END) AS entries,
                COUNT(CASE WHEN eel.event_type = 'exit' THEN 1 END) AS exits
            FROM entry_exit_logs eel
            JOIN students s ON eel.student_id = s.id
            WHERE ${whereClause}
            GROUP BY HOUR(eel.event_timestamp)
            ORDER BY hour
        `;
        
        const hourlyResult = await db.query(hourlySql, params);
        
        // Get department breakdown (for admin/principal)
        let departmentBreakdown = [];
        if (req.session.user.role === 'admin' || req.session.user.role === 'principal') {
            const deptSql = `
                SELECT 
                    d.code AS department,
                    COUNT(CASE WHEN eel.event_type = 'entry' THEN 1 END) AS entries,
                    COUNT(CASE WHEN eel.event_type = 'exit' THEN 1 END) AS exits,
                    COUNT(CASE WHEN eel.event_type = 'roaming' THEN 1 END) AS roaming
                FROM entry_exit_logs eel
                JOIN students s ON eel.student_id = s.id
                JOIN departments d ON s.department_id = d.id
                WHERE DATE(eel.event_timestamp) = ?
                GROUP BY d.id, d.code
                ORDER BY d.code
            `;
            departmentBreakdown = await db.query(deptSql, [date]);
        }
        
        res.json({
            success: true,
            date,
            summary: summaryResult[0],
            hourlyBreakdown: hourlyResult,
            departmentBreakdown
        });
    } catch (error) {
        console.error('[DAILY SUMMARY ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate daily summary'
        });
    }
}

/**
 * Get attendance report
 */
async function getAttendanceReport(req, res) {
    try {
        const { startDate, endDate, departmentId } = req.query;
        const filters = {};
        
        // Apply role-based filters
        if (req.session.user.role === 'hod') {
            filters.departmentId = req.session.user.department_id;
        } else if (departmentId) {
            filters.departmentId = parseInt(departmentId);
        }
        
        // Default date range to last 7 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end - 7 * 24 * 60 * 60 * 1000);
        
        let whereClauses = ['DATE(eel.event_timestamp) BETWEEN ? AND ?'];
        const params = [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
        
        if (filters.departmentId) {
            whereClauses.push('s.department_id = ?');
            params.push(filters.departmentId);
        }
        
        const sql = `
            SELECT 
                s.roll_number,
                s.full_name,
                s.student_type,
                d.code AS department,
                COUNT(DISTINCT DATE(eel.event_timestamp)) AS days_present,
                COUNT(CASE WHEN eel.event_type = 'entry' THEN 1 END) AS total_entries,
                COUNT(CASE WHEN eel.is_late_entry = TRUE THEN 1 END) AS late_entries,
                COUNT(CASE WHEN eel.event_type = 'roaming' THEN 1 END) AS roaming_incidents,
                MIN(eel.event_timestamp) AS first_scan,
                MAX(eel.event_timestamp) AS last_scan
            FROM students s
            JOIN departments d ON s.department_id = d.id
            LEFT JOIN entry_exit_logs eel ON s.id = eel.student_id
            WHERE s.is_active = TRUE 
            ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
            GROUP BY s.id, s.roll_number, s.full_name, s.student_type, d.code
            ORDER BY d.code, s.roll_number
        `;
        
        const report = await db.query(sql, params);
        
        res.json({
            success: true,
            dateRange: { start, end },
            totalStudents: report.length,
            report
        });
    } catch (error) {
        console.error('[ATTENDANCE REPORT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate attendance report'
        });
    }
}

/**
 * Get roaming report
 */
async function getRoamingReport(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const filters = {};
        
        // Apply role-based filters
        if (req.session.user.role === 'hod') {
            filters.departmentId = req.session.user.department_id;
        }
        
        // Default date range to last 7 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end - 7 * 24 * 60 * 60 * 1000);
        
        let whereClause = 'rl.detected_at BETWEEN ? AND ?';
        const params = [start, end];
        
        if (filters.departmentId) {
            whereClause += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        
        const sql = `
            SELECT 
                rl.*,
                s.roll_number,
                s.full_name,
                s.year_of_study,
                s.section,
                d.code AS department,
                u.full_name AS resolved_by_name
            FROM roaming_logs rl
            JOIN students s ON rl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            LEFT JOIN users u ON rl.resolved_by_user_id = u.id
            WHERE ${whereClause}
            ORDER BY rl.detected_at DESC
        `;
        
        const incidents = await db.query(sql, params);
        
        // Get repeat offenders
        const offendersSql = `
            SELECT 
                s.roll_number,
                s.full_name,
                d.code AS department,
                COUNT(*) AS incident_count
            FROM roaming_logs rl
            JOIN students s ON rl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE ${whereClause}
            GROUP BY s.id, s.roll_number, s.full_name, d.code
            HAVING COUNT(*) > 1
            ORDER BY incident_count DESC
            LIMIT 20
        `;
        
        const repeatOffenders = await db.query(offendersSql, params);
        
        res.json({
            success: true,
            dateRange: { start, end },
            totalIncidents: incidents.length,
            resolvedCount: incidents.filter(i => i.is_resolved).length,
            escalatedCount: incidents.filter(i => i.is_escalated).length,
            incidents,
            repeatOffenders
        });
    } catch (error) {
        console.error('[ROAMING REPORT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate roaming report'
        });
    }
}

/**
 * Get permission letter report
 */
async function getPermissionReport(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const filters = {};
        
        // Apply role-based filters
        if (req.session.user.role === 'hod') {
            filters.departmentId = req.session.user.department_id;
        }
        
        // Default date range to last 7 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end - 7 * 24 * 60 * 60 * 1000);
        
        let whereClause = 'pl.permission_date BETWEEN ? AND ?';
        const params = [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
        
        if (filters.departmentId) {
            whereClause += ' AND s.department_id = ?';
            params.push(filters.departmentId);
        }
        
        const sql = `
            SELECT 
                pl.*,
                s.full_name,
                s.year_of_study,
                s.section,
                d.code AS department
            FROM permission_letters pl
            JOIN students s ON pl.student_id = s.id
            JOIN departments d ON s.department_id = d.id
            WHERE ${whereClause}
            ORDER BY pl.permission_date DESC, pl.uploaded_at DESC
        `;
        
        const permissions = await db.query(sql, params);
        
        // Summary stats
        const summary = {
            total: permissions.length,
            used: permissions.filter(p => p.is_used).length,
            verified: permissions.filter(p => p.is_verified).length,
            invalid: permissions.filter(p => !p.is_valid).length
        };
        
        res.json({
            success: true,
            dateRange: { start, end },
            summary,
            permissions
        });
    } catch (error) {
        console.error('[PERMISSION REPORT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate permission report'
        });
    }
}

/**
 * Export report as CSV
 */
async function exportReport(req, res) {
    try {
        const { type, startDate, endDate, format } = req.query;
        
        // Get report data based on type
        let data = [];
        let headers = [];
        
        switch (type) {
            case 'attendance':
                // Simplified - would call getAttendanceReport internally
                headers = ['Roll Number', 'Name', 'Department', 'Type', 'Days Present', 'Late Entries'];
                break;
            case 'roaming':
                headers = ['Date', 'Roll Number', 'Name', 'Department', 'Resolved', 'Escalated'];
                break;
            case 'daily':
                headers = ['Time', 'Roll Number', 'Name', 'Event Type', 'Allowed', 'Notes'];
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid report type'
                });
        }
        
        // Generate CSV
        const csv = generateCSV(headers, data);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('[EXPORT REPORT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export report'
        });
    }
}

/**
 * Generate CSV string from data
 */
function generateCSV(headers, data) {
    const lines = [headers.join(',')];
    
    for (const row of data) {
        const values = headers.map(h => {
            const val = row[h.toLowerCase().replace(/ /g, '_')] || '';
            // Escape quotes and wrap in quotes if contains comma
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        lines.push(values.join(','));
    }
    
    return lines.join('\n');
}

module.exports = {
    getDailySummary,
    getAttendanceReport,
    getRoamingReport,
    getPermissionReport,
    exportReport
};
