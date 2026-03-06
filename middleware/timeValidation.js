/**
 * Time Validation Middleware
 * Validates scans against college timing rules.
 * Determines if current time is during class hours, breaks, etc.
 */

const config = require('../config/app.config');

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Get current time as minutes since midnight (IST)
 * @returns {number} Current time in minutes
 */
function getCurrentTimeMinutes() {
    const now = new Date();
    // Adjust for IST (UTC+5:30)
    const istOffset = 5.5 * 60; // minutes
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return (utcMinutes + istOffset) % (24 * 60);
}

/**
 * Check if current day is a weekend
 * @returns {boolean} True if weekend
 */
function isWeekend() {
    const now = new Date();
    const day = now.getDay();
    return config.collegeTiming.weekendDays.includes(day);
}

/**
 * Check if current time is during a break
 * @returns {Object|null} Break info if during break, null otherwise
 */
function getCurrentBreak() {
    const currentMinutes = getCurrentTimeMinutes();
    
    for (const breakPeriod of config.collegeTiming.breaks) {
        const breakStart = timeToMinutes(breakPeriod.start);
        const breakEnd = timeToMinutes(breakPeriod.end);
        
        if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
            return breakPeriod;
        }
    }
    
    return null;
}

/**
 * Check if current time is during class hours
 * (After class start, before class end, not during breaks, not weekend)
 * @returns {boolean} True if during class hours
 */
function isDuringClassHours() {
    // Not during weekends
    if (isWeekend()) {
        return false;
    }
    
    // Not during breaks
    if (getCurrentBreak()) {
        return false;
    }
    
    const currentMinutes = getCurrentTimeMinutes();
    const classStart = timeToMinutes(config.collegeTiming.classStartTime);
    const classEnd = timeToMinutes(config.collegeTiming.classEndTime);
    
    return currentMinutes >= classStart && currentMinutes < classEnd;
}

/**
 * Check if current time is during morning entry window
 * @returns {boolean} True if during morning entry window
 */
function isDuringMorningEntry() {
    if (isWeekend()) {
        return false;
    }
    
    const currentMinutes = getCurrentTimeMinutes();
    const entryStart = timeToMinutes(config.collegeTiming.morningEntryStart);
    const entryEnd = timeToMinutes(config.collegeTiming.morningEntryEnd);
    
    return currentMinutes >= entryStart && currentMinutes < entryEnd;
}

/**
 * Check if current entry would be late
 * @returns {boolean} True if late entry
 */
function isLateEntry() {
    if (isWeekend()) {
        return false;
    }
    
    const currentMinutes = getCurrentTimeMinutes();
    const lateAfter = timeToMinutes(config.collegeTiming.morningEntryEnd);
    const classEnd = timeToMinutes(config.collegeTiming.classEndTime);
    
    // Late if after morning entry window but before class end
    return currentMinutes > lateAfter && currentMinutes < classEnd;
}

/**
 * Check if current time is during normal exit window
 * @returns {boolean} True if during normal exit window
 */
function isDuringNormalExit() {
    if (isWeekend()) {
        return true; // Always allowed on weekends
    }
    
    const currentMinutes = getCurrentTimeMinutes();
    const exitStart = timeToMinutes(config.collegeTiming.eveningExitStart);
    const exitEnd = timeToMinutes(config.collegeTiming.eveningExitEnd);
    
    return currentMinutes >= exitStart && currentMinutes <= exitEnd;
}

/**
 * Check if current time is after hostel curfew
 * @returns {boolean} True if after curfew
 */
function isAfterCurfew() {
    const currentMinutes = getCurrentTimeMinutes();
    const curfew = timeToMinutes(config.collegeTiming.hostelCurfew);
    
    // After curfew but before midnight
    return currentMinutes >= curfew;
}

/**
 * Determine event type based on last event
 * @param {string|null} lastEventType - Last event type ('entry', 'exit', or null)
 * @returns {string} Next event type
 */
function determineEventType(lastEventType) {
    if (!lastEventType || lastEventType === 'exit') {
        return 'entry';
    }
    return 'exit';
}

/**
 * Get detailed time context for current moment
 * @returns {Object} Time context information
 */
function getTimeContext() {
    return {
        currentTime: new Date(),
        currentTimeMinutes: getCurrentTimeMinutes(),
        isWeekend: isWeekend(),
        isDuringClassHours: isDuringClassHours(),
        isDuringMorningEntry: isDuringMorningEntry(),
        isLateEntry: isLateEntry(),
        isDuringNormalExit: isDuringNormalExit(),
        isAfterCurfew: isAfterCurfew(),
        currentBreak: getCurrentBreak()
    };
}

/**
 * Middleware to attach time context to request
 */
function attachTimeContext(req, res, next) {
    req.timeContext = getTimeContext();
    next();
}

/**
 * Validate if exit is allowed based on student type and time
 * @param {string} studentType - 'day_scholar', 'hosteler', or 'bus'
 * @param {boolean} hasPermission - Whether student has permission letter
 * @returns {Object} Validation result
 */
function validateExit(studentType, hasPermission) {
    const context = getTimeContext();
    
    // Weekend - always allowed
    if (context.isWeekend) {
        return { allowed: true, reason: 'Weekend - exit allowed' };
    }
    
    // During break - always allowed
    if (context.currentBreak) {
        return { allowed: true, reason: `During ${context.currentBreak.name} - exit allowed` };
    }
    
    // After normal exit time - always allowed
    if (context.isDuringNormalExit) {
        return { allowed: true, reason: 'Normal exit hours - exit allowed' };
    }
    
    // During class hours - permission required
    if (context.isDuringClassHours) {
        if (hasPermission) {
            return { allowed: true, reason: 'Has permission letter - exit allowed' };
        }
        return {
            allowed: false,
            reason: 'Exit during class hours requires HOD permission letter',
            requiresPermission: true
        };
    }
    
    // Before class hours - allowed
    if (context.currentTimeMinutes < timeToMinutes(config.collegeTiming.classStartTime)) {
        return { allowed: true, reason: 'Before class hours - exit allowed' };
    }
    
    // After class hours - allowed
    return { allowed: true, reason: 'After class hours - exit allowed' };
}

/**
 * Validate entry based on student type and time
 * @param {string} studentType - 'day_scholar', 'hosteler', or 'bus'
 * @returns {Object} Validation result
 */
function validateEntry(studentType) {
    const context = getTimeContext();
    
    // Entry is always allowed, but may be flagged as late
    const result = {
        allowed: true,
        isLateEntry: context.isLateEntry && !context.isWeekend
    };
    
    if (result.isLateEntry) {
        result.reason = 'Late entry - logged for attendance';
    } else {
        result.reason = 'Entry recorded';
    }
    
    // Special handling for hostelers after curfew
    if (studentType === 'hosteler' && context.isAfterCurfew) {
        result.isLateReturn = true;
        result.alertWarden = true;
        result.reason = 'Late return after curfew - warden alerted';
    }
    
    return result;
}

/**
 * Check if scan should be treated as roaming detection
 * (Entry scan detected during class hours when student should be in class)
 * @param {Object} student - Student record
 * @param {Object} lastScan - Last scan record
 * @returns {boolean} True if this is a roaming detection
 */
function isRoamingDetection(student, lastScan) {
    const context = getTimeContext();
    
    // Only detect roaming during class hours
    if (!context.isDuringClassHours) {
        return false;
    }
    
    // If last scan was entry (student is inside campus) and enough time has passed
    if (lastScan && lastScan.event_type === 'entry') {
        const lastScanTime = new Date(lastScan.event_timestamp);
        const timeSinceLast = Date.now() - lastScanTime.getTime();
        const roamingThreshold = config.scan.roamingDetectionMinutes * 60 * 1000;
        
        // If scanned again within roaming window, treat as roaming
        if (timeSinceLast > roamingThreshold) {
            return true;
        }
    }
    
    return false;
}

module.exports = {
    timeToMinutes,
    getCurrentTimeMinutes,
    isWeekend,
    getCurrentBreak,
    isDuringClassHours,
    isDuringMorningEntry,
    isLateEntry,
    isDuringNormalExit,
    isAfterCurfew,
    determineEventType,
    getTimeContext,
    attachTimeContext,
    validateExit,
    validateEntry,
    isRoamingDetection
};
