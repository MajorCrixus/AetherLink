import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Radio,
  Activity,
  Settings,
  TrendingUp,
  Zap,
  Target,
  PlayCircle,
  StopCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  BarChart3
} from 'lucide-react'
import { useSDRWebSocket } from '../../hooks/useSDRWebSocket'

const API_BASE = 'http://192.168.68.135:9000/api/sdr'

interface BeaconConfig {
  id: string
  satelliteName: string
  noradId: number
  frequency: number // MHz
  bandwidth: number // kHz
  mode: string // FM, AM, SSB, etc.
  notes?: string
}

interface DeviceInfo {
  connected: boolean
  serial?: string
  firmware?: string
  board_id?: string
}

interface SignalData {
  timestamp: number
  power: number // dBm
  frequency: number // MHz
}

export function SDRModule() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({ connected: false })
  const [monitoring, setMonitoring] = useState(false)
  const [selectedBeacon, setSelectedBeacon] = useState<BeaconConfig | null>(null)
  const [signalStrength, setSignalStrength] = useState<number>(-100)
  const [peakSignal, setPeakSignal] = useState<number>(-100)
  const [signalHistory, setSignalHistory] = useState<SignalData[]>([])

  // WebSocket connection for real-time signal data
  const { signalData, isConnected: wsConnected } = useSDRWebSocket()

  // Beacon presets
  const [beacons, setBeacons] = useState<BeaconConfig[]>([
    {
      id: '1',
      satelliteName: 'NOAA 15',
      noradId: 25338,
      frequency: 137.62,
      bandwidth: 40,
      mode: 'APT',
      notes: 'Weather satellite - APT downlink'
    },
    {
      id: '2',
      satelliteName: 'NOAA 18',
      noradId: 28654,
      frequency: 137.9125,
      bandwidth: 40,
      mode: 'APT',
      notes: 'Weather satellite - APT downlink'
    },
    {
      id: '3',
      satelliteName: 'NOAA 19',
      noradId: 33591,
      frequency: 137.10,
      bandwidth: 40,
      mode: 'APT',
      notes: 'Weather satellite - APT downlink'
    },
    {
      id: '4',
      satelliteName: 'ISS',
      noradId: 25544,
      frequency: 145.800,
      bandwidth: 25,
      mode: 'FM',
      notes: 'Voice repeater downlink'
    },
    {
      id: '5',
      satelliteName: 'Starlink Example',
      noradId: 44713,
      frequency: 10700.0,
      bandwidth: 250000,
      mode: 'DVB-S2',
      notes: 'Ku-band downlink (example)'
    }
  ])

  // Device settings
  const [lnaGain, setLnaGain] = useState(16)
  const [vgaGain, setVgaGain] = useState(20)
  const [ampEnabled, setAmpEnabled] = useState(false)

  // Check device status
  const checkDevice = async () => {
    try {
      const response = await fetch(`${API_BASE}/device`)
      const data = await response.json()
      setDeviceInfo(data)
    } catch (error) {
      console.error('Failed to check device:', error)
      setDeviceInfo({
        connected: false,
        serial: 'Error',
        firmware: 'Error',
        board_id: 'Error'
      })
    }
  }

  // Start monitoring
  const startMonitoring = async () => {
    if (!selectedBeacon) return

    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frequency: selectedBeacon.frequency,
          gain_lna: lnaGain,
          gain_vga: vgaGain,
          amp_enabled: ampEnabled,
          bandwidth: selectedBeacon.bandwidth / 1000 // Convert kHz to MHz
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to start monitoring')
      }

      setMonitoring(true)
      // Reset peak signal when starting new monitoring session
      setPeakSignal(-100)
      setSignalHistory([])
    } catch (error) {
      console.error('Failed to start monitoring:', error)
      alert(`Failed to start monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Stop monitoring
  const stopMonitoring = async () => {
    try {
      const response = await fetch(`${API_BASE}/stop`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to stop monitoring')
      }

      setMonitoring(false)
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
      // Stop on frontend anyway
      setMonitoring(false)
    }
  }

  // Initial device check
  useEffect(() => {
    checkDevice()
  }, [])

  // Handle incoming WebSocket signal data
  useEffect(() => {
    if (signalData && signalData.status === 'success' && signalData.power_dbm !== undefined) {
      const power = signalData.power_dbm

      setSignalStrength(power)
      setPeakSignal(prev => Math.max(prev, power))

      setSignalHistory(prev => {
        const newHistory = [...prev, {
          timestamp: Date.now(),
          power: power,
          frequency: signalData.frequency_mhz || 0
        }]
        return newHistory.slice(-60) // Keep last 60 samples
      })
    }
  }, [signalData])

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">SDR Module</h1>
                <p className="text-muted-foreground">HackRF One - Spectrum Analyzer & Beacon Monitor</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Device & Monitoring */}
          <div className="xl:col-span-2 space-y-6">
            {/* Device Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="panel"
            >
              <div className="panel-header">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    <span className="font-semibold">HackRF One Status</span>
                  </div>
                  <button
                    onClick={checkDevice}
                    className="p-1 hover:bg-primary/10 rounded transition-colors"
                    title="Refresh device status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="panel-content">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      {deviceInfo.connected ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-medium text-green-500">Connected</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm font-medium text-red-500">Disconnected</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Serial</div>
                    <div className="text-sm font-mono">{deviceInfo.serial || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Firmware</div>
                    <div className="text-sm font-mono">{deviceInfo.firmware || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Board ID</div>
                    <div className="text-sm font-mono">{deviceInfo.board_id || '-'}</div>
                  </div>
                </div>

                {!deviceInfo.connected && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium text-yellow-500 mb-1">HackRF Not Detected</div>
                        <div className="text-muted-foreground text-xs">
                          Ensure HackRF is connected and hackrf_info works. Install hackrf tools:
                          <code className="bg-background/50 px-1 py-0.5 rounded ml-1">sudo apt install hackrf</code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Signal Monitoring */}
            {selectedBeacon && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="panel"
              >
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span className="font-semibold">Signal Monitor - {selectedBeacon.satelliteName}</span>
                  </div>
                </div>
                <div className="panel-content">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Current Signal */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Current Signal</div>
                      <div className="text-4xl font-bold font-mono">
                        {signalStrength.toFixed(1)} <span className="text-lg text-muted-foreground">dBm</span>
                      </div>
                      <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, ((signalStrength + 100) / 40) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Peak Signal */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Peak Signal</div>
                      <div className="text-4xl font-bold font-mono text-green-500">
                        {peakSignal.toFixed(1)} <span className="text-lg text-muted-foreground">dBm</span>
                      </div>
                      <button
                        onClick={() => setPeakSignal(-100)}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Reset Peak
                      </button>
                    </div>
                  </div>

                  {/* Beacon Info */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-secondary/20 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Frequency</div>
                      <div className="text-sm font-mono">{selectedBeacon.frequency} MHz</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Bandwidth</div>
                      <div className="text-sm font-mono">{selectedBeacon.bandwidth} kHz</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Mode</div>
                      <div className="text-sm font-mono">{selectedBeacon.mode}</div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex gap-3">
                    {!monitoring ? (
                      <button
                        onClick={startMonitoring}
                        disabled={!deviceInfo.connected}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Monitoring
                      </button>
                    ) : (
                      <button
                        onClick={stopMonitoring}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <StopCircle className="w-4 h-4" />
                        Stop Monitoring
                      </button>
                    )}

                    <button
                      disabled={!monitoring}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title="Auto-tune antenna to maximize signal"
                    >
                      <Target className="w-4 h-4" />
                      Auto-Tune
                    </button>
                  </div>

                  {/* Signal History Chart Placeholder */}
                  {monitoring && (
                    <div className="mt-6">
                      <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Signal History (Last 30s)
                      </div>
                      <div className="h-32 bg-secondary/20 rounded-lg flex items-end justify-between px-1 pb-1 gap-0.5">
                        {signalHistory.slice(-60).map((data, i) => {
                          const height = Math.min(100, Math.max(0, ((data.power + 100) / 40) * 100))
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-gradient-to-t from-primary/60 to-primary rounded-t"
                              style={{ height: `${height}%` }}
                              title={`${data.power.toFixed(1)} dBm`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Device Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="panel"
            >
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="font-semibold">Device Settings</span>
                </div>
              </div>
              <div className="panel-content">
                <div className="space-y-4">
                  {/* LNA Gain */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">LNA Gain</label>
                      <span className="text-sm font-mono text-muted-foreground">{lnaGain} dB</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="8"
                      value={lnaGain}
                      onChange={(e) => setLnaGain(Number(e.target.value))}
                      className="w-full"
                      disabled={monitoring}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0</span>
                      <span>8</span>
                      <span>16</span>
                      <span>24</span>
                      <span>32</span>
                      <span>40</span>
                    </div>
                  </div>

                  {/* VGA Gain */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">VGA Gain</label>
                      <span className="text-sm font-mono text-muted-foreground">{vgaGain} dB</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="62"
                      step="2"
                      value={vgaGain}
                      onChange={(e) => setVgaGain(Number(e.target.value))}
                      className="w-full"
                      disabled={monitoring}
                    />
                  </div>

                  {/* RF Amp */}
                  <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">RF Amplifier</div>
                      <div className="text-xs text-muted-foreground">+14 dB gain (be careful!)</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ampEnabled}
                        onChange={(e) => setAmpEnabled(e.target.checked)}
                        disabled={monitoring}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Beacon List */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="panel"
            >
              <div className="panel-header">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-semibold">Beacon Presets</span>
                  </div>
                  <button className="p-1 hover:bg-primary/10 rounded transition-colors" title="Add new beacon">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="panel-content p-0">
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {beacons.map((beacon) => (
                    <div
                      key={beacon.id}
                      className={`p-4 hover:bg-secondary/20 cursor-pointer transition-colors ${
                        selectedBeacon?.id === beacon.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                      onClick={() => setSelectedBeacon(beacon)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium">{beacon.satelliteName}</div>
                          <div className="text-xs text-muted-foreground">NORAD {beacon.noradId}</div>
                        </div>
                        {selectedBeacon?.id === beacon.id && (
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm font-mono mb-1">{beacon.frequency} MHz</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-secondary rounded">{beacon.mode}</span>
                        <span className="text-xs text-muted-foreground">{beacon.bandwidth} kHz</span>
                      </div>
                      {beacon.notes && (
                        <div className="text-xs text-muted-foreground mt-2">{beacon.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Quick Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="panel"
            >
              <div className="panel-header">
                <span className="font-semibold">Antenna Alignment Guide</span>
              </div>
              <div className="panel-content text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">1. Select Beacon</div>
                    <div className="text-xs text-muted-foreground">Choose the satellite beacon frequency from the list</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <PlayCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">2. Start Monitoring</div>
                    <div className="text-xs text-muted-foreground">Begin real-time signal strength monitoring</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">3. Adjust Antenna</div>
                    <div className="text-xs text-muted-foreground">Fine-tune Az/El/CL to maximize signal strength</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">4. Lock Signal</div>
                    <div className="text-xs text-muted-foreground">Use Auto-Tune for automated peak finding</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}