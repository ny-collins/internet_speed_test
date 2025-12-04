#!/bin/bash
# Build main CSS from source files
# Run this whenever you modify files in css/ folder

echo "Building main.css from source files..."

cat public/css/vars.css \
    public/css/base.css \
    public/css/layout.css \
    public/css/pages/home.css \
    public/css/components.css \
    public/css/pages.css \
    public/css/utils.css > public/css/main.css

echo "✅ main.css rebuilt successfully!"
echo "File size: $(wc -l < public/css/main.css) lines"
