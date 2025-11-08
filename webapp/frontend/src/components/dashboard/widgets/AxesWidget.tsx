/**
 * Axes position widget - completely restructured
 */

import React from 'react'
import { RotateCw, AlertTriangle } from 'lucide-react'
import type { AxisState, LimitState, ServoState } from '@/types/telemetry'
import { formatAngle } from '@/lib/utils'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import { WidgetMenu, WidgetMenuItem } from './WidgetMenu'
import { servoApi } from '@/services/servoApi'

interface AxesWidgetProps {
  axes: Record<string, AxisState>
  limits?: Record<string, LimitState>
  imu?: {
    heading_mag_deg?: number
    heading_true_deg?: number
    declination_deg?: number
  }
  servos?: Record<string, ServoState>
}

// Simple circular gauge - shows only IMU heading for AZ in center
function CircularGauge({
  antennaPosition,
  min,
  max,
  label,
  heading
}: {
  antennaPosition: number
  min: number
  max: number
  label: string
  heading?: number
}) {
  const size = 90
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const range = max - min

  // Calculate dot position based on antenna position
  const progress = Math.max(0, Math.min(1, (antennaPosition - min) / range))
  const angleRad = progress * 2 * Math.PI - Math.PI / 2
  const dotX = center + radius * Math.cos(angleRad)
  const dotY = center + radius * Math.sin(angleRad)

  // Color based on proximity to limits
  const distFromMin = Math.abs(antennaPosition - min)
  const distFromMax = Math.abs(antennaPosition - max)
  const distFromLimit = Math.min(distFromMin, distFromMax)

  let dotColor = 'rgb(34, 197, 94)' // green
  if (distFromLimit <= 10) {
    dotColor = 'rgb(239, 68, 68)' // red - danger
  } else if (distFromLimit <= 30) {
    dotColor = 'rgb(245, 158, 11)' // amber - warning
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(50, 50, 50)" strokeWidth={strokeWidth} />
          <circle cx={dotX} cy={dotY} r="5" fill={dotColor} />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          {heading != null ? (
            <div className="text-lg font-mono font-bold">{heading.toFixed(1)}°</div>
          ) : (
            <div className="text-sm text-muted-foreground">--</div>
          )}
        </div>
      </div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  )
}

export function AxesWidget({ axes, limits, imu, servos }: AxesWidgetProps) {
  const setCustomSetting = useWidgetConfigStore((state) => state.setCustomSetting)
  const customSettings = useWidgetConfigStore((state) => state.widgets.axes.customSettings || {})

  const showGauges = customSettings.showGauges ?? true

  const handleClearError = async (axis: string) => {
    try {
      await servoApi.releaseLockedRotor(axis.toLowerCase())
    } catch (error) {
      console.error(`Failed to clear error for ${axis}:`, error)
    }
  }

  // Servo-to-antenna mapping
  const AZ_SERVO_MIN = -115.6
  const AZ_SERVO_MAX = -33.3
  const AZ_ANTENNA_MIN = -300
  const AZ_ANTENNA_MAX = 300

  const mapServoToAntenna = (servoAngle: number): number => {
    const servoRange = AZ_SERVO_MAX - AZ_SERVO_MIN
    const antennaRange = AZ_ANTENNA_MAX - AZ_ANTENNA_MIN
    return ((servoAngle - AZ_SERVO_MIN) / servoRange) * antennaRange + AZ_ANTENNA_MIN
  }

  const azData = axes.AZ
  const elData = axes.EL
  const clData = axes.CL

  // Calculate antenna positions
  const azAntennaPos = azData ? mapServoToAntenna(azData.actual_deg) : 0
  const elAntennaPos = elData?.actual_deg ?? 0
  const clAntennaPos = clData?.actual_deg ?? 0

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
          </WidgetMenu>
        </div>
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-3">

        {/* Gauges */}
        {showGauges && (
          <div className="flex justify-around">
            <CircularGauge
              antennaPosition={azAntennaPos}
              min={AZ_ANTENNA_MIN}
              max={AZ_ANTENNA_MAX}
              label="Azimuth"
              heading={imu?.heading_mag_deg ?? imu?.heading_true_deg}
            />
            <CircularGauge
              antennaPosition={elAntennaPos}
              min={-59}
              max={59}
              label="Elevation"
            />
            <CircularGauge
              antennaPosition={clAntennaPos}
              min={-10}
              max={10}
              label="Cross-level"
            />
          </div>
        )}

        {/* Limit Switches IN1/IN2 - side by side under each gauge */}
        {limits && (
          <div className="flex justify-around text-xs">
            {['AZ', 'EL', 'CL'].map(axis => {
              const limit = limits[axis]
              return (
                <div key={axis} className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">IN1</span>
                    <div className={`w-2 h-2 rounded-full ${limit?.in1 ? 'bg-red-500' : 'bg-green-500'}`} />
                  </div>
                  {limit?.in2 !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-[10px]">IN2</span>
                      <div className={`w-2 h-2 rounded-full ${limit.in2 ? 'bg-red-500' : 'bg-green-500'}`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* OUT1/OUT2 row - side by side */}
        <div className="flex justify-around text-xs">
          {['AZ', 'EL', 'CL'].map(axis => (
            <div key={axis} className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[10px]">OUT1</span>
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[10px]">OUT2</span>
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            </div>
          ))}
        </div>

        {/* Magnetic Heading Section */}
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs font-semibold text-center mb-2">Magnetic Heading</div>
          <div className="flex justify-around text-xs">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted-foreground">Mag</span>
              <span className="font-mono">{imu?.heading_mag_deg?.toFixed(1) ?? '--'}°</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted-foreground">True</span>
              <span className="font-mono">{imu?.heading_true_deg?.toFixed(1) ?? '--'}°</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted-foreground">Decl</span>
              <span className="font-mono">{imu?.declination_deg?.toFixed(1) ?? '--'}°</span>
            </div>
          </div>
        </div>

        {/* Servo Angles Section */}
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs font-semibold text-center mb-2">Servo Angles</div>
          <div className="flex justify-around text-xs font-mono">
            <div className="text-center">{azData?.actual_deg?.toFixed(1) ?? '--'}°</div>
            <div className="text-center">{elData?.actual_deg?.toFixed(1) ?? '--'}°</div>
            <div className="text-center">{clData?.actual_deg?.toFixed(1) ?? '--'}°</div>
          </div>
        </div>

        {/* Antenna Position Section */}
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs font-semibold text-center mb-2">Antenna Position</div>
          <div className="flex justify-around text-xs font-mono">
            <div className="text-center">{azAntennaPos.toFixed(1)}°</div>
            <div className="text-center">{elAntennaPos.toFixed(1)}°</div>
            <div className="text-center">{clAntennaPos.toFixed(1)}°</div>
          </div>
          <div className="flex justify-around text-[9px] text-muted-foreground mt-0.5">
            <div className="text-center">(-300 to +300)</div>
            <div className="text-center">(-59 to +59)</div>
            <div className="text-center">(-10 to +10)</div>
          </div>
        </div>

        {/* Limit Proximity Section */}
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs font-semibold text-center mb-2">Limit Proximity</div>
          <div className="flex justify-around text-xs font-mono">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">Min</span>
              <span>{Math.abs(azAntennaPos - AZ_ANTENNA_MIN).toFixed(1)}°</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">Min</span>
              <span>{Math.abs(elAntennaPos - (-59)).toFixed(1)}°</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">Min</span>
              <span>{Math.abs(clAntennaPos - (-10)).toFixed(1)}°</span>
            </div>
          </div>
          <div className="flex justify-around text-xs font-mono mt-1">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">Max</span>
              <span>{Math.abs(azAntennaPos - AZ_ANTENNA_MAX).toFixed(1)}°</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">Max</span>
              <span>{Math.abs(elAntennaPos - 59).toFixed(1)}°</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">Max</span>
              <span>{Math.abs(clAntennaPos - 10).toFixed(1)}°</span>
            </div>
          </div>
        </div>

        {/* Error Status Section */}
        {servos && (
          <div className="border-t border-white/10 pt-2">
            <div className="text-xs font-semibold text-center mb-2">Servo Status</div>
            <div className="flex justify-around text-xs">
              {['AZ', 'EL', 'CL'].map(axis => {
                const servo = servos[axis]
                const hasError = servo?.error_code && servo.error_code !== ''

                return (
                  <div key={axis} className="flex flex-col items-center gap-1">
                    {hasError ? (
                      <>
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/40 rounded">
                          <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />
                          <span className="text-red-400 font-mono text-[10px]">{servo.error_code}</span>
                        </div>
                        <button
                          onClick={() => handleClearError(axis)}
                          className="px-2 py-0.5 bg-red-500/30 hover:bg-red-500/50 border border-red-500/60 rounded text-[9px] transition-colors"
                        >
                          Clear Error
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 text-green-500">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[10px]">OK</span>
                      </div>
                    )}
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
