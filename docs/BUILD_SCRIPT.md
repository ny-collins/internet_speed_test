# Version Management Build Script

## Overview

The `build-version.js` script automatically synchronizes version numbers across all frontend files, eliminating manual update errors and ensuring consistency.

## What It Does

The script reads the version from `package.json` and updates:

1. **Service Worker (`sw.js`)**
   - Cache name: `CACHE_NAME = 'speedcheck-v1.05.0'`
   - Versioned assets: `/main.js?v=1.05.0`, `/main.css?v=1.05.0`

2. **HTML Files (`index.html`, `learn.html`)**
   - CSS version: `<link href="/main.css?v=1.05.0">`
   - JS version: `<script src="/main.js?v=1.05.0">`

## Usage

### Manual Execution

```bash
cd frontend
node build-version.js
```

### As Part of Build Process

The script is automatically run before deployment via the `prebuild` npm script:

```bash
npm run build:version
```

## Version Update Workflow

1. **Update version in `package.json`:**
   ```json
   {
     "version": "1.06.0"
   }
   ```

2. **Run build script:**
   ```bash
   npm run build:version
   ```

3. **Verify changes:**
   - Check `sw.js` for updated `CACHE_NAME`
   - Check `index.html` for versioned assets
   - Check `learn.html` for versioned assets

4. **Commit and deploy:**
   ```bash
   git add -A
   git commit -m "Bump version to 1.06.0"
   git push
   ```

## CI/CD Integration

For automated deployments (Railway, Vercel, etc.), add to your build command:

```json
{
  "scripts": {
    "build": "npm run build:version && npm run start",
    "build:version": "node build-version.js"
  }
}
```

## Benefits

- ✅ **Consistency**: Version numbers always match across files
- ✅ **No Manual Errors**: Eliminates forgotten version updates
- ✅ **Cache Busting**: Ensures users get latest assets
- ✅ **PWA Updates**: Service worker detects new versions correctly
- ✅ **Developer Experience**: Single source of truth in `package.json`

## Troubleshooting

### Script Not Found

Ensure you're in the `frontend` directory:
```bash
cd frontend
node build-version.js
```

### Permission Denied

Make the script executable:
```bash
chmod +x build-version.js
```

### Version Not Updating

1. Check `package.json` has valid semver format
2. Verify file paths are correct
3. Ensure files are not read-only

## Technical Details

The script uses regex replacements to update version strings:

```javascript
// Service Worker cache name
/const CACHE_NAME = 'speedcheck-v[\d.]+';/

// Versioned asset URLs
/\/main\.js\?v=[\d.]+'/g
/\/main\.css\?v=[\d.]+"/g
```

This ensures only version-specific patterns are replaced, avoiding accidental changes to other code.
