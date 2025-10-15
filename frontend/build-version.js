#!/usr/bin/env node

/**
 * Build script to inject version from package.json into frontend files
 * This ensures version consistency across sw.js, index.html, and other files
 * 
 * Usage: node build-version.js
 * Run this before deployment or as part of CI/CD
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

console.log(`📦 Building version ${version}...`);

// ========================================
// UPDATE SERVICE WORKER (sw.js)
// ========================================

const swPath = path.join(__dirname, 'sw.js');
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
// UPDATE INDEX.HTML
// ========================================

const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Update CSS version
indexContent = indexContent.replace(
    /\/main\.css\?v=[\d.]+"/g,
    `/main.css?v=${version}"`
);

// Update JS version
indexContent = indexContent.replace(
    /\/main\.js\?v=[\d.]+"/g,
    `/main.js?v=${version}"`
);

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('✅ Updated index.html');

// ========================================
// UPDATE LEARN.HTML (if exists)
// ========================================

const learnPath = path.join(__dirname, 'learn.html');
if (fs.existsSync(learnPath)) {
    let learnContent = fs.readFileSync(learnPath, 'utf8');
    
    learnContent = learnContent.replace(
        /\/main\.css\?v=[\d.]+"/g,
        `/main.css?v=${version}"`
    );
    learnContent = learnContent.replace(
        /\/main\.js\?v=[\d.]+"/g,
        `/main.js?v=${version}"`
    );
    
    fs.writeFileSync(learnPath, learnContent, 'utf8');
    console.log('✅ Updated learn.html');
}

// ========================================
// SUMMARY
// ========================================

console.log(`\n🎉 Version ${version} injected successfully!`);
console.log(`\nFiles updated:`);
console.log(`  - sw.js (CACHE_NAME + assets)`);
console.log(`  - index.html (CSS + JS versions)`);
if (fs.existsSync(learnPath)) {
    console.log(`  - learn.html (CSS + JS versions)`);
}
console.log(`\n✨ Ready for deployment!\n`);
