/**
 * Models Index
 * Central export for all database models.
 */

const Student = require('./Student');
const User = require('./User');
const EntryExitLog = require('./EntryExitLog');
const PermissionLetter = require('./PermissionLetter');
const RoamingLog = require('./RoamingLog');
const Alert = require('./Alert');

module.exports = {
    Student,
    User,
    EntryExitLog,
    PermissionLetter,
    RoamingLog,
    Alert
};
