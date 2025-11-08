#!/bin/bash
# AetherLink Frontend Startup Script
# Starts the React/Vite development server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AetherLink Frontend Startup ===${NC}"

# Check if we're in the right directory
if [ ! -d "webapp/frontend" ]; then
    echo -e "${RED}Error: Must run from /home/major/Desktop/aetherlink${NC}"
    exit 1
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port 3000 is already in use${NC}"
    lsof -Pi :3000 -sTCP:LISTEN
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "webapp/frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd webapp/frontend
    npm install
    cd ../..
fi

# Check if backend is running
if ! curl -s http://localhost:9000/health >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Backend (port 9000) doesn't appear to be running${NC}"
    echo "  Start the backend first with: ./start-backend.sh"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Starting frontend on http://localhost:3000${NC}"
echo "Press Ctrl+C to stop"
echo ""

# Start development server
cd webapp/frontend
npm run dev
