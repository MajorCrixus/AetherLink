#!/bin/bash
# AetherLink Webapp Restart Script
# Stops and restarts both backend and frontend services

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="/home/major/aetherlink"

echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║          AetherLink SATCOM Webapp Restart Manager               ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR"

# Check if scripts exist
if [ ! -f "stop-webapp.sh" ]; then
    echo -e "${RED}Error: stop-webapp.sh not found${NC}"
    exit 1
fi

if [ ! -f "start-webapp.sh" ]; then
    echo -e "${RED}Error: start-webapp.sh not found${NC}"
    exit 1
fi

# Make sure scripts are executable
chmod +x stop-webapp.sh
chmod +x start-webapp.sh

# Stop the webapp
echo -e "${BOLD}${YELLOW}Step 1: Stopping webapp...${NC}"
echo ""
./stop-webapp.sh

# Wait a moment to ensure everything is cleaned up
sleep 2

echo ""
echo -e "${BOLD}${YELLOW}Step 2: Starting webapp...${NC}"
echo ""

# Start the webapp
./start-webapp.sh

# Check if restart was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${GREEN}║                 Restart Complete!                                ║${NC}"
    echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
else
    echo ""
    echo -e "${BOLD}${RED}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${RED}║                 Restart Failed!                                  ║${NC}"
    echo -e "${BOLD}${RED}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Check the logs for more information:${NC}"
    echo -e "  Backend:  tail -f $PROJECT_DIR/temp/backend.log"
    echo -e "  Frontend: tail -f $PROJECT_DIR/temp/frontend.log"
    echo ""
    exit 1
fi
