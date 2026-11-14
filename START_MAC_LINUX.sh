#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Install Node.js 22 or newer"; exit 1; }
[ -f .env ] || { echo "Copy .env.example to .env and enter your key"; exit 1; }
[ -d node_modules ] || npm install
npm start
