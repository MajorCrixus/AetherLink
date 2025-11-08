#!/bin/bash
# Script to force rebuild Docker image and restart service

set -e

echo "🛑 Stopping aetherlink service..."
sudo systemctl stop aetherlink

echo "🗑️  Removing old Docker images..."
sudo docker-compose -f /opt/aetherlink/docker-compose.yml down --rmi all --volumes || true

echo "🔨 Force rebuilding Docker image..."
cd /opt/aetherlink
sudo docker-compose build --no-cache

echo "🚀 Starting aetherlink service..."
sudo systemctl start aetherlink

echo "✅ Done! Monitor with: journalctl -u aetherlink -f"
