/**
 * Axes position widget with circular gauges for AZ/EL/CL
 */

import React from 'react'
import { RotateCw, Move, Target } from 'lucide-react'

import type { AxisState } from '@/types/telemetry'
import { formatAngle, getAngleColor, getErrorColor } from '@/lib/utils'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import { WidgetMenu, WidgetMenuItem } from './WidgetMenu'

interface AxesWidgetProps {
  axes: Record<string, AxisState>
  limits?: Record<string, { in1: boolean; in2?: boolean }>
  imu?: {
    heading_mag_deg?: number
    heading_true_deg?: number
    declination_deg?: number
  }
}

interface CircularGaugeProps {
  value: number // Antenna azimuth or axis angle
  target: number // Target antenna azimuth
  min: number
  max: number
  label: string
  unit?: string
  fullCircle?: boolean
  limitWarningDeg?: number
  limitDangerDeg?: number
  // Azimuth-specific display options
  heading?: number // IMU heading
  headingLabel?: string
  servoAngle?: number // Raw servo shaft angle
  showHeading?: boolean
  showAntennaAz?: boolean
  showServoAngle?: boolean
}

function CircularGauge({
  value, target, min, max, label, unit = '°',
  fullCircle = false, limitWarningDeg = 30, limitDangerDeg = 10,
  heading, headingLabel, servoAngle,
  showHeading = true, showAntennaAz = true, showServoAngle = false
}: CircularGaugeProps) {
  const size = 90
  const strokeWidth = fullCircle ? 6 : 8
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const range = max - min
  const error = Math.abs(target - value)

  if (fullCircle) {
    // Full circle gauge for azimuth
    // For azimuth, we map the actual value directly (no modulo needed for display)
    // The servo reports actual position within its configured range

    // Clamp value to range for visualization
    const clampedValue = Math.max(min, Math.min(max, value))

    // Calculate angle for visualization (0° at top, clockwise)
    const angleRad = ((clampedValue - min) / range) * 2 * Math.PI - Math.PI / 2
    const dotX = center + radius * Math.cos(angleRad)
    const dotY = center + radius * Math.sin(angleRad)

    // Distance from limits - check how close we are to either end
    const distFromMin = Math.abs(value - min)
    const distFromMax = Math.abs(value - max)
    const distFromLimit = Math.min(distFromMin, distFromMax)

    // Color based on proximity to limits
    let dotColor = 'rgb(34, 197, 94)' // green - safe
    if (distFromLimit <= limitDangerDeg) {
      dotColor = 'rgb(239, 68, 68)' // red - danger zone
    } else if (distFromLimit <= limitWarningDeg) {
      dotColor = 'rgb(245, 158, 11)' // amber - warning zone
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="absolute inset-0">
            {/* Full background circle */}
            <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(50, 50, 50)" strokeWidth={strokeWidth} />

            {/* Limit markers at min/max positions */}
            <line x1={center} y1={strokeWidth} x2={center} y2={strokeWidth + 8} stroke="rgb(239, 68, 68)" strokeWidth="2" />

            {/* Rotating position dot */}
            <circle cx={dotX} cy={dotY} r="5" fill={dotColor} />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
            {fullCircle ? (
              // Azimuth display with multiple values
              <>
                {showHeading && heading !== undefined && (
                  <>
                    <div className="text-[8px] text-muted-foreground leading-tight">{headingLabel}</div>
                    <div className="text-sm font-mono font-bold leading-tight">{heading.toFixed(1)}{unit}</div>
                  </>
                )}
                {showAntennaAz && (
                  <>
                    <div className="text-[8px] text-muted-foreground leading-tight mt-0.5">Antenna</div>
                    <div className="text-xs font-mono leading-tight">{clampedValue.toFixed(1)}{unit}</div>
                  </>
                )}
                {showServoAngle && servoAngle !== undefined && (
                  <div className="text-[8px] text-muted-foreground leading-tight">Srv {servoAngle.toFixed(1)}{unit}</div>
                )}
                <div className="text-[8px] text-muted-foreground leading-tight mt-0.5">Δ{error.toFixed(1)}{unit}</div>
              </>
            ) : (
              // Standard display for elevation/cross-level
              <>
                <div className="text-sm font-mono font-bold">{clampedValue.toFixed(1)}{unit}</div>
                <div className="text-xs text-muted-foreground">Δ{error.toFixed(1)}</div>
              </>
            )}
          </div>
        </div>
        <div className="text-xs font-medium">{label}</div>
      </div>
    )
  }

  // Semi-circle arc gauge for elevation/cross-level
  const valueProgress = Math.max(0, Math.min(1, (value - min) / range))
  const targetProgress = Math.max(0, Math.min(1, (target - min) / range))
  const valueDashArray = `${valueProgress * circumference * 0.75} ${circumference}`
  const targetDashArray = `${targetProgress * circumference * 0.75} ${circumference}`
  const valueColor = getAngleColor(value, min, max)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0">
          <circle
            cx={center} cy={center} r={radius} fill="none"
            stroke="rgb(50, 50, 50)" strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeLinecap="round" transform={`rotate(-135 ${center} ${center})`}
          />
          <circle
            cx={center} cy={center} r={radius} fill="none"
            stroke="rgb(245, 158, 11)" strokeWidth={strokeWidth * 0.4}
            strokeDasharray={targetDashArray} strokeLinecap="round"
            opacity="0.5" transform={`rotate(-135 ${center} ${center})`}
          />
          <circle
            cx={center} cy={center} r={radius} fill="none"
            stroke={valueColor} strokeWidth={strokeWidth}
            strokeDasharray={valueDashArray} strokeLinecap="round"
            transform={`rotate(-135 ${center} ${center})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-sm font-mono font-bold">{value.toFixed(1)}{unit}</div>
          <div className="text-xs text-muted-foreground">Δ{error.toFixed(1)}</div>
        </div>
      </div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  )
}

export function AxesWidget({ axes, limits, imu }: AxesWidgetProps) {
  const setCustomSetting = useWidgetConfigStore((state) => state.setCustomSetting)
  const customSettings = useWidgetConfigStore((state) => state.widgets.axes.customSettings || {})

  const showGauges = customSettings.showGauges ?? true
  const showDetails = customSettings.showDetails ?? true
  const showLimits = customSettings.showLimits ?? true
  const showHeading = customSettings.showHeading ?? true
  const showAntennaAz = customSettings.showAntennaAz ?? true
  const showServoAngle = customSettings.showServoAngle ?? false

  // Azimuth servo calibration: servo shaft angle -> antenna azimuth angle
  // Servo -115.6° (IN1/CCW limit) -> Antenna -300°
  // Servo -33.3° (IN2/CW limit) -> Antenna +300°
  const AZ_SERVO_MIN = -115.6
  const AZ_SERVO_MAX = -33.3
  const AZ_ANTENNA_MIN = -300
  const AZ_ANTENNA_MAX = 300

  // Map servo angle to antenna angle
  const mapServoToAntenna = (servoAngle: number): number => {
    const servoRange = AZ_SERVO_MAX - AZ_SERVO_MIN
    const antennaRange = AZ_ANTENNA_MAX - AZ_ANTENNA_MIN
    return ((servoAngle - AZ_SERVO_MIN) / servoRange) * antennaRange + AZ_ANTENNA_MIN
  }

  const axesConfig = {
    AZ: { min: AZ_ANTENNA_MIN, max: AZ_ANTENNA_MAX, label: 'Azimuth', servoMin: AZ_SERVO_MIN, servoMax: AZ_SERVO_MAX },
    EL: { min: -59, max: 59, label: 'Elevation' },
    CL: { min: -10, max: 10, label: 'Cross-level' }
  }

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            <span className="font-semibold">Axes Position</span>
          </div>
          <WidgetMenu>
            <WidgetMenuItem label="Show Gauges" checked={showGauges} onChange={(c) => setCustomSetting('axes', 'showGauges', c)} />
            <WidgetMenuItem label="Show Details" checked={showDetails} onChange={(c) => setCustomSetting('axes', 'showDetails', c)} />
            <WidgetMenuItem label="Show Limits" checked={showLimits} onChange={(c) => setCustomSetting('axes', 'showLimits', c)} />
            <div className="border-t border-white/10 my-1" />
            <div className="text-xs text-muted-foreground px-1.5 py-0.5">Azimuth Display:</div>
            <WidgetMenuItem label="IMU Heading" checked={showHeading} onChange={(c) => setCustomSetting('axes', 'showHeading', c)} />
            <WidgetMenuItem label="Antenna Azimuth" checked={showAntennaAz} onChange={(c) => setCustomSetting('axes', 'showAntennaAz', c)} />
            <WidgetMenuItem label="Servo Angle" checked={showServoAngle} onChange={(c) => setCustomSetting('axes', 'showServoAngle', c)} />
          </WidgetMenu>
        </div>
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden">
        {showGauges && (
          <div className="flex justify-around mb-4">
            {Object.entries(axesConfig).map(([axis, config]) => {
              const axisData = axes[axis]
              if (!axisData) return null

              // For azimuth, map servo angle to antenna angle
              const displayValue = axis === 'AZ' ? mapServoToAntenna(axisData.actual_deg) : axisData.actual_deg
              const displayTarget = axis === 'AZ' ? mapServoToAntenna(axisData.target_deg) : axisData.target_deg

              // For azimuth, include IMU heading if available
              const heading = axis === 'AZ' ? imu?.heading_true_deg ?? imu?.heading_mag_deg : undefined
              const headingLabel = axis === 'AZ' && imu?.heading_true_deg !== undefined ? 'True' :
                                   axis === 'AZ' && imu?.heading_mag_deg !== undefined ? 'Mag' : undefined

              return (
                <CircularGauge
                  key={axis}
                  value={displayValue}
                  target={displayTarget}
                  min={config.min}
                  max={config.max}
                  label={config.label}
                  fullCircle={axis === 'AZ'}
                  limitWarningDeg={30}
                  limitDangerDeg={10}
                  heading={heading}
                  headingLabel={headingLabel}
                  servoAngle={axis === 'AZ' ? axisData.actual_deg : undefined}
                  showHeading={showHeading}
                  showAntennaAz={showAntennaAz}
                  showServoAngle={showServoAngle}
                />
              )
            })}
          </div>
        )}

        {showDetails && (
          <div className="space-y-2">
            {Object.entries(axesConfig).map(([axis, config]) => {
              const axisData = axes[axis]
              if (!axisData) return null

              // For azimuth, show antenna angle (mapped from servo)
              const displayActual = axis === 'AZ' ? mapServoToAntenna(axisData.actual_deg) : axisData.actual_deg
              const displayTarget = axis === 'AZ' ? mapServoToAntenna(axisData.target_deg) : axisData.target_deg
              const displayError = Math.abs(displayTarget - displayActual)

              return (
                <div key={axis} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground w-16">{axis}</span>
                  <div className="flex items-center gap-4 font-mono">
                    <div className="flex items-center gap-1">
                      <Move className="w-3 h-3 text-muted-foreground" />
                      <span>{formatAngle(displayActual)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-amber-500" />
                      <span>{formatAngle(displayTarget)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Δ{formatAngle(displayError)}
                    </div>
                    {axisData.rate_dps && (
                      <div className="text-muted-foreground">
                        {axisData.rate_dps.toFixed(1)}°/s
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showLimits && limits && Object.keys(limits).length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs font-semibold mb-2">Limit Switches</div>
            <div className="space-y-1.5">
              {Object.entries(limits).map(([axis, limit]) => {
                if (!limit) return null
                return (
                  <div key={axis} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground w-16">{axis}</span>
                    <div className="flex items-center gap-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">IN1</span>
                        <div className={`w-2 h-2 rounded-full ${limit.in1 ? 'bg-red-500' : 'bg-green-500'}`} />
                      </div>
                      {limit.in2 !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">IN2</span>
                          <div className={`w-2 h-2 rounded-full ${limit.in2 ? 'bg-red-500' : 'bg-green-500'}`} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}