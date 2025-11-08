"""
WebSocket connection manager for real-time data streaming
"""

import json
import logging
from typing import Dict, List, Any
from datetime import datetime
from uuid import uuid4

from fastapi import WebSocket

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections and broadcasts"""

    def __init__(self):
        # Dictionary of connection_id -> (websocket, channel)
        self.connections: Dict[str, tuple[WebSocket, str]] = {}
        # Channel subscriptions: channel -> list of connection_ids
        self.channels: Dict[str, List[str]] = {}

    async def connect(self, websocket: WebSocket, channel: str) -> str:
        """Add a new WebSocket connection"""
        import asyncio
        connection_id = str(uuid4())
        self.connections[connection_id] = (websocket, channel)

        # Add to channel subscription
        if channel not in self.channels:
            self.channels[channel] = []
        self.channels[channel].append(connection_id)

        logger.info(f"WebSocket connected: {connection_id} to channel '{channel}'")

        # Small delay to ensure connection is fully established
        await asyncio.sleep(0.1)

        return connection_id

    def disconnect(self, connection_id: str):
        """Remove a WebSocket connection"""
        if connection_id in self.connections:
            websocket, channel = self.connections[connection_id]
            del self.connections[connection_id]

            # Remove from channel subscription
            if channel in self.channels:
                if connection_id in self.channels[channel]:
                    self.channels[channel].remove(connection_id)
                # Clean up empty channels
                if not self.channels[channel]:
                    del self.channels[channel]

            logger.info(f"WebSocket disconnected: {connection_id} from channel '{channel}'")

    @property
    def client_count(self) -> int:
        """Get total number of connected clients"""
        return len(self.connections)

    def get_channel_count(self, channel: str) -> int:
        """Get number of clients subscribed to a channel"""
        return len(self.channels.get(channel, []))

    async def broadcast_to_channel(self, channel: str, data: Any):
        """Broadcast data to all clients in a channel"""
        if channel not in self.channels:
            return

        # Prepare message
        message = {
            "channel": channel,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        message_text = json.dumps(message, default=str)

        # Get connections for this channel
        connection_ids = self.channels[channel].copy()
        disconnected = []

        for connection_id in connection_ids:
            if connection_id not in self.connections:
                disconnected.append(connection_id)
                continue

            websocket, _ = self.connections[connection_id]
            try:
                await websocket.send_text(message_text)
            except RuntimeError as e:
                # Connection closed or not ready
                if "WebSocket is not connected" in str(e) or "Connection is closed" in str(e):
                    logger.debug(f"Connection {connection_id} closed during send")
                else:
                    logger.error(f"RuntimeError sending to {connection_id}: {type(e).__name__}: {e}")
                disconnected.append(connection_id)
            except Exception as e:
                logger.error(f"Unexpected error sending to {connection_id}: {type(e).__name__}: {e}")
                disconnected.append(connection_id)

        # Clean up disconnected clients
        for connection_id in disconnected:
            self.disconnect(connection_id)

    async def broadcast_telemetry(self, telemetry_data: Dict[str, Any]):
        """Broadcast telemetry data to telemetry channel"""
        await self.broadcast_to_channel("telemetry", telemetry_data)

    async def broadcast_satellites(self, satellite_data: Dict[str, Any]):
        """Broadcast satellite data to satellites channel"""
        await self.broadcast_to_channel("satellites", satellite_data)

    async def broadcast_log(self, log_data: Dict[str, Any]):
        """Broadcast log entry to logs channel"""
        await self.broadcast_to_channel("logs", log_data)

    async def broadcast_event(self, event_data: Dict[str, Any]):
        """Broadcast event to events channel"""
        await self.broadcast_to_channel("events", event_data)

    async def broadcast_sim_state(self, sim_data: Dict[str, Any]):
        """Broadcast simulation state to sim channel"""
        await self.broadcast_to_channel("sim", sim_data)

    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection statistics"""
        channel_stats = {}
        for channel, connections in self.channels.items():
            channel_stats[channel] = len(connections)

        return {
            "total_connections": len(self.connections),
            "channels": channel_stats,
            "connections": [
                {
                    "id": conn_id,
                    "channel": channel
                }
                for conn_id, (_, channel) in self.connections.items()
            ]
        }