#!/bin/bash
# AetherLink Webapp Stop Script
# Safely stops backend and frontend services

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="/home/major/aetherlink"

echo -e "${BOLD}${BLUE}Stopping AetherLink Webapp...${NC}"
echo ""

cd "$PROJECT_DIR"

# Function to kill process gracefully
kill_process() {
    local pid=$1
    local name=$2

    if [ -n "$pid" ] && ps -p $pid > /dev/null 2>&1; then
        echo -e "  ${YELLOW}Stopping $name (PID: $pid)...${NC}"

        # Try graceful shutdown first
        kill $pid 2>/dev/null

        # Wait up to 5 seconds for graceful shutdown
        for i in {1..5}; do
            if ! ps -p $pid > /dev/null 2>&1; then
                echo -e "  ${GREEN}✓${NC} $name stopped"
                return 0
            fi
            sleep 1
        done

        # Force kill if still running
        echo -e "  ${YELLOW}Force killing $name...${NC}"
        kill -9 $pid 2>/dev/null

        sleep 1

        if ! ps -p $pid > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $name stopped (force)"
            return 0
        else
            echo -e "  ${RED}✗${NC} Failed to stop $name"
            return 1
        fi
    else
        echo -e "  ${BLUE}ℹ${NC} $name not running"
        return 0
    fi
}

# Stop using saved PIDs
if [ -f "temp/backend.pid" ]; then
    BACKEND_PID=$(cat temp/backend.pid)
    kill_process "$BACKEND_PID" "Backend"
    rm -f temp/backend.pid
else
    echo -e "  ${BLUE}ℹ${NC} No saved backend PID"
fi

if [ -f "temp/frontend.pid" ]; then
    FRONTEND_PID=$(cat temp/frontend.pid)
    kill_process "$FRONTEND_PID" "Frontend"
    rm -f temp/frontend.pid
else
    echo -e "  ${BLUE}ℹ${NC} No saved frontend PID"
fi

# Fallback: kill by name
echo ""
echo -e "${BLUE}Checking for any remaining processes...${NC}"

# Kill any remaining hypercorn processes
if pgrep -f "hypercorn.*backend.main:app" > /dev/null; then
    echo -e "  ${YELLOW}Found remaining backend processes${NC}"
    pkill -f "hypercorn.*backend.main:app"
    sleep 1
    echo -e "  ${GREEN}✓${NC} Cleaned up backend processes"
fi

# Kill any remaining vite processes
if pgrep -f "vite" > /dev/null; then
    echo -e "  ${YELLOW}Found remaining frontend processes${NC}"
    pkill -f "vite"
    sleep 1
    echo -e "  ${GREEN}✓${NC} Cleaned up frontend processes"
fi

# Check ports
echo ""
echo -e "${BLUE}Checking ports...${NC}"

if lsof -Pi :9000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${RED}✗${NC} Port 9000 still in use"
    lsof -Pi :9000 -sTCP:LISTEN
else
    echo -e "  ${GREEN}✓${NC} Port 9000 is free"
fi

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${RED}✗${NC} Port 3001 still in use"
    lsof -Pi :3001 -sTCP:LISTEN
else
    echo -e "  ${GREEN}✓${NC} Port 3001 is free"
fi

echo ""
echo -e "${GREEN}Webapp stopped!${NC}"
