#!/usr/bin/env bash
# Copies the browser app into dist/ for Cloudflare (Workers static assets or
# Pages). Nothing is compiled; only the files the app needs are copied.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
cp -r app/index.html app/style.css app/icon.svg app/_headers app/js app/fonts app/audio dist/
echo "dist/ ready: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"
