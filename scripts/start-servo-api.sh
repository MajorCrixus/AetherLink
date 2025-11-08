#!/bin/bash
# Start standalone MKS SERVO57D low-level API
# Provides direct access to all 50+ v1.0.6 commands via Swagger UI

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== MKS SERVO57D Low-Level API ===${NC}"

# Configuration
SERVO_PORT="${SERVO_PORT:-/dev/rs485}"
SERVO_BAUD="${SERVO_BAUD:-38400}"
SERVO_ADDR="${SERVO_ADDR:-1}"
SERVO_API_PORT="${SERVO_API_PORT:-8083}"

# Check if port is in use
if lsof -Pi :${SERVO_API_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port ${SERVO_API_PORT} is already in use${NC}"
    PID=$(lsof -Pi :${SERVO_API_PORT} -sTCP:LISTEN -t)
    echo "Killing process $PID..."
    kill $PID 2>/dev/null || sudo kill $PID
    sleep 1
fi

# Check serial port
if [ ! -e "$SERVO_PORT" ]; then
    echo -e "${RED}Error: Serial port $SERVO_PORT not found${NC}"
    echo "Available ports:"
    ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || echo "  None found"
    exit 1
fi

# Check permissions
if [ ! -r "$SERVO_PORT" ] || [ ! -w "$SERVO_PORT" ]; then
    echo -e "${YELLOW}Warning: No read/write permission on $SERVO_PORT${NC}"
    echo "Adding user to dialout group..."
    sudo usermod -a -G dialout $USER
    echo -e "${YELLOW}Please log out and back in for group changes to take effect${NC}"
fi

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Serial Port: $SERVO_PORT"
echo "  Baud Rate:   $SERVO_BAUD"
echo "  Servo Addr:  $SERVO_ADDR"
echo "  API Port:    $SERVO_API_PORT"
echo ""
echo -e "${GREEN}Starting low-level servo API...${NC}"
echo -e "Access Swagger UI at: ${YELLOW}http://0.0.0.0:${SERVO_API_PORT}/docs${NC}"
echo "Press Ctrl+C to stop"
echo ""

# Set Python path and start
cd /home/major/Desktop/aetherlink
PYTHONPATH=/home/major/Desktop/aetherlink \
./venv/bin/python -m hardware.motors.servo57d_api \
    --host 0.0.0.0 \
    --port ${SERVO_API_PORT} \
    --serial ${SERVO_PORT} \
    --baud ${SERVO_BAUD} \
    --addr ${SERVO_ADDR}
