// ========================================
// UI ENHANCEMENTS - Phase 1
// Measurement quality visibility and context
// ========================================

import { formatBytes } from './utils.js';

/**
 * Show confidence indicator for a measurement
 */
export function showConfidenceIndicator(metric, confidence) {
    const indicator = document.getElementById(`${metric}-confidence`);
    if (!indicator) return;

    indicator.hidden = false;
    const fill = indicator.querySelector('.confidence-fill');
    const text = indicator.querySelector('.confidence-text');

    if (fill) {
        fill.style.width = `${confidence}%`;

        // Set confidence level for styling
        let level = 'very-low';
        if (confidence >= 85) level = 'high';
        else if (confidence >= 70) level = 'medium';
        else if (confidence >= 50) level = 'low';

        fill.setAttribute('data-level', level);
    }

    if (text) {
        text.textContent = `${confidence}% confidence`;
    }
}

/**
 * Show info button for measurement details
 */
export function showMeasurementInfoButton(metric, details) {
    const button = document.getElementById(`${metric}-info`);
    if (!button) return;

    button.hidden = false;

    // Store details for modal
    button.dataset.details = JSON.stringify(details);

    // Add click handler if not already added
    if (!button.dataset.handlerAdded) {
        button.addEventListener('click', () => showMeasurementDetailsModal(metric, details));
        button.dataset.handlerAdded = 'true';
    }
}

/**
 * Show measurement details in modal
 */
function showMeasurementDetailsModal(metric, details) {
    const modal = document.getElementById('measurementDetailsModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');

    if (!modal || !modalBody || !modalTitle) return;

    // Set title
    const metricNames = {
        download: 'Download',
        upload: 'Upload',
        latency: 'Latency',
        jitter: 'Jitter'
    };
    modalTitle.textContent = `${metricNames[metric]} Measurement Details`;

    // Build content
    let content = '';

    if (metric === 'download' || metric === 'upload') {
        content = `
            <div class="measurement-detail">
                <h4>Speed Measurement</h4>
                <dl>
                    <dt>Final Speed</dt>
                    <dd>${details.speed.toFixed(2)} Mbps</dd>
                    
                    <dt>Confidence Score</dt>
                    <dd>${details.confidence}%</dd>
                    
                    <dt>Stability</dt>
                    <dd>${details.stability.toFixed(0)}%</dd>
                </dl>
            </div>
            
            <div class="measurement-detail">
                <h4>Data Transfer</h4>
                <dl>
                    <dt>Bytes Transferred</dt>
                    <dd>${formatBytes(details.bytesTransferred)}</dd>
                    
                    <dt>Total Duration</dt>
                    <dd>${details.duration.toFixed(2)}s</dd>
                    
                    <dt>Effective Duration</dt>
                    <dd>${details.effectiveDuration.toFixed(2)}s</dd>
                    
                    <dt>Warmup Period</dt>
                    <dd>2.0s (excluded from calculation)</dd>
                </dl>
            </div>
            
            ${details.warnings && details.warnings.length > 0 ? `
            <div class="measurement-detail">
                <h4>⚠️ Warnings</h4>
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--color-warning);">
                    ${details.warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="measurement-detail">
                <h4>Methodology</h4>
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6;">
                    This measurement used ${metric === 'download' ? 'multiple parallel connections' : 'chunked uploads'} 
                    to the Amsterdam server. The first 2 seconds (TCP slow start) were excluded to measure 
                    steady-state performance. Confidence score reflects test duration, data volume, and speed variance.
                </p>
            </div>
        `;
    } else if (metric === 'latency') {
        content = `
            <div class="measurement-detail">
                <h4>Latency Statistics</h4>
                <dl>
                    <dt>Average</dt>
                    <dd>${details.average.toFixed(1)} ms</dd>
                    
                    <dt>Median</dt>
                    <dd>${details.median ? details.median.toFixed(1) : details.average.toFixed(1)} ms</dd>
                    
                    <dt>Minimum</dt>
                    <dd>${details.min.toFixed(1)} ms</dd>
                    
                    <dt>Maximum</dt>
                    <dd>${details.max.toFixed(1)} ms</dd>
                    
                    <dt>Samples Collected</dt>
                    <dd>${details.samples ? details.samples.length : 10}</dd>
                    
                    ${details.outlierCount ? `
                    <dt>Outliers Removed</dt>
                    <dd>${details.outlierCount}</dd>
                    ` : ''}
                </dl>
            </div>
            
            <div class="measurement-detail">
                <h4>Methodology</h4>
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6;">
                    Latency measured using 10 ICMP-like pings to Amsterdam. Statistical outliers 
                    (>3.5 MAD from median) are removed to provide more accurate results. 
                    Median is often more reliable than average for network measurements.
                </p>
            </div>
        `;
    } else if (metric === 'jitter') {
        content = `
            <div class="measurement-detail">
                <h4>Jitter Statistics</h4>
                <dl>
                    <dt>Jitter (StdDev)</dt>
                    <dd>${details.value.toFixed(1)} ms</dd>
                    
                    ${details.avgJitter ? `
                    <dt>Average Jitter</dt>
                    <dd>${details.avgJitter.toFixed(1)} ms</dd>
                    ` : ''}
                    
                    ${details.maxJitter ? `
                    <dt>Maximum Jitter</dt>
                    <dd>${details.maxJitter.toFixed(1)} ms</dd>
                    ` : ''}
                    
                    ${details.consistency ? `
                    <dt>Consistency Score</dt>
                    <dd>${details.consistency}%</dd>
                    ` : ''}
                </dl>
            </div>
            
            <div class="measurement-detail">
                <h4>What is Jitter?</h4>
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6;">
                    Jitter measures the variation in latency over time. Lower jitter means more 
                    consistent connection, which is important for real-time applications like 
                    video calls and gaming. Calculated as standard deviation of latency samples.
                </p>
            </div>
        `;
    }

    modalBody.innerHTML = content;
    modal.hidden = false;

    // Re-initialize Lucide icons in modal
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Initialize modal close handlers
 */
export function initializeMeasurementModal() {
    const modal = document.getElementById('measurementDetailsModal');
    const closeBtn = document.getElementById('closeDetailsModal');
    const overlay = modal?.querySelector('.modal-overlay');

    if (!modal) return;

    const closeModal = () => {
        modal.hidden = true;
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });
}

/**
 * Update test context panel
 */
export function updateTestContext(testData) {
    const panel = document.getElementById('testContextPanel');
    if (!panel) return;

    panel.hidden = false;

    // Update server location
    const serverLoc = document.getElementById('contextServerLocation');
    if (serverLoc && testData.serverLocation) {
        serverLoc.textContent = testData.serverLocation;
    }

    // Update distance (calculate if coordinates available)
    const distance = document.getElementById('contextDistance');
    if (distance) {
        if (testData.distance) {
            distance.textContent = `~${testData.distance} km (international route)`;
        } else {
            distance.textContent = 'International route';
        }
    }

    // Update connection type
    const connType = document.getElementById('contextConnectionType');
    if (connType && testData.connectionType) {
        connType.textContent = testData.connectionType;
    }

    // Update timestamp
    const timestamp = document.getElementById('contextTimestamp');
    if (timestamp) {
        const date = new Date();
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        timestamp.textContent = `${timeStr}, ${dateStr}`;
    }

    // Update data used
    const dataUsed = document.getElementById('contextDataUsed');
    if (dataUsed && testData.totalBytes) {
        dataUsed.textContent = formatBytes(testData.totalBytes);
    }
}

/**
 * Get connection type from browser API
 */
export function getConnectionType() {
    if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
        return 'Unknown';
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const type = connection.effectiveType || connection.type || 'unknown';

    const types = {
        'slow-2g': 'Slow 2G',
        '2g': '2G',
        '3g': '3G',
        '4g': '4G/LTE',
        'wifi': 'WiFi',
        'ethernet': 'Ethernet',
        'unknown': 'Unknown'
    };

    return types[type] || 'Unknown';
}

/**
 * Calculate approximate distance (simple Great Circle distance)
 * Amsterdam coordinates: 52.3676° N, 4.9041° E
 */
export function calculateDistance(userLat, userLon) {
    const amsterdamLat = 52.3676;
    const amsterdamLon = 4.9041;

    const R = 6371; // Earth's radius in km
    const dLat = toRad(amsterdamLat - userLat);
    const dLon = toRad(amsterdamLon - userLon);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(userLat)) * Math.cos(toRad(amsterdamLat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return Math.round(distance);
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Try to get user's approximate location (requires permission)
 */
export async function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            () => {
                resolve(null);
            },
            { timeout: 5000 }
        );
    });
}

/**
 * Create tooltip for Learn page integration
 */
export function createLearnTooltip(element, text, learnUrl) {
    if (!element) return;
    
    element.style.position = 'relative';
    element.style.cursor = 'help';
    
    let tooltip = null;
    
    element.addEventListener('mouseenter', () => {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip visible';
        tooltip.textContent = text;
        
        if (learnUrl) {
            tooltip.style.cursor = 'pointer';
            tooltip.addEventListener('click', () => {
                window.location.href = learnUrl;
            });
        }
        
        element.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.top = '-40px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
    });
    
    element.addEventListener('mouseleave', () => {
        if (tooltip && tooltip.parentNode === element) {
            tooltip.remove();
            tooltip = null;
        }
    });
}

/**
 * Animate number counting effect
 */
export function animateNumber(element, targetValue, duration = 1000, decimals = 1) {
    if (!element) return;
    
    const startValue = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (targetValue - startValue) * eased;
        
        element.textContent = current.toFixed(decimals);
        element.classList.add('counting');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.classList.remove('counting');
        }
    }
    
    requestAnimationFrame(update);
}

/**
 * Calculate and display history statistics
 */
export function updateHistoryStats(history) {
    if (!history || history.length === 0) return null;
    
    const stats = {
        avgDownload: 0,
        avgUpload: 0,
        avgLatency: 0,
        maxDownload: 0,
        maxUpload: 0,
        minLatency: Infinity,
        testCount: history.length
    };
    
    history.forEach(test => {
        stats.avgDownload += test.download || 0;
        stats.avgUpload += test.upload || 0;
        stats.avgLatency += test.latency || 0;
        stats.maxDownload = Math.max(stats.maxDownload, test.download || 0);
        stats.maxUpload = Math.max(stats.maxUpload, test.upload || 0);
        stats.minLatency = Math.min(stats.minLatency, test.latency || Infinity);
    });
    
    stats.avgDownload /= history.length;
    stats.avgUpload /= history.length;
    stats.avgLatency /= history.length;
    
    if (stats.minLatency === Infinity) stats.minLatency = 0;
    
    return stats;
}

/**
 * Display history statistics in UI
 */
export function displayHistoryStats(stats) {
    if (!stats) return;
    
    const statsContainer = document.getElementById('historyStats');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="history-stat-card">
            <div class="stat-label">Average Download</div>
            <div class="stat-value">${stats.avgDownload.toFixed(1)} <span class="stat-unit">Mbps</span></div>
        </div>
        <div class="history-stat-card">
            <div class="stat-label">Average Upload</div>
            <div class="stat-value">${stats.avgUpload.toFixed(1)} <span class="stat-unit">Mbps</span></div>
        </div>
        <div class="history-stat-card">
            <div class="stat-label">Average Latency</div>
            <div class="stat-value">${stats.avgLatency.toFixed(1)} <span class="stat-unit">ms</span></div>
        </div>
        <div class="history-stat-card">
            <div class="stat-label">Tests Run</div>
            <div class="stat-value">${stats.testCount}</div>
        </div>
    `;
    
    statsContainer.hidden = false;
}
