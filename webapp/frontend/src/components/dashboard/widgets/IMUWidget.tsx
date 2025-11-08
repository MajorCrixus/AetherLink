/**
 * IMU HUD widget with artificial horizon display, axes data, and detailed view options
 */

import React, { useMemo, useState } from 'react'
import { Compass, Thermometer, Menu, RotateCw, Move, Target } from 'lucide-react'

import type { IMU, AxisState } from '@/types/telemetry'
import { formatAngle, formatTemperature, formatTimestamp, getAngleColor, getErrorColor } from '@/lib/utils'

interface IMUWidgetProps {
  data: IMU
  axes?: Record<string, AxisState>
}

type UnitSystem = 'metric' | 'imperial'

type DisplayField =
  | 'horizon'
  | 'gyro'
  | 'accel'
  | 'temp'
  | 'az_gauge'
  | 'el_gauge'
  | 'cl_gauge'
  | 'az_details'
  | 'el_details'
  | 'cl_details'
  | 'timestamp'

interface WidgetSettings {
  unitSystem: UnitSystem
  displayFields: Set<DisplayField>
}

// Memoized component to prevent re-renders when roll/pitch haven't changed
const ArtificialHorizon = React.memo(({ roll, pitch }: { roll: number; pitch: number }) => {
  const size = 120
  const centerX = size / 2
  const centerY = size / 2
  const radius = size / 2 - 10

  // Memoize expensive calculations
  const { pitchOffset, rollTickMarks } = useMemo(() => {
    const pitchOffset = (pitch / 90) * radius * 0.8

    // Pre-calculate all roll tick positions
    const rollTickMarks = [-60, -45, -30, -15, 0, 15, 30, 45, 60].map((rollTick) => {
      const angle = (rollTick * Math.PI) / 180
      return {
        rollTick,
        x1: centerX + Math.sin(angle) * (radius - 5),
        y1: centerY - Math.cos(angle) * (radius - 5),
        x2: centerX + Math.sin(angle) * radius,
        y2: centerY - Math.cos(angle) * radius,
        strokeWidth: rollTick === 0 ? "2" : "1"
      }
    })

    return { pitchOffset, rollTickMarks }
  }, [pitch, roll, radius, centerX, centerY])

  return (
    <div className="relative mx-auto">
      <svg width={size} height={size} className="border border-primary/30 rounded-full bg-blue-900/20">
        {/* Sky/Ground background */}
        <defs>
          <clipPath id="horizonClip">
            <circle cx={centerX} cy={centerY} r={radius} />
          </clipPath>
        </defs>

        {/* Ground (brown) */}
        <rect
          x="0"
          y={centerY + pitchOffset}
          width={size}
          height={size}
          fill="#8B4513"
          opacity="0.3"
          clipPath="url(#horizonClip)"
          transform={`rotate(${roll} ${centerX} ${centerY})`}
        />

        {/* Sky (blue) */}
        <rect
          x="0"
          y="0"
          width={size}
          height={centerY + pitchOffset}
          fill="#4169E1"
          opacity="0.3"
          clipPath="url(#horizonClip)"
          transform={`rotate(${roll} ${centerX} ${centerY})`}
        />

        {/* Horizon line */}
        <line
          x1="10"
          y1={centerY + pitchOffset}
          x2={size - 10}
          y2={centerY + pitchOffset}
          stroke="white"
          strokeWidth="2"
          clipPath="url(#horizonClip)"
          transform={`rotate(${roll} ${centerX} ${centerY})`}
        />

        {/* Pitch indicators */}
        {[-30, -20, -10, 10, 20, 30].map((pitchLine) => {
          const y = centerY + pitchOffset - (pitchLine / 90) * radius * 0.8
          return (
            <line
              key={pitchLine}
              x1={centerX - 15}
              y1={y}
              x2={centerX + 15}
              y2={y}
              stroke="white"
              strokeWidth="1"
              opacity="0.6"
              clipPath="url(#horizonClip)"
              transform={`rotate(${roll} ${centerX} ${centerY})`}
            />
          )
        })}

        {/* Aircraft symbol (fixed) */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          <line x1="-20" y1="0" x2="-5" y2="0" stroke="orange" strokeWidth="3" />
          <line x1="5" y1="0" x2="20" y2="0" stroke="orange" strokeWidth="3" />
          <line x1="0" y1="-8" x2="0" y2="8" stroke="orange" strokeWidth="3" />
          <circle cx="0" cy="0" r="2" fill="orange" />
        </g>

        {/* Roll scale */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* Roll tick marks */}
        {rollTickMarks.map((tick) => (
          <line
            key={tick.rollTick}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="white"
            strokeWidth={tick.strokeWidth}
            opacity="0.6"
          />
        ))}

        {/* Roll indicator */}
        <g transform={`rotate(${roll} ${centerX} ${centerY})`}>
          <polygon
            points={`${centerX},10 ${centerX - 5},20 ${centerX + 5},20`}
            fill="orange"
          />
        </g>
      </svg>
    </div>
  )
})

ArtificialHorizon.displayName = 'ArtificialHorizon'

// Circular gauge component for axes
interface CircularGaugeProps {
  value: number
  target: number
  min: number
  max: number
  label: string
  unit?: string
}

const CircularGauge = React.memo(({ value, target, min, max, label, unit = '°' }: CircularGaugeProps) => {
  const size = 70
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate angles for gauge (270 degrees total, starting from top)
  const range = max - min
  const valueAngle = ((value - min) / range) * 270 - 135
  const targetAngle = ((target - min) / range) * 270 - 135

  // Calculate stroke dash array for progress
  const valueProgress = Math.max(0, Math.min(1, (value - min) / range))
  const targetProgress = Math.max(0, Math.min(1, (target - min) / range))

  const valueDashArray = `${valueProgress * circumference * 0.75} ${circumference}`
  const targetDashArray = `${targetProgress * circumference * 0.75} ${circumference}`

  const error = Math.abs(target - value)
  const valueColor = getAngleColor(value, min, max)

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          className="absolute inset-0 -rotate-45"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(64, 64, 64)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Target position */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(245, 158, 11)"
            strokeWidth={strokeWidth / 2}
            strokeDasharray={targetDashArray}
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Current value */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={valueColor}
            strokeWidth={strokeWidth}
            strokeDasharray={valueDashArray}
            strokeLinecap="round"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xs font-mono font-bold">
            {value.toFixed(1)}{unit}
          </div>
          <div className="text-xs text-muted-foreground">
            ±{error.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  )
})

CircularGauge.displayName = 'CircularGauge'

// Temperature conversion utilities
const celsiusToFahrenheit = (c: number) => (c * 9 / 5) + 32
const formatTemp = (temp: number, unit: UnitSystem) => {
  if (unit === 'imperial') {
    return `${celsiusToFahrenheit(temp).toFixed(1)}°F`
  }
  return `${temp.toFixed(1)}°C`
}

// Gyro/Accel conversion utilities (for imperial: convert to different units if needed)
const formatGyro = (dps: number, unit: UnitSystem) => {
  // Keep as degrees per second for both systems
  return `${dps.toFixed(2)}°/s`
}

const formatAccel = (g: number, unit: UnitSystem) => {
  // Keep as g-forces for both systems (standard in aviation)
  return `${g.toFixed(3)}g`
}

export function IMUWidget({ data, axes }: IMUWidgetProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [settings, setSettings] = useState<WidgetSettings>({
    unitSystem: 'metric',
    displayFields: new Set(['horizon', 'temp', 'az_gauge', 'el_gauge', 'cl_gauge', 'timestamp'])
  })

  const axesConfig = {
    AZ: { min: -300, max: 300, label: 'Azimuth' },
    EL: { min: -59, max: 59, label: 'Elevation' },
    CL: { min: -10, max: 10, label: 'Cross-level' }
  }

  const toggleField = (field: DisplayField) => {
    setSettings(prev => {
      const newFields = new Set(prev.displayFields)
      if (newFields.has(field)) {
        newFields.delete(field)
      } else {
        newFields.add(field)
      }
      return { ...prev, displayFields: newFields }
    })
  }

  const toggleUnitSystem = () => {
    setSettings(prev => ({
      ...prev,
      unitSystem: prev.unitSystem === 'metric' ? 'imperial' : 'metric'
    }))
  }

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4" />
          <span className="font-semibold">IMU & Axes</span>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="ml-auto p-1 hover:bg-primary/20 rounded transition-colors"
            title="Settings"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Menu */}
        {showMenu && (
          <div className="mt-2 p-2 bg-background/95 border border-primary/30 rounded text-xs space-y-2 max-h-96 overflow-y-auto">
            <div className="font-semibold text-primary mb-2">Display Options</div>

            {/* Unit System Toggle */}
            <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
              <span>Units: {settings.unitSystem === 'metric' ? 'Metric' : 'Imperial'}</span>
              <input
                type="checkbox"
                checked={settings.unitSystem === 'imperial'}
                onChange={toggleUnitSystem}
                className="ml-2"
              />
            </label>

            <div className="border-t border-primary/20 pt-2 mt-2">
              <div className="font-medium mb-1">IMU Data</div>
              <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                <span>Artificial Horizon</span>
                <input
                  type="checkbox"
                  checked={settings.displayFields.has('horizon')}
                  onChange={() => toggleField('horizon')}
                  className="ml-2"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                <span>Gyroscope</span>
                <input
                  type="checkbox"
                  checked={settings.displayFields.has('gyro')}
                  onChange={() => toggleField('gyro')}
                  className="ml-2"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                <span>Accelerometer</span>
                <input
                  type="checkbox"
                  checked={settings.displayFields.has('accel')}
                  onChange={() => toggleField('accel')}
                  className="ml-2"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                <span>Temperature</span>
                <input
                  type="checkbox"
                  checked={settings.displayFields.has('temp')}
                  onChange={() => toggleField('temp')}
                  className="ml-2"
                />
              </label>
            </div>

            {axes && (
              <div className="border-t border-primary/20 pt-2 mt-2">
                <div className="font-medium mb-1">Azimuth (AZ)</div>
                <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                  <span>Circular Gauge</span>
                  <input
                    type="checkbox"
                    checked={settings.displayFields.has('az_gauge')}
                    onChange={() => toggleField('az_gauge')}
                    className="ml-2"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                  <span>Detailed Values</span>
                  <input
                    type="checkbox"
                    checked={settings.displayFields.has('az_details')}
                    onChange={() => toggleField('az_details')}
                    className="ml-2"
                  />
                </label>

                <div className="font-medium mb-1 mt-2">Elevation (EL)</div>
                <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                  <span>Circular Gauge</span>
                  <input
                    type="checkbox"
                    checked={settings.displayFields.has('el_gauge')}
                    onChange={() => toggleField('el_gauge')}
                    className="ml-2"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                  <span>Detailed Values</span>
                  <input
                    type="checkbox"
                    checked={settings.displayFields.has('el_details')}
                    onChange={() => toggleField('el_details')}
                    className="ml-2"
                  />
                </label>

                <div className="font-medium mb-1 mt-2">Cross-Level (CL)</div>
                <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                  <span>Circular Gauge</span>
                  <input
                    type="checkbox"
                    checked={settings.displayFields.has('cl_gauge')}
                    onChange={() => toggleField('cl_gauge')}
                    className="ml-2"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                  <span>Detailed Values</span>
                  <input
                    type="checkbox"
                    checked={settings.displayFields.has('cl_details')}
                    onChange={() => toggleField('cl_details')}
                    className="ml-2"
                  />
                </label>
              </div>
            )}

            <div className="border-t border-primary/20 pt-2 mt-2">
              <div className="font-medium mb-1">Other</div>
              <label className="flex items-center justify-between cursor-pointer hover:bg-primary/10 p-1 rounded">
                <span>Timestamp</span>
                <input
                  type="checkbox"
                  checked={settings.displayFields.has('timestamp')}
                  onChange={() => toggleField('timestamp')}
                  className="ml-2"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-3">
        {/* Artificial Horizon with Roll/Pitch/Yaw underneath */}
        {settings.displayFields.has('horizon') && (
          <div>
            <ArtificialHorizon roll={data.roll_deg} pitch={data.pitch_deg} />
            {/* Attitude Values directly under horizon */}
            <div className="grid grid-cols-3 gap-4 text-center mt-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Roll</div>
                <div className="text-sm font-mono font-medium">
                  {formatAngle(data.roll_deg)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Pitch</div>
                <div className="text-sm font-mono font-medium">
                  {formatAngle(data.pitch_deg)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Yaw</div>
                <div className="text-sm font-mono font-medium">
                  {formatAngle(data.yaw_deg)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Temperature */}
        {settings.displayFields.has('temp') && data.temp_c && (
          <div className="flex items-center justify-between p-2 bg-primary/5 rounded text-xs">
            <div className="flex items-center gap-2">
              <Thermometer className="w-3 h-3" />
              <span className="text-muted-foreground">Temperature</span>
            </div>
            <span className="font-mono font-medium">
              {formatTemp(data.temp_c, settings.unitSystem)}
            </span>
          </div>
        )}

        {/* Gyroscope */}
        {settings.displayFields.has('gyro') && (
          <div className="p-2 bg-primary/5 rounded text-xs">
            <div className="font-medium mb-2">Gyroscope (Angular Velocity)</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-muted-foreground mb-1">X</div>
                <div className="font-mono">
                  {data.gyro_x !== undefined && data.gyro_x !== null ? formatGyro(data.gyro_x, settings.unitSystem) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Y</div>
                <div className="font-mono">
                  {data.gyro_y !== undefined && data.gyro_y !== null ? formatGyro(data.gyro_y, settings.unitSystem) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Z</div>
                <div className="font-mono">
                  {data.gyro_z !== undefined && data.gyro_z !== null ? formatGyro(data.gyro_z, settings.unitSystem) : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Accelerometer */}
        {settings.displayFields.has('accel') && (
          <div className="p-2 bg-primary/5 rounded text-xs">
            <div className="font-medium mb-2">Accelerometer</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-muted-foreground mb-1">X</div>
                <div className="font-mono">
                  {data.accel_x !== undefined && data.accel_x !== null ? formatAccel(data.accel_x, settings.unitSystem) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Y</div>
                <div className="font-mono">
                  {data.accel_y !== undefined && data.accel_y !== null ? formatAccel(data.accel_y, settings.unitSystem) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Z</div>
                <div className="font-mono">
                  {data.accel_z !== undefined && data.accel_z !== null ? formatAccel(data.accel_z, settings.unitSystem) : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Axes Data - Individual Gauges */}
        {axes && (axes.AZ || axes.EL || axes.CL) && (
          <>
            {/* Azimuth */}
            {axes.AZ && (settings.displayFields.has('az_gauge') || settings.displayFields.has('az_details')) && (
              <div className="border-t border-primary/20 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCw className="w-3 h-3" />
                  <span className="text-xs font-semibold">Azimuth (AZ)</span>
                </div>
                {settings.displayFields.has('az_gauge') && (
                  <div className="flex justify-center mb-2">
                    <CircularGauge
                      value={axes.AZ.actual_deg}
                      target={axes.AZ.target_deg}
                      min={axesConfig.AZ.min}
                      max={axesConfig.AZ.max}
                      label={axesConfig.AZ.label}
                    />
                  </div>
                )}
                {settings.displayFields.has('az_details') && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground w-16">AZ</span>
                    <div className="flex items-center gap-4 font-mono">
                      <div className="flex items-center gap-1">
                        <Move className="w-3 h-3 text-muted-foreground" />
                        <span>{formatAngle(axes.AZ.actual_deg)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-amber-500" />
                        <span>{formatAngle(axes.AZ.target_deg)}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Δ{formatAngle(Math.abs(axes.AZ.error_deg))}
                      </div>
                      {axes.AZ.rate_dps !== undefined && axes.AZ.rate_dps !== null && (
                        <div className="text-muted-foreground">
                          {axes.AZ.rate_dps.toFixed(1)}°/s
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Elevation */}
            {axes.EL && (settings.displayFields.has('el_gauge') || settings.displayFields.has('el_details')) && (
              <div className="border-t border-primary/20 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCw className="w-3 h-3" />
                  <span className="text-xs font-semibold">Elevation (EL)</span>
                </div>
                {settings.displayFields.has('el_gauge') && (
                  <div className="flex justify-center mb-2">
                    <CircularGauge
                      value={axes.EL.actual_deg}
                      target={axes.EL.target_deg}
                      min={axesConfig.EL.min}
                      max={axesConfig.EL.max}
                      label={axesConfig.EL.label}
                    />
                  </div>
                )}
                {settings.displayFields.has('el_details') && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground w-16">EL</span>
                    <div className="flex items-center gap-4 font-mono">
                      <div className="flex items-center gap-1">
                        <Move className="w-3 h-3 text-muted-foreground" />
                        <span>{formatAngle(axes.EL.actual_deg)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-amber-500" />
                        <span>{formatAngle(axes.EL.target_deg)}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Δ{formatAngle(Math.abs(axes.EL.error_deg))}
                      </div>
                      {axes.EL.rate_dps !== undefined && axes.EL.rate_dps !== null && (
                        <div className="text-muted-foreground">
                          {axes.EL.rate_dps.toFixed(1)}°/s
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cross-Level */}
            {axes.CL && (settings.displayFields.has('cl_gauge') || settings.displayFields.has('cl_details')) && (
              <div className="border-t border-primary/20 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCw className="w-3 h-3" />
                  <span className="text-xs font-semibold">Cross-Level (CL)</span>
                </div>
                {settings.displayFields.has('cl_gauge') && (
                  <div className="flex justify-center mb-2">
                    <CircularGauge
                      value={axes.CL.actual_deg}
                      target={axes.CL.target_deg}
                      min={axesConfig.CL.min}
                      max={axesConfig.CL.max}
                      label={axesConfig.CL.label}
                    />
                  </div>
                )}
                {settings.displayFields.has('cl_details') && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground w-16">CL</span>
                    <div className="flex items-center gap-4 font-mono">
                      <div className="flex items-center gap-1">
                        <Move className="w-3 h-3 text-muted-foreground" />
                        <span>{formatAngle(axes.CL.actual_deg)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-amber-500" />
                        <span>{formatAngle(axes.CL.target_deg)}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Δ{formatAngle(Math.abs(axes.CL.error_deg))}
                      </div>
                      {axes.CL.rate_dps !== undefined && axes.CL.rate_dps !== null && (
                        <div className="text-muted-foreground">
                          {axes.CL.rate_dps.toFixed(1)}°/s
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Timestamp */}
        {settings.displayFields.has('timestamp') && (
          <div className="border-t border-primary/20 pt-2 mt-3">
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(data.ts)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}