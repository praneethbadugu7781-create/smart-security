/**
 * Scan Controller
 * Core controller for barcode scanning operations.
 * Handles all scan processing, rule validation, and alert generation.
 * 
 * CRITICAL: This is the heart of the security system.
 * Every scan goes through here and must be processed correctly.
 */

const { Student, EntryExitLog, PermissionLetter, RoamingLog, Alert, User } = require('../models');
const config = require('../config/app.config');
const timeValidation = require('../middleware/timeValidation');
const { logScanEvent, logAlertCreated } = require('../middleware/auditLogger');

/**
 * Process a barcode scan
 * This is the main entry point for all scans from the security interface.
 * 
 * Flow:
 * 1. Validate roll number exists
 * 2. Check for duplicate scan
 * 3. Determine event type (entry/exit/roaming)
 * 4. Apply business rules based on student type and time
 * 5. Create log entry
 * 6. Generate alerts if needed
 * 7. Return result for UI feedback
 */
async function processScan(req, res) {
    const startTime = Date.now();
    
    try {
        const { roll_number } = req.body;
        const securityUserId = req.session.user.id;
        
        // ==========================================
        // STEP 1: Validate roll number
        // ==========================================
        if (!roll_number || typeof roll_number !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid barcode data',
                code: 'INVALID_BARCODE'
            });
        }
        
        const cleanRollNumber = roll_number.trim().toUpperCase();
        
        // Find student by roll number
        const student = await Student.findByRollNumber(cleanRollNumber);
        
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found',
                code: 'STUDENT_NOT_FOUND',
                roll_number: cleanRollNumber,
                sound: 'error'
            });
        }
        
        // ==========================================
        // STEP 2: Check for duplicate scan
        // ==========================================
        const duplicateCheck = await EntryExitLog.checkDuplicateScan(
            cleanRollNumber,
            config.scan.duplicateScanInterval
        );
        
        if (duplicateCheck) {
            // Duplicate scan within interval - ignore silently
            return res.json({
                success: true,
                duplicate: true,
                message: 'Duplicate scan ignored',
                student_name: student.full_name,
                last_event: duplicateCheck.event_type,
                sound: 'duplicate'
            });
        }
        
        // ==========================================
        // STEP 3: Determine event type
        // ==========================================
        const lastScan = await EntryExitLog.getLastScan(cleanRollNumber);
        let eventType = timeValidation.determineEventType(lastScan?.event_type);
        
        // Get current time context
        const timeContext = timeValidation.getTimeContext();
        
        // Check for roaming detection
        const isRoaming = timeValidation.isRoamingDetection(student, lastScan);
        if (isRoaming) {
            eventType = 'roaming';
        }
        
        // ==========================================
        // STEP 4: Apply business rules
        // ==========================================
        let isAllowed = true;
        let requiresPermission = false;
        let hasPermission = false;
        let permissionLetterId = null;
        let isLateEntry = false;
        let isLateReturn = false;
        let alertSent = false;
        let alertSentTo = null;
        let notes = null;
        
        // BUS STUDENTS: Skip scanning for bus entry/exit
        if (student.student_type === 'bus') {
            // Bus students only need to be scanned for mid-day exits
            if (eventType === 'entry' && timeContext.isDuringMorningEntry) {
                // Morning bus arrival - no scan needed, but if scanned, just log it
                notes = 'Bus student morning entry (normally no scan required)';
            }
        }
        
        // HOSTELERS: Special rules for hostel students
        if (student.student_type === 'hosteler') {
            // Check for late return after curfew
            if (eventType === 'entry' && timeContext.isAfterCurfew) {
                isLateReturn = true;
                alertSentTo = 'warden';
            }
        }
        
        // Handle by event type
        if (eventType === 'entry') {
            // Entry validation
            const entryValidation = timeValidation.validateEntry(student.student_type);
            isAllowed = entryValidation.allowed;
            isLateEntry = entryValidation.isLateEntry || false;
            isLateReturn = entryValidation.isLateReturn || isLateReturn;
            
            if (isLateEntry) {
                await Student.incrementLateCount(student.id);
            }
            
        } else if (eventType === 'exit') {
            // Exit validation
            const exitValidation = timeValidation.validateExit(student.student_type, false);
            
            if (!exitValidation.allowed && exitValidation.requiresPermission) {
                requiresPermission = true;
                
                // Check for valid permission letter
                const permission = await PermissionLetter.findValidForToday(cleanRollNumber);
                if (permission) {
                    hasPermission = true;
                    permissionLetterId = permission.id;
                    isAllowed = true;
                } else {
                    isAllowed = false;
                    alertSentTo = 'hod';
                }
            } else {
                isAllowed = exitValidation.allowed;
            }
            
        } else if (eventType === 'roaming') {
            // Roaming detection
            isAllowed = false; // Roaming is never "allowed" - it's a rule violation
            alertSentTo = 'hod';
            await Student.incrementRoamingCount(student.id);
        }
        
        // ==========================================
        // STEP 5: Create entry/exit log
        // ==========================================
        const logData = {
            student_id: student.id,
            roll_number: cleanRollNumber,
            event_type: eventType,
            event_timestamp: new Date(),
            gate_location: 'main_gate',
            is_allowed: isAllowed,
            requires_permission: requiresPermission,
            has_permission: hasPermission,
            permission_letter_id: permissionLetterId,
            student_type: student.student_type,
            is_during_class_hours: timeContext.isDuringClassHours,
            is_late_entry: isLateEntry,
            is_late_return: isLateReturn,
            alert_sent: alertSentTo !== null,
            alert_sent_to: alertSentTo,
            scanned_by_user_id: securityUserId,
            notes: notes
        };
        
        const log = await EntryExitLog.create(logData);
        
        // Mark permission letter as used if applicable
        if (permissionLetterId) {
            await PermissionLetter.markAsUsed(permissionLetterId, log.id);
        }
        
        // ==========================================
        // STEP 6: Generate alerts
        // ==========================================
        if (alertSentTo) {
            alertSent = true;
            
            if (eventType === 'roaming') {
                // Create roaming log and alert
                const roamingLog = await RoamingLog.create({
                    student_id: student.id,
                    roll_number: cleanRollNumber,
                    detected_at: new Date(),
                    detected_location: 'main_gate',
                    alert_sent_to_hod: true,
                    hod_user_id: student.hod_user_id,
                    entry_exit_log_id: log.id,
                    detected_by_user_id: securityUserId
                });
                
                // Create alert for HOD
                const alert = await Alert.createRoamingAlert(
                    { ...student, department_id: student.department_id },
                    roamingLog.id,
                    student.hod_user_id
                );
                
                await logAlertCreated(alert);
                
                // Check for escalation threshold
                const todayIncidents = await RoamingLog.countTodayIncidents(student.id);
                if (todayIncidents >= config.scan.roamingEscalationThreshold) {
                    await RoamingLog.escalate(roamingLog.id, 'principal');
                    
                    // Create escalation alert for principal
                    await Alert.create({
                        target_role: 'principal',
                        alert_type: 'escalation',
                        priority: 'critical',
                        title: `Escalation: ${student.full_name} - Multiple Roaming Incidents`,
                        message: `Student ${cleanRollNumber} has ${todayIncidents} roaming incidents today and requires principal attention.`,
                        student_id: student.id,
                        roaming_log_id: roamingLog.id
                    });
                }
                
            } else if (!isAllowed && requiresPermission) {
                // Unauthorized exit attempt
                await Alert.createUnauthorizedExitAlert(student, log.id);
                
            } else if (isLateReturn && student.student_type === 'hosteler') {
                // Late return for hosteler
                await Alert.createLateReturnAlert(student, log.id);
            }
        }
        
        // ==========================================
        // STEP 7: Log audit and return response
        // ==========================================
        await logScanEvent({
            logId: log.id,
            roll_number: cleanRollNumber,
            event_type: eventType,
            is_allowed: isAllowed
        }, securityUserId, req.session.user.username, req.ip);
        
        const processingTime = Date.now() - startTime;
        
        // Return result for UI
        return res.json({
            success: true,
            duplicate: false,
            
            // Student info for display
            student: {
                roll_number: cleanRollNumber,
                name: student.full_name,
                type: student.student_type,
                department: student.department_code,
                year: student.year_of_study,
                section: student.section,
                photo_url: student.photo_url
            },
            
            // Event details
            event: {
                type: eventType,
                allowed: isAllowed,
                timestamp: log.event_timestamp,
                log_id: log.id
            },
            
            // Flags
            flags: {
                requires_permission: requiresPermission,
                has_permission: hasPermission,
                is_late_entry: isLateEntry,
                is_late_return: isLateReturn,
                during_class_hours: timeContext.isDuringClassHours,
                alert_sent: alertSent
            },
            
            // UI feedback
            display: {
                status: isAllowed ? 'ALLOWED' : 'DENIED',
                color: isAllowed ? 'green' : 'red',
                message: getDisplayMessage(eventType, isAllowed, requiresPermission, hasPermission, isLateReturn)
            },
            
            // Sound to play
            sound: isAllowed ? 'success' : 'denied',
            
            // Performance metric
            processingTimeMs: processingTime
        });
        
    } catch (error) {
        console.error('[SCAN ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Scan processing failed',
            code: 'SCAN_ERROR',
            sound: 'error'
        });
    }
}

/**
 * Generate display message for UI
 */
function getDisplayMessage(eventType, isAllowed, requiresPermission, hasPermission, isLateReturn) {
    if (eventType === 'roaming') {
        return 'ROAMING DETECTED - HOD Alerted';
    }
    
    if (eventType === 'entry') {
        if (isLateReturn) {
            return 'LATE RETURN - Warden Alerted';
        }
        return 'ENTRY RECORDED';
    }
    
    if (eventType === 'exit') {
        if (!isAllowed && requiresPermission) {
            return 'EXIT DENIED - Permission Letter Required';
        }
        if (hasPermission) {
            return 'EXIT ALLOWED - Permission Verified';
        }
        return 'EXIT RECORDED';
    }
    
    return isAllowed ? 'ALLOWED' : 'DENIED';
}

/**
 * Upload permission letter photo
 * Called when security photographs a permission letter
 */
async function uploadPermissionLetter(req, res) {
    try {
        const { roll_number, reason } = req.body;
        const securityUserId = req.session.user.id;
        
        // Validate file upload
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No photo uploaded',
                code: 'NO_PHOTO'
            });
        }
        
        // Find student
        const student = await Student.findByRollNumber(roll_number.trim().toUpperCase());
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found',
                code: 'STUDENT_NOT_FOUND'
            });
        }
        
        // Create permission letter record
        const letter = await PermissionLetter.create({
            student_id: student.id,
            roll_number: student.roll_number,
            reason: reason || 'Not specified',
            permission_date: new Date().toISOString().split('T')[0],
            photo_filename: req.file.filename,
            photo_path: req.file.path,
            photo_mime_type: req.file.mimetype,
            uploaded_by_user_id: securityUserId
        });
        
        return res.json({
            success: true,
            message: 'Permission letter uploaded',
            letter_id: letter.id,
            student_name: student.full_name
        });
        
    } catch (error) {
        console.error('[PERMISSION UPLOAD ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to upload permission letter',
            code: 'UPLOAD_ERROR'
        });
    }
}

/**
 * Get recent scans for live feed display
 */
async function getRecentScans(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const recentLogs = await EntryExitLog.getRecentActivity(limit);
        
        return res.json({
            success: true,
            logs: recentLogs.map(log => ({
                id: log.id,
                roll_number: log.roll_number,
                student_name: log.full_name,
                department: log.department_code,
                event_type: log.event_type,
                is_allowed: log.is_allowed,
                timestamp: log.event_timestamp,
                photo_url: log.photo_url
            }))
        });
        
    } catch (error) {
        console.error('[RECENT SCANS ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch recent scans'
        });
    }
}

/**
 * Get dashboard statistics
 */
async function getDashboardStats(req, res) {
    try {
        const filters = {};
        
        // Apply role-based filters
        if (req.session.user.role === 'hod') {
            filters.departmentId = req.session.user.department_id;
        } else if (req.session.user.role === 'warden') {
            filters.hostelId = req.session.user.hostel_id;
        }
        
        const stats = await EntryExitLog.getDashboardStats(filters);
        const roamingStats = await RoamingLog.getStats(filters);
        
        return res.json({
            success: true,
            stats: {
                ...stats,
                roaming: roamingStats
            }
        });
        
    } catch (error) {
        console.error('[STATS ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
}

module.exports = {
    processScan,
    uploadPermissionLetter,
    getRecentScans,
    getDashboardStats
};
