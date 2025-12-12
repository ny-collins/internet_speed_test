import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const API_URL = process.env.API_URL || 'https://speed-test-backend.up.railway.app';

app.disable('x-powered-by');

app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        'default-src \'self\';' +
        'script-src \'self\' https://unpkg.com \'sha256-svcEdWetH/z7RMYzmk3gQcGOgRHKrwMZvIO6FLJpIIU=\' \'sha256-Ngw5Ck3DqZdp6C8FAwkH5ltLdQafJj5x8MJ/ih+UtJs=\' \'sha256-HS381vMuIXW0YhrHSamSPoWoss5z0sDtb+bw2qwO96A=\'; ' +
        'style-src \'self\'; ' +
        'img-src \'self\' data: https:; ' +
        'font-src \'self\' data:; ' +
        `connect-src 'self' ${API_URL} https://unpkg.com; ` +
        'worker-src \'self\' blob:; ' +
        'frame-ancestors \'none\'; ' +
        'base-uri \'self\'; ' +
        'form-action \'self\';'
    );

    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    res.setHeader('X-Frame-Options', 'DENY');

    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

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

app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.match(/\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webmanifest)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
