#!/bin/bash
# Install sudoers configuration for AetherLink webapp
# Allows passwordless restart of webapp services

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  AetherLink Sudoers Configuration Installer            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

SUDOERS_FILE="/home/major/aetherlink/aetherlink-sudoers"
INSTALL_PATH="/etc/sudoers.d/aetherlink"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run with sudo${NC}"
    echo "Usage: sudo ./install-sudoers.sh"
    exit 1
fi

# Validate the sudoers file syntax
echo -e "${YELLOW}Validating sudoers file...${NC}"
if visudo -c -f "$SUDOERS_FILE" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Sudoers file syntax is valid${NC}"
else
    echo -e "${RED}✗ Sudoers file has syntax errors!${NC}"
    echo "Run: sudo visudo -c -f $SUDOERS_FILE"
    exit 1
fi

# Backup existing file if present
if [ -f "$INSTALL_PATH" ]; then
    echo -e "${YELLOW}Backing up existing configuration...${NC}"
    cp "$INSTALL_PATH" "${INSTALL_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Backup created${NC}"
fi

# Install the sudoers file
echo -e "${YELLOW}Installing sudoers configuration...${NC}"
cp "$SUDOERS_FILE" "$INSTALL_PATH"
chmod 440 "$INSTALL_PATH"
chown root:root "$INSTALL_PATH"
echo -e "${GREEN}✓ Installed to $INSTALL_PATH${NC}"

# Verify installation
echo -e "${YELLOW}Verifying installation...${NC}"
if visudo -c >/dev/null 2>&1; then
    echo -e "${GREEN}✓ System sudoers configuration is valid${NC}"
else
    echo -e "${RED}✗ System sudoers configuration has errors!${NC}"
    echo "Removing problematic file..."
    rm -f "$INSTALL_PATH"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Installation Complete!                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}The following commands can now run without password:${NC}"
echo "  • kill / killall (for stopping services)"
echo "  • ufw allow 9000/tcp, 3001/tcp (firewall config)"
echo "  • chmod on /dev/ttyUSB* and /dev/ttyACM* (serial ports)"
echo ""
echo -e "${YELLOW}Test with:${NC}"
echo "  sudo -n kill -0 \$\$ && echo 'Success: can kill without password'"
echo ""
