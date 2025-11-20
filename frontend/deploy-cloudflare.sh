#!/bin/bash
# Cloudflare Pages Deployment Script

echo "🚀 Preparing Cloudflare Pages deployment..."

# 1. Bundle CSS files
echo "📦 Bundling CSS files..."
cat css/variables.css css/base.css css/components.css css/layout.css css/features.css css/pages.css css/utils.css > styles-bundled.css

# 2. Update cache busting version
VERSION=$(date +%s)
echo "🔄 Cache busting version: $VERSION"

# 3. Deploy to Cloudflare Pages
echo "☁️  Deploying to Cloudflare Pages..."
wrangler pages deploy . --project-name=speed-test

echo "✅ Deployment complete!"
echo ""
echo "📝 Post-deployment checklist:"
echo "   1. Verify styles are loading at: https://your-site.pages.dev/styles-bundled.css"
echo "   2. Check browser console for any JavaScript errors"
echo "   3. Test the start button functionality"
echo "   4. Verify API calls to Railway backend are working"
