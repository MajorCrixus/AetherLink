#!/bin/bash
# install.sh — AetherLink Jetson Environment Installer

set -e

echo "🛰️  Starting AetherLink environment setup for Jetson AGX Orin..."

# Update and upgrade system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dependencies
echo "🐍 Installing Python and core dependencies..."
sudo apt install -y python3 python3-pip python3-venv \
  gpsd gpsd-clients i2c-tools git build-essential \
  libatlas-base-dev libffi-dev

# Optional Jetson dev tools
sudo apt install -y python3-dev libssl-dev

# Set up project directory structure
echo "📁 Setting up project folders..."
mkdir -p software/{controller,sensors,sdr,ui,config}
mkdir -p docs scripts hardware logs examples

# Create virtual environment (optional)
echo "🐍 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python libraries
echo "📚 Installing Python packages..."
pip install --upgrade pip
pip install typer flask pyserial skyfield numpy

# Add more as needed for signal processing or ML

echo "✅ AetherLink environment setup complete."
echo "💡 Next step: run python3 main.py or start the UI server."
