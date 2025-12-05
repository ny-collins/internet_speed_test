#!/usr/bin/env node

/**
 * Build script to inject version from package.json into frontend files
 * This ensures version consistency across sw.js, index.html, and other files
 * * Usage: node build-version.js
 * Run this before deployment or as part of CI/CD
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Equivalent to __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define public directory path
const publicDir = path.join(__dirname, 'public');

// Read version from package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`📦 Building version ${version}...`);

// ========================================
// UPDATE SERVICE WORKER (sw.js)
// ========================================

const swPath = path.join(publicDir, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Update CACHE_NAME
swContent = swContent.replace(
    /const CACHE_NAME = 'speedcheck-v[\d.]+';/,
    `const CACHE_NAME = 'speedcheck-v${version}';`
);

// Update versioned assets in ASSETS_TO_CACHE
swContent = swContent.replace(
    /\/main\.js\?v=[\d.]+'/g,
    `/main.js?v=${version}'`
);
swContent = swContent.replace(
    /\/main\.css\?v=[\d.]+'/g,
    `/main.css?v=${version}'`
);

fs.writeFileSync(swPath, swContent, 'utf8');
console.log('✅ Updated sw.js');

// ========================================
// UPDATE ALL HTML FILES IN PUBLIC ROOT
// ========================================

const htmlFiles = fs.readdirSync(publicDir).filter(file => file.endsWith('.html'));

htmlFiles.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace all versioned asset references
    content = content.replace(
        /\/(css|js)\/[^"]+\?v=[\d.]+"/g,
        (match) => {
            return match.replace(/\?v=[\d.]+/, `?v=${version}`);
        }
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${file}`);
});

// ========================================
// UPDATE LEARN SUBPAGES (learn/*.html)
// ========================================

const learnDir = path.join(publicDir, 'learn');
if (fs.existsSync(learnDir)) {
    const learnFiles = fs.readdirSync(learnDir).filter(file => file.endsWith('.html'));
    
    learnFiles.forEach(file => {
        const filePath = path.join(learnDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace all versioned asset references
        content = content.replace(
            /\/(css|js)\/[^"]+\?v=[\d.]+"/g,
            (match) => {
                return match.replace(/\?v=[\d.]+/, `?v=${version}`);
            }
        );
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated learn/${file}`);
    });
}

// ========================================
// SUMMARY
// ========================================

console.log('\n🎉 Version ' + version + ' injected successfully!');
console.log('\nFiles updated:');
console.log('  - sw.js (CACHE_NAME + assets)');
console.log('  - *.html (all root HTML files)');
if (fs.existsSync(learnDir)) {
    console.log('  - learn/*.html (all subpages)');
}
console.log('\n✨ Ready for deployment!\n');
