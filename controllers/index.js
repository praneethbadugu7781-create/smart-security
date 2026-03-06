/**
 * Controllers Index
 * Central export for all controller modules.
 */

const authController = require('./authController');
const scanController = require('./scanController');
const dashboardController = require('./dashboardController');
const studentController = require('./studentController');
const reportsController = require('./reportsController');

module.exports = {
    authController,
    scanController,
    dashboardController,
    studentController,
    reportsController
};
