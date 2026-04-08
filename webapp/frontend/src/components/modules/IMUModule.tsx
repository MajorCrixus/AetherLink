import React, { useMemo, useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Compass, Activity, Thermometer, Gauge, RotateCcw, Play, Pause, Maximize2 } from 'lucide-react'
import { useIMUData } from '@/stores/telemetryStore'
import { IMU3DVisualizer } from './IMU3DVisualizer'

function StatusIndicator({
  label,
  value,
  unit,
  status = 'normal',
}: {
  label: string
  value: number | string
  unit?: string
  status?: 'normal' | 'warning' | 'error'
}) {
  const statusColors: Record<string, string> = {
    normal: 'text-green-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  }
  const safeValue =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? value.toFixed(2)
        : '—'
      : value ?? '—'
  return (
    <div className="bg-secondary/30 rounded p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${statusColors[status]}`.trim()}>
        {safeValue}
        {unit && <span className="text-sm ml-1">{unit}</span>}
      </div>
    </div>
  )
}

function parseTs(s?: string): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

export function IMUModule() {
  const liveIMU = useIMUData()
  const [isPaused, setIsPaused] = useState(false)
  const lastSnapshotRef = useRef<typeof liveIMU | null>(null)

  // Freeze values when paused
  const imu = useMemo(() => {
    if (isPaused) {
      if (!lastSnapshotRef.current) lastSnapshotRef.current = liveIMU
      return lastSnapshotRef.current
    }
    lastSnapshotRef.current = liveIMU
    return liveIMU
  }, [isPaused, liveIMU])

  // Compute update rate (EMA) from imu.ts deltas
  const hzRef = useRef<number>(0)
  const lastTsRef = useRef<number | null>(null)
  useEffect(() => {
    if (!imu?.ts || isPaused) return
    const ts = parseTs(imu.ts)
    if (ts && lastTsRef.current && ts > lastTsRef.current) {
      const dt = (ts - lastTsRef.current) / 1000
      const instHz = dt > 0 ? 1 / dt : 0
      // EMA smoothing
      const alpha = 0.2
      hzRef.current = alpha * instHz + (1 - alpha) * hzRef.current
    }
    lastTsRef.current = ts
  }, [imu?.ts, isPaused])

  const updateHz = Math.max(0, Math.min(200, hzRef.current))
  const tsMs = parseTs(imu?.ts)
  const isStale = tsMs ? Date.now() - tsMs > 1500 : true

  // Optional: wire reset button to backend if/when you add an endpoint
  async function handleResetOrientation() {
    try {
      // await fetch(`${import.meta.env.VITE_API_BASE}/api/imu/reset-orientation`, { method: 'POST' })
      // toast.success('IMU orientation reset command sent')
      console.log('Reset orientation clicked (endpoint not implemented)')
    } catch (e) {
      console.error(e)
    }
  }

  const roll = imu?.roll_deg ?? 0
  const pitch = imu?.pitch_deg ?? 0
  const yaw = imu?.yaw_deg ?? 0

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-background via-background to-background/90">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">IMU Module</h1>
                <p className="text-sm text-muted-foreground">WitMotion WT901C-TTL - Real-Time Data</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-secondary/50 rounded-lg px-4 py-2 flex items-center gap-2">
                <Activity className={`w-5 h-5 ${!isStale ? 'text-green-400' : 'text-red-400'}`} />
                <div className="text-left">
                  <div className="text-sm font-medium">
                    {!isStale ? 'Active' : 'No Data'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {updateHz ? `${updateHz.toFixed(1)} Hz` : '—'}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary flex items-center gap-2"
                onClick={() => setIsPaused(p => !p)}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* 3D Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className="panel overflow-hidden">
            <div className="panel-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5" />
                  <span className="text-lg">Real-Time Orientation</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  IMU mounted on antenna dish back
                </div>
              </div>
            </div>
            <div className="panel-content p-0">
              <div className="h-[500px] w-full">
                <IMU3DVisualizer roll={roll} pitch={pitch} yaw={yaw} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orientation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5" />
                  <span className="text-lg">Orientation</span>
                </div>
              </div>
              <div className="panel-content space-y-3">
                <StatusIndicator label="Roll"  value={roll}  unit="°" status={Math.abs(roll)  > 30 ? 'warning' : 'normal'} />
                <StatusIndicator label="Pitch" value={pitch} unit="°" status={Math.abs(pitch) > 30 ? 'warning' : 'normal'} />
                <StatusIndicator label="Yaw"   value={yaw}   unit="°" />
              </div>
            </div>
          </motion.div>

          {/* Angular Velocity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  <span className="text-lg">Angular Velocity</span>
                </div>
              </div>
              <div className="panel-content space-y-3">
                <StatusIndicator label="Roll Rate"  value={imu?.gyro_x ?? 0} unit="°/s" />
                <StatusIndicator label="Pitch Rate" value={imu?.gyro_y ?? 0} unit="°/s" />
                <StatusIndicator label="Yaw Rate"   value={imu?.gyro_z ?? 0} unit="°/s" />
              </div>
            </div>
          </motion.div>

          {/* Acceleration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-lg">Acceleration</span>
                </div>
              </div>
              <div className="panel-content space-y-3">
                <StatusIndicator label="X Accel" value={imu?.accel_x ?? 0} unit="g" />
                <StatusIndicator label="Y Accel" value={imu?.accel_y ?? 0} unit="g" />
                <StatusIndicator label="Z Accel" value={imu?.accel_z ?? 0} unit="g" />
              </div>
            </div>
          </motion.div>

          {/* Sensor Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-5 h-5" />
                  <span className="text-lg">Sensor Status</span>
                </div>
              </div>
              <div className="panel-content space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Temperature:</span>
                  <span className={`text-lg font-medium font-mono ${((imu?.temp_c ?? 0) > 60) ? 'text-amber-400' : 'text-green-400'}`}>
                    {Number.isFinite(imu?.temp_c) ? (imu!.temp_c as number).toFixed(1) : '—'}°C
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Update:</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {imu?.ts ? new Date(imu.ts).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Calibration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="panel">
              <div className="panel-header">
                <span className="text-lg">Calibration</span>
              </div>
              <div className="panel-content space-y-3">
                <div className="text-sm text-muted-foreground">
                  The IMU is factory calibrated. If recalibration is needed, use the WitMotion configuration software.
                </div>
                <button className="btn btn-secondary w-full" onClick={handleResetOrientation}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Orientation
                </button>
              </div>
            </div>
          </motion.div>

          {/* Specifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="panel">
              <div className="panel-header"><span className="text-lg">Specifications</span></div>
              <div className="panel-content text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Model:</span><span>WT901C-TTL</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Axes:</span><span>9-axis (3 gyro, 3 accel, 3 mag)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Accuracy:</span><span>±0.05° (roll/pitch)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Range:</span><span>±180° (roll/pitch), 0–360° (yaw)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Interface:</span><span>TTL UART</span></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
