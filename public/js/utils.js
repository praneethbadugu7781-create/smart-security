/**
 * ============================================
 * UTILS.JS - Utility Functions
 * Smart Main Gate Entry-Exit System
 * ============================================
 */

(function(global) {
    'use strict';

    const Utils = {};

    // ============================================
    // DATE & TIME UTILITIES
    // ============================================
    
    /**
     * Format date to Indian locale string
     * @param {Date|string} date 
     * @param {object} options 
     * @returns {string}
     */
    Utils.formatDate = function(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        const defaultOptions = {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        };
        return d.toLocaleDateString('en-IN', { ...defaultOptions, ...options });
    };

    /**
     * Format time to Indian locale string
     * @param {Date|string} date 
     * @param {boolean} includeSeconds 
     * @returns {string}
     */
    Utils.formatTime = function(date, includeSeconds = false) {
        const d = date instanceof Date ? date : new Date(date);
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        if (includeSeconds) {
            options.second = '2-digit';
        }
        return d.toLocaleTimeString('en-IN', options);
    };

    /**
     * Format relative time (e.g., "2 minutes ago")
     * @param {Date|string} date 
     * @returns {string}
     */
    Utils.relativeTime = function(date) {
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        return Utils.formatDate(d);
    };

    /**
     * Check if time is within range
     * @param {string} start - HH:MM format
     * @param {string} end - HH:MM format
     * @param {Date} checkDate - Date to check (default: now)
     * @returns {boolean}
     */
    Utils.isTimeInRange = function(start, end, checkDate = new Date()) {
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const checkMinutes = checkDate.getHours() * 60 + checkDate.getMinutes();

        return checkMinutes >= startMinutes && checkMinutes <= endMinutes;
    };

    // ============================================
    // STRING UTILITIES
    // ============================================

    /**
     * Escape HTML to prevent XSS
     * @param {string} text 
     * @returns {string}
     */
    Utils.escapeHtml = function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * Truncate string with ellipsis
     * @param {string} str 
     * @param {number} maxLength 
     * @returns {string}
     */
    Utils.truncate = function(str, maxLength = 50) {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    };

    /**
     * Capitalize first letter
     * @param {string} str 
     * @returns {string}
     */
    Utils.capitalize = function(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    /**
     * Format student type for display
     * @param {string} type 
     * @returns {string}
     */
    Utils.formatStudentType = function(type) {
        const types = {
            'day_scholar': 'Day Scholar',
            'hosteler': 'Hosteler',
            'bus_student': 'Bus Student'
        };
        return types[type] || type;
    };

    // ============================================
    // DOM UTILITIES
    // ============================================

    /**
     * Wait for element to exist
     * @param {string} selector 
     * @param {number} timeout 
     * @returns {Promise<Element>}
     */
    Utils.waitForElement = function(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found`));
            }, timeout);
        });
    };

    /**
     * Create element with attributes
     * @param {string} tag 
     * @param {object} attrs 
     * @param {string|Element|Element[]} children 
     * @returns {Element}
     */
    Utils.createElement = function(tag, attrs = {}, children = null) {
        const el = document.createElement(tag);
        
        Object.keys(attrs).forEach(key => {
            if (key === 'className') {
                el.className = attrs[key];
            } else if (key === 'style' && typeof attrs[key] === 'object') {
                Object.assign(el.style, attrs[key]);
            } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
                el.addEventListener(key.substring(2).toLowerCase(), attrs[key]);
            } else {
                el.setAttribute(key, attrs[key]);
            }
        });

        if (children) {
            if (typeof children === 'string') {
                el.textContent = children;
            } else if (children instanceof Element) {
                el.appendChild(children);
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (child instanceof Element) {
                        el.appendChild(child);
                    }
                });
            }
        }

        return el;
    };

    // ============================================
    // ANIMATION UTILITIES
    // ============================================

    /**
     * Animate number change
     * @param {Element} el 
     * @param {number} from 
     * @param {number} to 
     * @param {number} duration 
     */
    Utils.animateNumber = function(el, from, to, duration = 500) {
        const start = performance.now();
        
        function update() {
            const elapsed = performance.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (to - from) * eased);
            
            el.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    };

    /**
     * Fade out element
     * @param {Element} el 
     * @param {number} duration 
     * @returns {Promise}
     */
    Utils.fadeOut = function(el, duration = 300) {
        return new Promise(resolve => {
            el.style.transition = `opacity ${duration}ms`;
            el.style.opacity = '0';
            setTimeout(() => {
                el.remove();
                resolve();
            }, duration);
        });
    };

    // ============================================
    // STORAGE UTILITIES
    // ============================================

    /**
     * Get item from localStorage with JSON parsing
     * @param {string} key 
     * @param {*} defaultValue 
     * @returns {*}
     */
    Utils.getStorage = function(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    };

    /**
     * Set item in localStorage with JSON stringifying
     * @param {string} key 
     * @param {*} value 
     */
    Utils.setStorage = function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
        }
    };

    // ============================================
    // VALIDATION UTILITIES
    // ============================================

    /**
     * Validate barcode format
     * @param {string} barcode 
     * @returns {boolean}
     */
    Utils.isValidBarcode = function(barcode) {
        if (!barcode) return false;
        // Basic validation - alphanumeric, min 5 chars
        return /^[A-Za-z0-9]{5,50}$/.test(barcode);
    };

    /**
     * Validate roll number format
     * @param {string} rollNumber 
     * @returns {boolean}
     */
    Utils.isValidRollNumber = function(rollNumber) {
        if (!rollNumber) return false;
        // Format: XXYYZZZZ (Year-Dept-Number) e.g., 21CSE1234
        return /^[0-9]{2}[A-Z]{2,4}[0-9]{3,4}$/.test(rollNumber.toUpperCase());
    };

    // ============================================
    // AUDIO UTILITIES
    // ============================================

    /**
     * Play audio with error handling
     * @param {HTMLAudioElement|string} audio 
     */
    Utils.playAudio = function(audio) {
        const el = typeof audio === 'string' ? document.getElementById(audio) : audio;
        if (el && el.play) {
            el.currentTime = 0;
            el.play().catch(() => {});
        }
    };

    // ============================================
    // DEBOUNCE & THROTTLE
    // ============================================

    /**
     * Debounce function
     * @param {Function} fn 
     * @param {number} delay 
     * @returns {Function}
     */
    Utils.debounce = function(fn, delay = 300) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    /**
     * Throttle function
     * @param {Function} fn 
     * @param {number} limit 
     * @returns {Function}
     */
    Utils.throttle = function(fn, limit = 100) {
        let inThrottle = false;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // Export
    global.Utils = Utils;

})(window);
