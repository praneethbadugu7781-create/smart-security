/**
 * ============================================
 * DASHBOARD.JS - Dashboard Common Functions
 * Smart Main Gate Entry-Exit System
 * ============================================
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        REFRESH_INTERVAL: 5000,      // Refresh every 5 seconds
        ALERT_CHECK_INTERVAL: 10000, // Check alerts every 10 seconds
        MAX_FEED_ITEMS: 50           // Maximum items in activity feed
    };

    // ============================================
    // STATE
    // ============================================
    let state = {
        refreshTimer: null,
        alertTimer: null,
        isRefreshing: false
    };

    // ============================================
    // INITIALIZE DASHBOARD
    // ============================================
    function init() {
        console.log('[Dashboard] Initializing...');
        
        // Start clock
        startClock();
        
        // Start live refresh
        startDashboardRefresh();
        
        // Initialize alerts if bell exists
        if (document.getElementById('alertBell')) {
            startAlertCheck();
        }
        
        console.log('[Dashboard] Initialized');
    }

    // ============================================
    // LIVE REFRESH
    // ============================================
    window.startDashboardRefresh = function() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            refreshDashboardData();
        }, CONFIG.REFRESH_INTERVAL);

        console.log('[Dashboard] Auto-refresh started');
    };

    async function refreshDashboardData() {
        if (state.isRefreshing) return;
        state.isRefreshing = true;

        try {
            // Fetch latest activity
            const response = await fetch('/api/dashboard/live');
            
            if (!response.ok) throw new Error('Failed to fetch');
            
            const data = await response.json();
            
            if (data.success) {
                updateActivityFeed(data.logs);
                updateStats(data.stats);
            }
        } catch (error) {
            console.error('[Dashboard] Refresh error:', error);
        } finally {
            state.isRefreshing = false;
        }
    }

    function updateActivityFeed(logs) {
        const feedList = document.getElementById('activityList');
        if (!feedList || !logs) return;

        // Create new feed HTML
        let html = '';
        logs.forEach(log => {
            html += createActivityItem(log);
        });

        if (html) {
            feedList.innerHTML = html;
        } else {
            feedList.innerHTML = `
                <div class="empty-state">
                    <p>No activity yet today</p>
                </div>
            `;
        }
    }

    function createActivityItem(log) {
        const time = new Date(log.timestamp || log.event_timestamp).toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const icon = log.event_type === 'entry' 
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="10 17 15 12 10 7"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="14 7 9 12 14 17"/></svg>`;

        const name = log.student_name || log.full_name || 'Unknown';
        const dept = log.department || log.department_code || '';

        return `
            <div class="activity-item ${log.event_type} ${log.is_allowed ? '' : 'denied'}">
                <div class="activity-icon">${icon}</div>
                <div class="activity-details">
                    <span class="activity-name">${escapeHtml(name)}</span>
                    <span class="activity-info">${escapeHtml(log.roll_number)}${dept ? ' • ' + escapeHtml(dept) : ''}</span>
                </div>
                <div class="activity-meta">
                    <span class="activity-type">${log.event_type.toUpperCase()}</span>
                    <span class="activity-time">${time}</span>
                </div>
            </div>
        `;
    }

    function updateStats(stats) {
        if (!stats) return;

        // Map API stat keys to element IDs
        const statMapping = {
            'total_entries': 'statEntries',
            'total_exits': 'statExits',
            'roaming_incidents': 'statRoaming',
            'late_entries': 'statLate',
            'unauthorized_exits': 'statUnauthorized',
            'pending_alerts': 'statAlerts',
            'unique_students': 'statStudents'
        };

        // Update stat cards with animation
        Object.keys(stats).forEach(key => {
            const elementId = statMapping[key];
            const statEl = elementId ? document.getElementById(elementId) : document.querySelector(`[data-stat="${key}"]`);
            if (statEl) {
                const currentValue = parseInt(statEl.textContent) || 0;
                const newValue = stats[key];
                
                if (currentValue !== newValue) {
                    animateNumber(statEl, currentValue, newValue);
                }
            }
        });
    }

    function animateNumber(el, from, to) {
        const duration = 500;
        const start = performance.now();
        
        function update() {
            const elapsed = performance.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (to - from) * eased);
            
            el.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    }

    // ============================================
    // ALERT SYSTEM
    // ============================================
    function startAlertCheck() {
        state.alertTimer = setInterval(() => {
            checkNewAlerts();
        }, CONFIG.ALERT_CHECK_INTERVAL);
    }

    async function checkNewAlerts() {
        // Alert count is shown from server-side rendered data
        // No separate API endpoint needed for now
        console.log('[Dashboard] Alert check - using server-rendered data');
    }

    window.updateAlertCount = function(count) {
        const countEl = document.getElementById('alertCount');
        if (countEl) {
            countEl.textContent = count || 0;
            
            // Update bell animation
            const bell = document.getElementById('alertBell');
            if (bell) {
                if (count > 0) {
                    bell.classList.add('pulse-alert');
                } else {
                    bell.classList.remove('pulse-alert');
                }
            }
        }
    };

    window.showAlerts = async function() {
        // Toggle alerts panel or redirect
        window.location.href = '/alerts';
    };

    // ============================================
    // CLOCK
    // ============================================
    function startClock() {
        function updateClock() {
            const timeEl = document.querySelector('.header-time');
            if (timeEl) {
                timeEl.textContent = new Date().toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }

        updateClock();
        setInterval(updateClock, 1000);
    }

    // ============================================
    // SECTION NAVIGATION (default - can be overridden by page)
    // ============================================
    // Note: This is a fallback. Admin dashboard overrides this with its own implementation.
    if (!window.showSection) {
        window.showSection = function(section, event) {
            if (event) event.preventDefault();
            console.log('[Dashboard] showSection:', section);
            
            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.section === section) {
                    item.classList.add('active');
                }
            });

            // Show/hide sections by ID
            document.querySelectorAll('.section-content').forEach(el => {
                el.classList.remove('active');
            });
            const sectionEl = document.getElementById('section-' + section);
            if (sectionEl) {
                sectionEl.classList.add('active');
            }
        };
    }

    // ============================================
    // ROAMING RESOLUTION
    // ============================================
    window.resolveRoaming = async function(id) {
        const notes = prompt('Enter resolution notes (optional):');
        
        try {
            const response = await fetch(`/api/roaming/${id}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: notes || '' })
            });

            const data = await response.json();
            
            if (data.success) {
                // Remove from list
                const item = document.querySelector(`.roaming-item[data-id="${id}"]`);
                if (item) {
                    item.style.animation = 'fadeOut 0.3s forwards';
                    setTimeout(() => item.remove(), 300);
                }
                
                showNotification('Roaming incident resolved', 'success');
            } else {
                showNotification(data.message || 'Failed to resolve', 'error');
            }
        } catch (error) {
            console.error('[Dashboard] Resolve error:', error);
            showNotification('Connection error', 'error');
        }
    };

    // ============================================
    // PERMISSION VERIFICATION
    // ============================================
    window.verifyPermission = async function(id) {
        try {
            const response = await fetch(`/api/permissions/${id}/verify`, {
                method: 'POST'
            });

            const data = await response.json();
            
            if (data.success) {
                // Remove from list
                const item = document.querySelector(`.permission-item[data-id="${id}"]`);
                if (item) {
                    item.style.animation = 'fadeOut 0.3s forwards';
                    setTimeout(() => item.remove(), 300);
                }
                
                showNotification('Permission verified', 'success');
            } else {
                showNotification(data.message || 'Failed to verify', 'error');
            }
        } catch (error) {
            console.error('[Dashboard] Verify error:', error);
            showNotification('Connection error', 'error');
        }
    };

    // ============================================
    // ALERT ACKNOWLEDGEMENT
    // ============================================
    window.acknowledgeAlert = async function(id) {
        try {
            const response = await fetch(`/api/alerts/${id}/read`, {
                method: 'POST'
            });

            const data = await response.json();
            
            if (data.success) {
                // Remove from list
                const item = document.querySelector(`.alert-item[data-id="${id}"], .escalation-item[data-id="${id}"]`);
                if (item) {
                    item.style.animation = 'fadeOut 0.3s forwards';
                    setTimeout(() => item.remove(), 300);
                }
                
                updateAlertCount();
                showNotification('Alert acknowledged', 'success');
            } else {
                showNotification(data.message || 'Failed to acknowledge', 'error');
            }
        } catch (error) {
            console.error('[Dashboard] Acknowledge error:', error);
            showNotification('Connection error', 'error');
        }
    };

    // ============================================
    // NOTIFICATIONS
    // ============================================
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${escapeHtml(message)}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        // Add styles if not present
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    background: #1e293b;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease;
                    z-index: 9999;
                }
                .notification-success { border-left: 4px solid #10b981; }
                .notification-error { border-left: 4px solid #ef4444; }
                .notification-info { border-left: 4px solid #2563eb; }
                .notification button {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0 4px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(20px); }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // MOBILE SIDEBAR TOGGLE
    // ============================================
    window.toggleSidebar = function() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    };

    // ============================================
    // CLEANUP
    // ============================================
    function cleanup() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (state.alertTimer) clearInterval(state.alertTimer);
    }

    window.addEventListener('beforeunload', cleanup);

    // ============================================
    // INITIALIZE
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
