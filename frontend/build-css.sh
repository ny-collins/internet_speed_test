#!/bin/bash
# Build main CSS from source files
# Run this whenever you modify files in css/ folder

echo "Building main.css from source files..."

cat css/variables.css \
    css/base.css \
    css/layout.css \
    css/stage-tray.css \
    css/components.css \
    css/gauge.css \
    css/pages.css \
    css/utils.css > main.css

echo "✅ main.css rebuilt successfully!"
echo "File size: $(wc -l < main.css) lines"
