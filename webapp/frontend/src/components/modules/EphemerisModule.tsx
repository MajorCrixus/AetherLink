import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Radio, RefreshCw, CheckCircle, XCircle, Loader2, Database, Terminal } from 'lucide-react'

interface IngestStatus {
  status: 'idle' | 'in_progress' | 'completed' | 'failed'
  message?: string
  timestamp?: string
  duration_seconds?: number
  spacetrack?: {
    satellites_inserted: number
    satellites_updated: number
    tles_inserted: number
  }
  satnogs?: {
    transmitters_inserted: number
    transmitters_updated: number
    transmitters_skipped: number
  }
  errors?: string[]
  error?: string
  logs?: LogEntry[]
}

interface LogEntry {
  timestamp: string
  type: 'request' | 'response' | 'error' | 'info'
  message: string
}

const SATCAT_API = 'http://192.168.68.135:9001/api'

export function EphemerisModule() {
  const [status, setStatus] = useState<IngestStatus>({ status: 'idle' })
  const [isPolling, setIsPolling] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Add log entry
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type,
      message
    }])
  }

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Poll for status when ingest is running
  useEffect(() => {
    if (!isPolling) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${SATCAT_API}/ingest/status`)
        const data: IngestStatus = await response.json()
        setStatus(data)

        // Update logs from server
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs)
        }

        // Stop polling when complete or failed
        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false)
        }
      } catch (error) {
        console.error('Error fetching ingest status:', error)
      }
    }, 1000) // Poll every second for real-time updates

    return () => clearInterval(interval)
  }, [isPolling])

  // Load initial status on mount and start polling if ingest is in progress
  useEffect(() => {
    const loadInitialStatus = async () => {
      try {
        const response = await fetch(`${SATCAT_API}/ingest/status`)
        const data: IngestStatus = await response.json()
        setStatus(data)

        // If there are server-side logs, display them
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs)
        }

        // Auto-start polling if ingest is already in progress
        if (data.status === 'in_progress') {
          setIsPolling(true)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        addLog('error', `Failed to fetch status: ${errorMsg}`)
        console.error('Error fetching status:', error)
      }
    }

    loadInitialStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${SATCAT_API}/ingest/status`)
      const data: IngestStatus = await response.json()
      setStatus(data)

      // If there are server-side logs, display them
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog('error', `Failed to fetch status: ${errorMsg}`)
      console.error('Error fetching status:', error)
    }
  }

  const startIngest = async () => {
    try {
      const response = await fetch(`${SATCAT_API}/ingest/start`, {
        method: 'POST',
      })

      if (response.status === 409) {
        // Already in progress
        const data = await response.json()
        alert(data.message)
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        addLog('error', `Failed to start ingest: ${response.status} - ${errorText}`)
        throw new Error('Failed to start ingest')
      }

      const data = await response.json()
      setStatus({ status: 'in_progress', message: 'Starting database ingest...' })
      setLogs([]) // Clear previous logs
      setIsPolling(true)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog('error', `Error starting ingest: ${errorMsg}`)
      console.error('Error starting ingest:', error)
      alert('Failed to start ingest')
    }
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'in_progress':
        return <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />
      default:
        return <Database className="w-6 h-6 text-muted-foreground" />
    }
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'in_progress':
        return 'border-blue-500/50 bg-blue-500/5'
      case 'completed':
        return 'border-green-500/50 bg-green-500/5'
      case 'failed':
        return 'border-red-500/50 bg-red-500/5'
      default:
        return 'border-border bg-background'
    }
  }

  return (
    <div className="h-full p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Ephemeris/TLE</h1>
              <p className="text-muted-foreground">Satellite Tracking Data</p>
            </div>
          </div>
        </motion.div>

        {/* Database Update Section */}
        <div className="panel mb-6">
          <div className="panel-content">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">Satellite Database</h3>
                <p className="text-sm text-muted-foreground">
                  Update catalog data from Space-Track.org and SatNOGS
                </p>
              </div>
              <button
                onClick={startIngest}
                disabled={status.status === 'in_progress'}
                className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${status.status === 'in_progress' ? 'animate-spin' : ''}`} />
                {status.status === 'in_progress' ? 'Updating...' : 'Update Database'}
              </button>
            </div>

            {/* Status Display */}
            <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
              <div className="flex items-start gap-3">
                {getStatusIcon()}
                <div className="flex-1">
                  <div className="font-medium mb-1">
                    {status.status === 'idle' && 'Ready to Update'}
                    {status.status === 'in_progress' && 'Update in Progress'}
                    {status.status === 'completed' && 'Update Completed'}
                    {status.status === 'failed' && 'Update Failed'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {status.message || 'Click "Update Database" to fetch latest satellite data'}
                  </div>

                  {/* Completed Stats */}
                  {status.status === 'completed' && status.spacetrack && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">SPACE-TRACK.ORG</div>
                        <div className="space-y-1 text-sm">
                          <div>Satellites Inserted: <span className="font-mono text-green-400">{status.spacetrack.satellites_inserted}</span></div>
                          <div>Satellites Updated: <span className="font-mono text-blue-400">{status.spacetrack.satellites_updated}</span></div>
                          <div>TLEs Inserted: <span className="font-mono text-green-400">{status.spacetrack.tles_inserted}</span></div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">SATNOGS DB</div>
                        <div className="space-y-1 text-sm">
                          <div>Transmitters Inserted: <span className="font-mono text-green-400">{status.satnogs?.transmitters_inserted || 0}</span></div>
                          <div>Transmitters Updated: <span className="font-mono text-blue-400">{status.satnogs?.transmitters_updated || 0}</span></div>
                          <div>Transmitters Skipped: <span className="font-mono text-gray-400">{status.satnogs?.transmitters_skipped || 0}</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Duration */}
                  {status.duration_seconds && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Completed in {status.duration_seconds}s
                    </div>
                  )}

                  {/* Timestamp */}
                  {status.timestamp && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(status.timestamp).toLocaleString()}
                    </div>
                  )}

                  {/* Errors */}
                  {status.errors && status.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm">
                      <div className="font-semibold text-red-400 mb-1">Errors:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {status.errors.map((error, i) => (
                          <li key={i} className="text-red-300">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Failed Error */}
                  {status.status === 'failed' && status.error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300">
                      {status.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Information Panel */}
        <div className="panel mb-6">
          <div className="panel-content">
            <h3 className="text-lg font-semibold mb-3">About</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                The satellite database contains orbital elements (TLEs) and metadata from authoritative sources:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-semibold">Space-Track.org</span> - Satellite catalog and two-line elements (TLEs)</li>
                <li><span className="font-semibold">SatNOGS DB</span> - Transmitter frequencies and operational status</li>
              </ul>
              <p className="mt-3">
                TLE data becomes stale as satellites orbit. It's recommended to update the database once per day
                to maintain accurate tracking.
              </p>
              <p className="text-xs mt-3 text-muted-foreground/70">
                Note: Updates use delta/incremental mode by default, only fetching new or changed data since the last update.
                This respects Space-Track.org API rate limits.
              </p>
            </div>
          </div>
        </div>

        {/* Debug Console */}
        <div className="panel">
          <div className="panel-content">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Debug Console</h3>
                {isPolling && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span>LIVE</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setLogs([])}
                className="btn btn-secondary text-sm"
              >
                Clear Logs
              </button>
            </div>
            <div className="bg-black rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center mt-8">
                  No logs yet. Click "Update Database" to see API requests and responses.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`mb-1 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'request' ? 'text-blue-400' :
                      log.type === 'response' ? 'text-green-400' :
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    {log.message}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
