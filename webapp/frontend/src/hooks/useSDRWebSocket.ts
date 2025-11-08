import { useEffect, useRef, useState } from 'react'

interface SignalData {
  status: string
  timestamp?: string
  frequency_mhz?: number
  power_dbm: number
  message?: string
}

interface UseSDRWebSocketReturn {
  signalData: SignalData | null
  isConnected: boolean
  error: string | null
}

const WS_URL = 'ws://192.168.68.135:9000/api/sdr/ws'

export function useSDRWebSocket(): UseSDRWebSocketReturn {
  const [signalData, setSignalData] = useState<SignalData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    let mounted = true

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted) return
          console.log('SDR WebSocket connected')
          setIsConnected(true)
          setError(null)
        }

        ws.onmessage = (event) => {
          if (!mounted) return
          try {
            const data = JSON.parse(event.data)

            // Only update signal data if it's a signal measurement
            if (data.status && data.power_dbm !== undefined) {
              setSignalData(data)
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err)
          }
        }

        ws.onerror = (event) => {
          if (!mounted) return
          console.error('SDR WebSocket error:', event)
          setError('WebSocket connection error')
        }

        ws.onclose = () => {
          if (!mounted) return
          console.log('SDR WebSocket disconnected')
          setIsConnected(false)

          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mounted) {
              console.log('Attempting to reconnect SDR WebSocket...')
              connect()
            }
          }, 3000)
        }
      } catch (err) {
        console.error('Error creating WebSocket:', err)
        setError('Failed to connect to WebSocket')
      }
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return { signalData, isConnected, error }
}
