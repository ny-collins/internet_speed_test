#!/bin/bash
# Build bundled CSS from source files
# Run this whenever you modify files in css/ folder

echo "Building styles-bundled.css from source files..."

cat css/variables.css \
    css/base.css \
    css/layout.css \
    css/components.css \
    css/features.css \
    css/pages.css \
    css/utils.css > styles-bundled.css

echo "✅ styles-bundled.css rebuilt successfully!"
echo "File size: $(wc -l < styles-bundled.css) lines"
