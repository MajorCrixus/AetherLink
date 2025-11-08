#!/bin/bash
# AetherLink installation script for Raspberry Pi/Ubuntu

set -e

echo "🛰️  AetherLink SATCOM Control System Installer"
echo "=============================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Check OS compatibility
if ! command -v apt &> /dev/null; then
    echo "❌ This installer requires a Debian/Ubuntu-based system with apt package manager."
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required system packages
echo "📦 Installing system dependencies..."
sudo apt install -y \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    docker.io \
    docker-compose \
    nginx \
    ufw

# Create aetherlink user and directories
echo "👤 Creating aetherlink user and directories..."
sudo useradd -r -m -s /bin/bash aetherlink || true

# Add users to docker group
echo "🐳 Configuring Docker permissions..."
sudo usermod -aG docker $USER
sudo usermod -aG docker aetherlink
sudo mkdir -p /opt/aetherlink
sudo mkdir -p /var/log/aetherlink
sudo mkdir -p /etc/aetherlink

# Set permissions
sudo chown aetherlink:aetherlink /opt/aetherlink
sudo chown aetherlink:aetherlink /var/log/aetherlink
sudo chown aetherlink:aetherlink /etc/aetherlink

# Copy application files
echo "📋 Installing AetherLink application..."
sudo cp -r . /opt/aetherlink/
sudo chown -R aetherlink:aetherlink /opt/aetherlink/

# Install systemd service
echo "⚙️  Installing systemd service..."
sudo cp aetherlink.service /etc/systemd/system/
sudo systemctl daemon-reload

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 9000/tcp  # AetherLink web interface
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# Create environment file
echo "🔧 Creating configuration..."
sudo tee /etc/aetherlink/aetherlink.env > /dev/null <<EOF
# AetherLink Configuration
DEMO_MODE=true
LOG_LEVEL=INFO
HOST=0.0.0.0
PORT=9000

# Hardware Configuration (update for your setup)
GPS_PORT=/dev/ttyAMA0
IMU_PORT=/dev/imu
RS485_PORT=/dev/rs485

# Safety Limits
AZ_MIN=-300
AZ_MAX=300
EL_MIN=-59
EL_MAX=59
CL_MIN=-10
CL_MAX=10

# Servo Addresses
SERVO_AZ_ADDR=1
SERVO_EL_ADDR=2
SERVO_CL_ADDR=3
EOF

# Enable and start service
echo "🚀 Starting AetherLink service..."
sudo systemctl enable aetherlink
sudo systemctl start aetherlink

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 30

# Check service status
if sudo systemctl is-active --quiet aetherlink; then
    echo "✅ AetherLink service is running!"
    echo ""
    echo "🌐 Web interface: http://$(hostname -I | awk '{print $1}'):9000"
    echo "📊 Service status: sudo systemctl status aetherlink"
    echo "📝 Logs: sudo journalctl -u aetherlink -f"
    echo ""
    echo "🔧 Configuration files:"
    echo "   • /etc/aetherlink/aetherlink.env"
    echo "   • /opt/aetherlink/docker-compose.yml"
    echo ""
    echo "⚠️  Note: You may need to log out and back in for Docker permissions to take effect."
else
    echo "❌ Failed to start AetherLink service"
    echo "📝 Check logs: sudo journalctl -u aetherlink"
    exit 1
fi

echo ""
echo "🎉 AetherLink installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure your hardware devices in /etc/aetherlink/aetherlink.env"
echo "2. Update docker-compose.yml to map your hardware devices"
echo "3. Restart the service: sudo systemctl restart aetherlink"
echo "4. Access the web interface and switch from demo mode to hardware mode"