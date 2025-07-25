#!/bin/bash
# AetherLink Startup Script
# Initializes environment and launches the main CLI utility

"""
From the terminal:
chmod +x scripts/start.sh
./scripts/start.sh status
./scripts/start.sh calibrate
"""

echo "🚀 Starting AetherLink System..."

# Ensure script is running from repo root
cd "$(dirname "$0")/.."

# Activate virtualenv if exists
if [ -d "venv" ]; then
  echo "🧪 Activating Python virtual environment..."
  source venv/bin/activate
fi

# Launch main Typer CLI
python3 main.py "$@"
