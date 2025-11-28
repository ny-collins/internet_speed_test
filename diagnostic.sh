#!/bin/bash

echo "===== SpeedCheck Diagnostic Report ====="
echo ""

echo "1. Checking servers..."
echo "Backend (port 3000):"
curl -s http://localhost:3000/api/info 2>&1 | head -5
echo ""
echo "Frontend (port 8080):"
curl -sI http://localhost:8080/ 2>&1 | head -3
echo ""

echo "2. Testing API endpoints..."
echo "- Ping:"
curl -s http://localhost:3000/api/ping 2>&1 | grep -o "timestamp\|server" | head -2
echo "- Download (1MB):"
timeout 2 curl -s -o /dev/null -w "Status: %{http_code}, Speed: %{speed_download}\n" "http://localhost:3000/api/download?size=1"
echo ""

echo "3. Checking deployed versions..."
echo "Railway Backend:"
curl -s https://speed-test-backend.up.railway.app/api/info 2>&1 | grep -o "location\|version" | head -2
echo "Railway Frontend:"
curl -sI https://speed-test.up.railway.app/ 2>&1 | grep -i "server\|date" | head -2
echo "Cloudflare Frontend:"
curl -sI https://speed-test-ahc.pages.dev/ 2>&1 | grep -i "date\|cf-ray" | head -2
echo ""

echo "4. Checking module files..."
cd /home/collins/Desktop/internet_speed_test/frontend/js
for file in *.js; do
    echo -n "$file: "
    if grep -q "export" "$file"; then
        exports=$(grep -c "^export " "$file")
        imports=$(grep -c "^import " "$file")
        echo "✓ ($imports imports, $exports exports)"
    else
        echo "✗ (no exports)"
    fi
done
echo ""

echo "5. Checking for common issues..."
cd /home/collins/Desktop/internet_speed_test
echo "Circular dependencies:"
grep -r "import.*from.*main.js" frontend/js/ 2>/dev/null && echo "  ⚠ Found!" || echo "  ✓ None"
echo "Missing exports:"
grep -r "export function\|export const\|export async" frontend/js/ | wc -l | xargs echo "  Total exports:"
echo "Console.log statements:"
grep -r "console\\.log\\|console\\.error" frontend/js/ | wc -l | xargs echo "  Total:"
echo ""

echo "===== Diagnostic Complete ====="
