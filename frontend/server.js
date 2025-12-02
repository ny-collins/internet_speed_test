import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Remove X-Powered-By header (information leak)
app.disable('x-powered-by');

// Security headers middleware
app.use((req, res, next) => {
    // Content Security Policy
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https://speed-test-backend.up.railway.app; " +
        "worker-src 'self' blob:; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';"
    );
    
    // HSTS - Force HTTPS for 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy (restrict features)
    res.setHeader('Permissions-Policy', 
        'geolocation=(), ' +
        'microphone=(), ' +
        'camera=(), ' +
        'payment=(), ' +
        'usb=(), ' +
        'magnetometer=(), ' +
        'gyroscope=()'
    );
    
    next();
});

// Cache control for static assets
app.use(express.static(__dirname, {
    extensions: ['html'],
    index: 'index.html',
    setHeaders: (res, filePath) => {
        // Aggressive caching for versioned assets (CSS, JS with ?v=x.x.x)
        if (filePath.match(/\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webmanifest)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
            // No caching for HTML to ensure fresh content
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
