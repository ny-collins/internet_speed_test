// ========================================
// ISP COMPARISON
// ========================================

import { DOM } from './dom.js';
import { CONFIG } from './config.js';

export function updateISPComparison(downloadSpeed) {
    if (!DOM.ispComparisonCard) return;
    
    const planSpeed = CONFIG.ispPlanSpeed || 100;
    const actualSpeed = downloadSpeed || 0;
    const percentage = planSpeed > 0 ? Math.min((actualSpeed / planSpeed) * 100, 150) : 0;
    
    // Show the card
    DOM.ispComparisonCard.hidden = false;
    
    // Update values
    if (DOM.ispPlanValue) {
        DOM.ispPlanValue.textContent = `${planSpeed} Mbps`;
    }
    
    if (DOM.ispActualValue) {
        DOM.ispActualValue.textContent = actualSpeed > 0 ? `${actualSpeed.toFixed(2)} Mbps` : '— Mbps';
    }
    
    // Update progress bar
    if (DOM.ispComparisonBarFill) {
        DOM.ispComparisonBarFill.style.width = `${percentage}%`;
    }
    
    if (DOM.ispComparisonBarLabel) {
        DOM.ispComparisonBarLabel.textContent = `${percentage.toFixed(0)}%`;
    }
    
    // Update verdict
    if (DOM.ispVerdictText && actualSpeed > 0) {
        const { verdict, message } = getISPVerdict(actualSpeed, planSpeed, percentage);
        DOM.ispVerdictText.textContent = message;
        DOM.ispVerdictText.className = `isp-comparison-verdict ${verdict}`;
    }
}

function getISPVerdict(actualSpeed, planSpeed, percentage) {
    if (percentage >= 90) {
        return {
            verdict: 'excellent',
            message: `🎉 Excellent! You're getting ${percentage.toFixed(0)}% of your advertised speed. Your ISP is delivering as promised.`
        };
    } else if (percentage >= 70) {
        return {
            verdict: 'good',
            message: `✅ Good performance. You're getting ${percentage.toFixed(0)}% of your advertised speed. This is acceptable for international testing.`
        };
    } else if (percentage >= 50) {
        return {
            verdict: 'fair',
            message: `⚠️ Fair performance. You're getting ${percentage.toFixed(0)}% of your advertised speed. Consider checking your connection or contacting your ISP.`
        };
    } else {
        return {
            verdict: 'poor',
            message: `❌ Significantly below expectations. You're only getting ${percentage.toFixed(0)}% of your advertised ${planSpeed} Mbps. Contact your ISP about this discrepancy.`
        };
    }
}

export function hideISPComparison() {
    if (DOM.ispComparisonCard) {
        DOM.ispComparisonCard.hidden = true;
    }
}
