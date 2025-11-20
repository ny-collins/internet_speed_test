// ========================================
// MICRO-CHART MODULE
// Lightweight canvas charting for history
// ========================================

export function drawHistoryChart(historyData) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Resize for high-DPI displays
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!historyData || historyData.length < 2) {
        drawEmptyState(ctx, rect.width, rect.height);
        return;
    }

    // Extract data (Reverse because history is newest-first)
    // Limit to last 20 points for readability
    const data = [...historyData].reverse().slice(-20);

    // Dimensions
    const padding = 20;
    const width = rect.width - (padding * 2);
    const height = rect.height - (padding * 2);

    // Scales
    const maxSpeed = Math.max(...data.map(d => Math.max(d.download, d.upload))) * 1.1; // +10% headroom
    const stepX = width / (data.length - 1);

    // --- DRAW DOWNLOAD LINE (Blue) ---
    drawSmoothLine(ctx, data, 'download', maxSpeed, stepX, height, padding, '#3b82f6', 'rgba(59, 130, 246, 0.1)');

    // --- DRAW UPLOAD LINE (Purple) ---
    drawSmoothLine(ctx, data, 'upload', maxSpeed, stepX, height, padding, '#8b5cf6', 'rgba(139, 92, 246, 0.1)');

    // --- DRAW AXIS LINES ---
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--color-border');
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Bottom line
    ctx.moveTo(padding, height + padding);
    ctx.lineTo(width + padding, height + padding);
    ctx.stroke();
}

function drawSmoothLine(ctx, data, key, maxVal, stepX, height, padding, color, fill) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Move to first point
    const firstY = (height + padding) - ((data[0][key] / maxVal) * height);
    ctx.moveTo(padding, firstY);

    // Draw curves
    for (let i = 0; i < data.length - 1; i++) {
        const x_current = padding + (i * stepX);
        const y_current = (height + padding) - ((data[i][key] / maxVal) * height);

        const x_next = padding + ((i + 1) * stepX);
        const y_next = (height + padding) - ((data[i + 1][key] / maxVal) * height);

        // Control points for bezier curve (smoothness)
        const cp1x = x_current + (stepX / 2);
        const cp1y = y_current;
        const cp2x = x_next - (stepX / 2);
        const cp2y = y_next;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x_next, y_next);
    }

    ctx.stroke();

    // Draw Fill Area (Gradient)
    ctx.lineTo(padding + ((data.length - 1) * stepX), height + padding); // Bottom right
    ctx.lineTo(padding, height + padding); // Bottom left
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

function drawEmptyState(ctx, w, h) {
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--color-text-tertiary');
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Not enough data for graph', w / 2, h / 2);
}
