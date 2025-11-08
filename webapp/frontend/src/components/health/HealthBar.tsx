/**
 * INAV-style health/connectivity status bar
 * Displays system health icons with color-coded states
 */

import React from 'react'
import { motion } from 'framer-motion'
import {
  Wifi,
  Satellite,
  Compass,
  Zap,
  Shield,
  Clock,
  Activity,
  Cpu,
  Play
} from 'lucide-react'

import { useHealthStatus, useConnectionState } from '@/stores/telemetryStore'
import { cn } from '@/lib/utils'
import type { HealthStatusType, HealthState } from '@/types/telemetry'

interface HealthIndicatorProps {
  icon: React.ReactNode
  state: HealthState
  label: string
  tooltip?: string
}

function HealthIndicator({ icon, state, label, tooltip }: HealthIndicatorProps) {
  const statusClasses = {
    OK: 'text-health-ok border-health-ok/30 bg-health-ok/10',
    WARN: 'text-health-warn border-health-warn/30 bg-health-warn/10 animate-pulse-glow',
    ERROR: 'text-health-error border-health-error/30 bg-health-error/10 animate-pulse-glow',
    OFF: 'text-health-off border-health-off/30 bg-health-off/10',
    INIT: 'text-health-init border-health-init/30 bg-health-init/10 animate-pulse',
    SIM: 'text-health-sim border-health-sim/30 bg-health-sim/10'
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-all',
        statusClasses[state.status]
      )}
      title={tooltip || `${label}: ${state.message || state.status}`}
    >
      <div className="w-3 h-3 flex items-center justify-center">
        {icon}
      </div>
      <span className="hidden sm:inline truncate max-w-20">
        {label}
      </span>
    </motion.div>
  )
}

export function HealthBar() {
  const health = useHealthStatus()
  const connection = useConnectionState()

  // Show dynamic connection status when health data isn't available yet
  if (!health) {
    const statusMessage = connection.connected
      ? 'Waiting for telemetry data...'
      : connection.error
        ? `Connection error: ${connection.error}`
        : 'Connecting to backend...'

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-secondary">
        <Activity className={cn(
          "w-4 h-4",
          connection.connected ? "text-health-init animate-pulse" : "text-health-error"
        )} />
        <div className={cn(
          "text-sm",
          connection.connected ? "text-muted-foreground" : "text-health-error"
        )}>
          {statusMessage}
        </div>
      </div>
    )
  }

  const indicators = [
    {
      key: 'link',
      icon: <Wifi className="w-3 h-3" />,
      state: health.link,
      label: 'LINK',
      tooltip: `WebSocket connection: ${connection.connected ? 'Connected' : 'Disconnected'}`
    },
    {
      key: 'gps',
      icon: <Satellite className="w-3 h-3" />,
      state: health.gps,
      label: 'GPS',
      tooltip: `GPS status: ${health.gps.message || health.gps.status}`
    },
    {
      key: 'imu',
      icon: <Compass className="w-3 h-3" />,
      state: health.imu,
      label: 'IMU',
      tooltip: `IMU status: ${health.imu.message || health.imu.status}`
    },
    {
      key: 'servos',
      icon: <Zap className="w-3 h-3" />,
      state: health.servos,
      label: 'SERVO',
      tooltip: `Servo status: ${health.servos.message || health.servos.status}`
    },
    {
      key: 'limits',
      icon: <Shield className="w-3 h-3" />,
      state: health.limits,
      label: 'LIMIT',
      tooltip: `Limit switches: ${health.limits.message || health.limits.status}`
    },
    {
      key: 'time',
      icon: <Clock className="w-3 h-3" />,
      state: health.time,
      label: 'TIME',
      tooltip: `Time sync: ${health.time.message || health.time.status}`
    },
    {
      key: 'system',
      icon: <Cpu className="w-3 h-3" />,
      state: health.system,
      label: 'SYS',
      tooltip: `System: ${health.system.message || health.system.status}`
    }
  ]

  // Add simulation indicator if active
  if (health.sim.status === 'SIM') {
    indicators.push({
      key: 'sim',
      icon: <Play className="w-3 h-3" />,
      state: health.sim,
      label: 'SIM',
      tooltip: `Demo mode: ${health.sim.message || 'Active'}`
    })
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-secondary backdrop-blur-sm"
    >
      {/* Health indicators */}
      <div className="flex items-center gap-2 flex-wrap">
        {indicators.map((indicator) => (
          <HealthIndicator
            key={indicator.key}
            icon={indicator.icon}
            state={indicator.state}
            label={indicator.label}
            tooltip={indicator.tooltip}
          />
        ))}
      </div>

      {/* Last update timestamp */}
      <div className="text-xs text-muted-foreground hidden md:block">
        {connection.lastUpdate && (
          <span>
            Last update: {new Date(connection.lastUpdate).toLocaleTimeString()}
          </span>
        )}
        {connection.error && (
          <span className="text-health-error ml-2">
            {connection.error}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// Export individual health state component for use in other parts of the app
export function HealthStatusIcon({
  status,
  className
}: {
  status: HealthStatusType
  className?: string
}) {
  const statusConfig = {
    OK: { color: 'text-health-ok', icon: Activity },
    WARN: { color: 'text-health-warn animate-pulse-glow', icon: Activity },
    ERROR: { color: 'text-health-error animate-pulse-glow', icon: Activity },
    OFF: { color: 'text-health-off', icon: Activity },
    INIT: { color: 'text-health-init animate-pulse', icon: Activity },
    SIM: { color: 'text-health-sim', icon: Play }
  }

  const config = statusConfig[status]
  const IconComponent = config.icon

  return (
    <IconComponent
      className={cn(config.color, 'w-4 h-4', className)}
    />
  )
}