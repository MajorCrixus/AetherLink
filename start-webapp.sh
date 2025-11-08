#!/bin/bash
# AetherLink Complete Webapp Startup Script
# Starts both backend (port 9000) and frontend (port 3001) with network access
# Handles port conflicts gracefully and ensures firewall is configured

set -e

# ============================================================================
# Configuration
# ============================================================================

BACKEND_PORT=9000
FRONTEND_PORT=3001
PROJECT_DIR="/home/major/aetherlink"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║          AetherLink SATCOM Webapp Startup Manager               ║${NC}"
    echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo -e "${BOLD}${GREEN}▶ $1${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

check_port_available() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

get_port_pid() {
    local port=$1
    lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null || echo ""
}

get_port_process() {
    local port=$1
    lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | tail -n +2 || echo ""
}

kill_port() {
    local port=$1
    local pid=$(get_port_pid $port)

    if [ -n "$pid" ]; then
        print_info "Killing process $pid on port $port..."
        kill $pid 2>/dev/null || sudo kill $pid 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if check_port_available $port; then
            return 0
        else
            print_warning "Process still running, force killing..."
            kill -9 $pid 2>/dev/null || sudo kill -9 $pid 2>/dev/null || true
            sleep 1
        fi
    fi
}

check_firewall() {
    local port=$1

    # Check if ufw is active
    if systemctl is-active --quiet ufw 2>/dev/null; then
        # Check if port is allowed (this requires sudo, so we'll provide instructions)
        print_info "Checking firewall for port $port..."

        # Try to check without sudo first
        if sudo ufw status 2>/dev/null | grep -q "^$port.*ALLOW" 2>/dev/null; then
            print_success "Port $port is allowed in firewall"
            return 0
        else
            print_warning "Port $port may not be allowed in firewall"
            echo -e "    ${YELLOW}Run this command to open the port:${NC}"
            echo -e "    ${BOLD}sudo ufw allow $port/tcp${NC}"
            echo ""
            return 1
        fi
    else
        print_info "Firewall (ufw) is not active"
        return 0
    fi
}

get_ip_address() {
    # Get first non-loopback IP
    hostname -I | awk '{print $1}'
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

print_header

print_section "Pre-flight Checks"

# Check directory
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"
print_success "Project directory: $PROJECT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_error "Virtual environment not found at ./venv"
    print_info "Create it with: python3 -m venv venv"
    exit 1
fi
print_success "Python virtual environment found"

# Check if node_modules exists
if [ ! -d "webapp/frontend/node_modules" ]; then
    print_warning "Frontend dependencies not installed"
    print_info "Installing npm packages..."
    cd webapp/frontend
    npm install
    cd ../..
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies found"
fi

# Get IP address
IP_ADDR=$(get_ip_address)
print_success "Network IP: $IP_ADDR"

echo ""

# ============================================================================
# Backend Port Check (Port 9000)
# ============================================================================

print_section "Checking Backend Port ($BACKEND_PORT)"

if ! check_port_available $BACKEND_PORT; then
    print_warning "Port $BACKEND_PORT is already in use"

    # Show what's using it
    echo -e "${YELLOW}    Process using port $BACKEND_PORT:${NC}"
    get_port_process $BACKEND_PORT | while read line; do
        echo "      $line"
    done
    echo ""

    read -p "    Kill existing process and continue? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port $BACKEND_PORT

        if check_port_available $BACKEND_PORT; then
            print_success "Port $BACKEND_PORT is now available"
        else
            print_error "Failed to free port $BACKEND_PORT"
            exit 1
        fi
    else
        print_error "Cannot continue with port $BACKEND_PORT in use"
        print_info "Stop the existing process manually or choose a different port"
        exit 1
    fi
else
    print_success "Port $BACKEND_PORT is available"
fi

echo ""

# ============================================================================
# Frontend Port Check (Port 3001)
# ============================================================================

print_section "Checking Frontend Port ($FRONTEND_PORT)"

if ! check_port_available $FRONTEND_PORT; then
    print_warning "Port $FRONTEND_PORT is already in use"

    # Show what's using it
    echo -e "${YELLOW}    Process using port $FRONTEND_PORT:${NC}"
    get_port_process $FRONTEND_PORT | while read line; do
        echo "      $line"
    done
    echo ""

    read -p "    Kill existing process and continue? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port $FRONTEND_PORT

        if check_port_available $FRONTEND_PORT; then
            print_success "Port $FRONTEND_PORT is now available"
        else
            print_error "Failed to free port $FRONTEND_PORT"
            exit 1
        fi
    else
        print_error "Cannot continue with port $FRONTEND_PORT in use"
        exit 1
    fi
else
    print_success "Port $FRONTEND_PORT is available"
fi

echo ""

# ============================================================================
# Firewall Configuration
# ============================================================================

print_section "Firewall Configuration"

FIREWALL_OK=true

if ! check_firewall $BACKEND_PORT; then
    FIREWALL_OK=false
fi

if ! check_firewall $FRONTEND_PORT; then
    FIREWALL_OK=false
fi

if ! $FIREWALL_OK; then
    echo ""
    read -p "    Configure firewall now? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Opening firewall ports..."
        sudo ufw allow $BACKEND_PORT/tcp
        sudo ufw allow $FRONTEND_PORT/tcp
        print_success "Firewall configured"
    else
        print_warning "Continuing without firewall configuration"
        print_info "You may not be able to access from remote computers"
    fi
fi

echo ""

# ============================================================================
# Hardware Configuration Check
# ============================================================================

print_section "Hardware Configuration"

if [ -f "tools/config/ports.json" ]; then
    if command -v jq &> /dev/null; then
        IMU_PORT=$(jq -r '.imu.device' tools/config/ports.json 2>/dev/null || echo "unknown")
        RS485_PORT=$(jq -r '.rs485.device' tools/config/ports.json 2>/dev/null || echo "unknown")

        print_info "IMU:   $IMU_PORT"
        print_info "RS485: $RS485_PORT"

        # Check if devices exist
        if [ -e "$RS485_PORT" ]; then
            print_success "RS485 device found"
        else
            print_warning "RS485 device not found: $RS485_PORT"
        fi
    else
        print_info "Install jq for hardware details: sudo apt install jq"
    fi
else
    print_warning "Hardware config not found: tools/config/ports.json"
fi

echo ""

# ============================================================================
# Start Backend
# ============================================================================

print_section "Starting Backend (Hypercorn on port $BACKEND_PORT)"

# Check Python dependencies
if ! venv/bin/python -c "import fastapi" 2>/dev/null; then
    print_warning "Backend dependencies not installed"
    print_info "Installing backend requirements..."
    venv/bin/pip install -r webapp/backend/requirements.txt
    print_success "Backend dependencies installed"
fi

# Start backend in background
print_info "Starting backend server..."

cd webapp
PYTHONPATH=/home/major/aetherlink ../venv/bin/hypercorn backend.main:app \
    --bind 0.0.0.0:$BACKEND_PORT \
    --log-level warning \
    --access-log - \
    > ../temp/backend.log 2>&1 &

BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    print_success "Backend started (PID: $BACKEND_PID)"
    print_info "Backend logs: $PROJECT_DIR/temp/backend.log"

    # Try to connect
    if curl -s http://localhost:$BACKEND_PORT/docs > /dev/null 2>&1; then
        print_success "Backend responding on http://localhost:$BACKEND_PORT"
    else
        print_warning "Backend started but not responding yet (may still be initializing)"
    fi
else
    print_error "Backend failed to start"
    print_info "Check logs: tail -f temp/backend.log"
    exit 1
fi

echo ""

# ============================================================================
# Start Frontend
# ============================================================================

print_section "Starting Frontend (Vite on port $FRONTEND_PORT)"

print_info "Starting frontend development server..."

cd webapp/frontend
npm run dev > ../../temp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Wait for frontend to start
sleep 3

# Check if frontend is running
if ps -p $FRONTEND_PID > /dev/null; then
    print_success "Frontend started (PID: $FRONTEND_PID)"
    print_info "Frontend logs: $PROJECT_DIR/temp/frontend.log"

    # Try to connect
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        print_success "Frontend responding on http://localhost:$FRONTEND_PORT"
    else
        print_warning "Frontend started but not responding yet (Vite may still be compiling)"
    fi
else
    print_error "Frontend failed to start"
    print_info "Check logs: tail -f temp/frontend.log"

    # Kill backend since frontend failed
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo ""

# ============================================================================
# Success Summary
# ============================================================================

print_section "Startup Complete!"

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                    Access Your Webapp                            ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}From this computer:${NC}"
echo -e "  Frontend:    ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  Backend:     ${GREEN}http://localhost:$BACKEND_PORT${NC}"
echo -e "  Swagger API: ${GREEN}http://localhost:$BACKEND_PORT/docs${NC}"
echo ""
echo -e "${BOLD}From other computers on your network:${NC}"
echo -e "  Frontend:    ${GREEN}http://$IP_ADDR:$FRONTEND_PORT${NC}"
echo -e "  Backend:     ${GREEN}http://$IP_ADDR:$BACKEND_PORT${NC}"
echo -e "  Swagger API: ${GREEN}http://$IP_ADDR:$BACKEND_PORT/docs${NC}"
echo ""
echo -e "${BOLD}Process IDs:${NC}"
echo -e "  Backend PID:  $BACKEND_PID"
echo -e "  Frontend PID: $FRONTEND_PID"
echo ""
echo -e "${BOLD}Logs:${NC}"
echo -e "  Backend:  tail -f $PROJECT_DIR/temp/backend.log"
echo -e "  Frontend: tail -f $PROJECT_DIR/temp/frontend.log"
echo ""
echo -e "${BOLD}To stop:${NC}"
echo -e "  Kill backend:  kill $BACKEND_PID"
echo -e "  Kill frontend: kill $FRONTEND_PID"
echo -e "  Or use:        ./stop-webapp.sh"
echo ""
echo -e "${YELLOW}Note: Processes are running in background. Close this terminal safely.${NC}"
echo -e "${YELLOW}Hardware initialization may take 10-15 seconds. Check temp/backend.log if needed.${NC}"
echo ""

# Save PIDs for easy stopping later
echo "$BACKEND_PID" > temp/backend.pid
echo "$FRONTEND_PID" > temp/frontend.pid

print_success "Startup script complete!"
echo ""
