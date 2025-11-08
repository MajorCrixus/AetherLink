/**
 * WebSocket hook for real-time data streaming
 */

import { useEffect, useRef } from 'react'
import { useTelemetryStore } from '@/stores/telemetryStore'
import type { WebSocketMessage } from '@/types/telemetry'

// Use window.location.host to support both localhost and network access
const getWebSocketURL = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  const port = '9000' // Backend port
  return `${protocol}//${host}:${port}/ws`
}

const WEBSOCKET_URL = getWebSocketURL()
const RECONNECT_INTERVAL = 3000 // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 10

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const {
    setConnected,
    setConnectionError,
    handleWebSocketMessage
  } = useTelemetryStore()

  const connect = () => {
    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close()
      }

      // Create new WebSocket connection
      const ws = new WebSocket(`${WEBSOCKET_URL}/telemetry`)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        setConnectionError(null)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setConnected(false)

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          setConnectionError(`Connection lost. Reconnecting... (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, RECONNECT_INTERVAL)
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('Failed to reconnect after multiple attempts. Please refresh the page.')
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionError('WebSocket connection error')
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionError('Failed to connect to server')
    }
  }

  const disconnect = () => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }

    setConnected(false)
  }

  useEffect(() => {
    // Connect on mount
    connect()

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [])

  // Return connection control functions for manual use
  return {
    connect,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  }
}

// Additional WebSocket hooks for specific channels
export function useLogsWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const { addLog, setConnectionError } = useTelemetryStore()

  useEffect(() => {
    const ws = new WebSocket(`${WEBSOCKET_URL}/logs`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        if (message.channel === 'logs') {
          addLog(message.data)
        }
      } catch (error) {
        console.error('Failed to parse logs WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('Logs WebSocket error:', error)
      setConnectionError('Logs connection error')
    }

    return () => {
      ws.close()
    }
  }, [addLog, setConnectionError])

  return wsRef.current
}