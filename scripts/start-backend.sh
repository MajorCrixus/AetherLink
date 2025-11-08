#!/bin/bash
# AetherLink Backend Startup Script
# Starts the FastAPI backend server with hardware integration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AetherLink Backend Startup ===${NC}"

# Check if we're in the right directory
if [ ! -d "webapp/backend" ]; then
    echo -e "${RED}Error: Must run from /home/major/Desktop/aetherlink${NC}"
    exit 1
fi

# Check if port 9000 is already in use
if lsof -Pi :9000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port 9000 is already in use${NC}"
    echo "Existing process:"
    lsof -Pi :9000 -sTCP:LISTEN
    echo ""
    read -p "Kill existing process and continue? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -Pi :9000 -sTCP:LISTEN -t)
        echo -e "${YELLOW}Killing process $PID...${NC}"
        kill $PID 2>/dev/null || sudo kill $PID
        sleep 2
    else
        echo -e "${RED}Aborted${NC}"
        exit 1
    fi
fi

# Check virtual environment
if [ ! -d "venv" ]; then
    echo -e "${RED}Error: Virtual environment not found at ./venv${NC}"
    exit 1
fi

# Check required packages
if ! venv/bin/python -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    venv/bin/pip install -r webapp/backend/requirements.txt
fi

# Display hardware configuration
echo -e "${GREEN}Hardware Configuration:${NC}"
if [ -f "tools/config/ports.json" ]; then
    echo "  IMU:   $(jq -r '.imu.device' tools/config/ports.json)"
    echo "  RS485: $(jq -r '.rs485.device' tools/config/ports.json)"
else
    echo -e "${YELLOW}  Warning: ports.json not found${NC}"
fi

echo ""
echo -e "${GREEN}Starting backend on http://0.0.0.0:9000${NC}"
echo "Press Ctrl+C to stop"
echo ""

# Set Python path and start server
cd webapp
PYTHONPATH=/home/major/Desktop/aetherlink ../venv/bin/hypercorn backend.main:app \
    --bind 0.0.0.0:9000 \
    --log-level info \
    --access-log -
