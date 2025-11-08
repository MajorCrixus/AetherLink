/**
 * Antenna status display panel
 */

import React from 'react'
import { Activity, Thermometer, Zap, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTelemetryData } from '@/stores/telemetryStore'

interface StatusRowProps {
  label: string
  value: string | number
  status?: 'ok' | 'warning' | 'error' | 'info'
  unit?: string
}

function StatusRow({ label, value, status = 'info', unit }: StatusRowProps) {
  const statusColors = {
    ok: 'text-green-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    info: 'text-foreground'
  }

  const statusIcons = {
    ok: <CheckCircle2 className="w-3 h-3" />,
    warning: <AlertCircle className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
    info: null
  }

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <div className={`flex items-center gap-1 font-medium ${statusColors[status]}`}>
        {statusIcons[status]}
        <span>
          {value}
          {unit && <span className="text-xs ml-0.5">{unit}</span>}
        </span>
      </div>
    </div>
  )
}

interface AxisStatusProps {
  axis: 'AZ' | 'EL' | 'CL'
  label: string
  data: any
}

function AxisStatus({ axis, label, data }: AxisStatusProps) {
  if (!data) {
    return (
      <div className="bg-secondary/30 rounded p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    )
  }

  const errorDeg = Math.abs((data.actual_deg || 0) - (data.target_deg || 0))
  const isAtTarget = errorDeg < 0.5
  const tempStatus = data.temp_c > 60 ? 'error' : data.temp_c > 50 ? 'warning' : 'ok'
  const currentStatus = data.current_ma > 2000 ? 'warning' : 'ok'

  return (
    <div className="bg-secondary/30 rounded p-3 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`text-xs px-2 py-0.5 rounded ${
          isAtTarget ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
        }`}>
          {isAtTarget ? 'On Target' : `±${errorDeg.toFixed(1)}°`}
        </div>
      </div>

      <StatusRow
        label="Position"
        value={data.actual_deg?.toFixed(1) || '0.0'}
        unit="°"
        status={isAtTarget ? 'ok' : 'warning'}
      />

      <StatusRow
        label="Target"
        value={data.target_deg?.toFixed(1) || '0.0'}
        unit="°"
      />

      <StatusRow
        label="Mode"
        value={data.mode || 'UNKNOWN'}
        status="info"
      />

      <StatusRow
        label="Current"
        value={data.current_ma || 0}
        unit="mA"
        status={currentStatus}
      />

      <StatusRow
        label="Temp"
        value={data.temp_c?.toFixed(1) || '0.0'}
        unit="°C"
        status={tempStatus}
      />
    </div>
  )
}

export function AntennaStatus() {
  const telemetry = useTelemetryData()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">System Status</h2>

      {/* Overall Status */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>Overall Status</span>
          </div>
        </div>
        <div className="panel-content space-y-2">
          <StatusRow
            label="Mode"
            value={telemetry?.system?.mode || 'IDLE'}
            status={telemetry?.system?.mode === 'TRACK' ? 'ok' : 'info'}
          />
          <StatusRow
            label="Motion"
            value={telemetry?.system?.motion_active ? 'Active' : 'Idle'}
            status={telemetry?.system?.motion_active ? 'ok' : 'info'}
          />
          <StatusRow
            label="Tracking"
            value={telemetry?.system?.tracking_target || 'Manual'}
          />
          <StatusRow
            label="Limits"
            value={telemetry?.system?.limits_ok ? 'Clear' : 'FAULT'}
            status={telemetry?.system?.limits_ok ? 'ok' : 'error'}
          />
          <StatusRow
            label="E-Stop"
            value={telemetry?.system?.estop_active ? 'ACTIVE' : 'Clear'}
            status={telemetry?.system?.estop_active ? 'error' : 'ok'}
          />
        </div>
      </div>

      {/* Axis Status */}
      <div className="panel">
        <div className="panel-header">
          <span>Axis Status</span>
        </div>
        <div className="panel-content space-y-3">
          <AxisStatus axis="AZ" label="Azimuth" data={telemetry?.axes?.AZ} />
          <AxisStatus axis="EL" label="Elevation" data={telemetry?.axes?.EL} />
          <AxisStatus axis="CL" label="Cross-level" data={telemetry?.axes?.CL} />
        </div>
      </div>

      {/* Power & Environmental */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Power & Environment</span>
          </div>
        </div>
        <div className="panel-content space-y-2">
          <StatusRow
            label="Input Voltage"
            value={telemetry?.power?.voltage_v?.toFixed(1) || '0.0'}
            unit="V"
            status={(telemetry?.power?.voltage_v ?? 0) > 23 && (telemetry?.power?.voltage_v ?? 0) < 26 ? 'ok' : 'warning'}
          />
          <StatusRow
            label="Total Current"
            value={telemetry?.power?.current_a?.toFixed(2) || '0.00'}
            unit="A"
          />
          <StatusRow
            label="Power"
            value={((telemetry?.power?.voltage_v || 0) * (telemetry?.power?.current_a || 0)).toFixed(1)}
            unit="W"
          />
          <StatusRow
            label="Ambient Temp"
            value={telemetry?.environmental?.temp_c?.toFixed(1) || '0.0'}
            unit="°C"
            status={(telemetry?.environmental?.temp_c ?? 0) > 40 ? 'warning' : 'ok'}
          />
        </div>
      </div>
    </div>
  )
}
