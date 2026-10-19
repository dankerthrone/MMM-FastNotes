#!/usr/bin/env bash
set -e

MODULE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MODULE_DIR"

echo "=== MMM-FastNotes Setup ==="

1. Python venv
if [ ! -d .venv ]; then
  echo "Creating Python venv..."
  python3 -m venv .venv
fi

2. Python dependencies
echo "Installing Python dependencies..."
.venv/bin/pip install -q -r requirements.txt

3. PM2 (if available)
if command -v pm2 &>/dev/null; then
  if ! pm2 describe fastnotes &>/dev/null; then
    echo "Starting FastNotes backend via PM2..."
    pm2 start .venv/bin/python3 --name fastnotes -- FastNotes.py --host 0.0.0.0 --port 5000
    pm2 save
  else
    echo "PM2 process 'fastnotes' already exists — skipping."
  fi
else
  echo "PM2 not found. Start backend manually:"
  echo "  .venv/bin/python3 FastNotes.py --host 0.0.0.0 --port 5000"
fi

echo "=== Setup complete ==="
