/**
 * Servo status widget showing current, temperature, and mode
 */

import React from 'react'
import { Zap, Thermometer, Activity } from 'lucide-react'

import type { ServoState } from '@/types/telemetry'
import { formatCurrent, formatTemperature, formatTimestamp } from '@/lib/utils'

interface ServoWidgetProps {
  servos: Record<string, ServoState>
}

function ServoStatusBar({ servo }: { servo: ServoState }) {
  const getModeColor = (mode: ServoState['mode']) => {
    switch (mode) {
      case 'TRACK': return 'text-health-ok'
      case 'HOLD': return 'text-health-warn'
      case 'CALIB': return 'text-health-init'
      case 'IDLE': return 'text-health-off'
      default: return 'text-muted-foreground'
    }
  }

  const getCurrentColor = (current?: number) => {
    if (!current) return 'text-muted-foreground'
    if (current > 1200) return 'text-health-error'
    if (current > 1000) return 'text-health-warn'
    return 'text-health-ok'
  }

  const getTempColor = (temp?: number) => {
    if (!temp) return 'text-muted-foreground'
    if (temp > 70) return 'text-health-error'
    if (temp > 60) return 'text-health-warn'
    return 'text-health-ok'
  }

  return (
    <div className="flex items-center justify-between p-2 bg-secondary/20 rounded border border-secondary/30">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
          <span className="text-xs font-bold">{servo.axis}</span>
        </div>
        <div>
          <div className={`text-sm font-medium ${getModeColor(servo.mode)}`}>
            {servo.mode}
          </div>
          {servo.error_code && (
            <div className="text-xs text-health-error">
              {servo.error_code}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        {servo.current_ma && (
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span className={getCurrentColor(servo.current_ma)}>
              {formatCurrent(servo.current_ma)}
            </span>
          </div>
        )}

        {servo.temp_c && (
          <div className="flex items-center gap-1">
            <Thermometer className="w-3 h-3" />
            <span className={getTempColor(servo.temp_c)}>
              {formatTemperature(servo.temp_c)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ServoWidget({ servos }: ServoWidgetProps) {
  const servoList = Object.values(servos).sort((a, b) => {
    const order = { 'AZ': 0, 'EL': 1, 'CL': 2 }
    return order[a.axis] - order[b.axis]
  })

  const allOk = servoList.every(servo => !servo.error_code && servo.mode !== 'IDLE')
  const hasErrors = servoList.some(servo => servo.error_code)

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <span className="font-semibold">Servos</span>
          <div className="ml-auto">
            <div className={`w-2 h-2 rounded-full ${
              hasErrors ? 'bg-health-error' :
              allOk ? 'bg-health-ok' : 'bg-health-warn'
            }`} />
          </div>
        </div>
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-2">
        {servoList.map((servo) => (
          <ServoStatusBar key={servo.axis} servo={servo} />
        ))}

        {/* Summary stats */}
        <div className="border-t border-primary/20 pt-2 mt-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Total Current</span>
              <div className="font-mono">
                {servoList.reduce((sum, s) => sum + (s.current_ma || 0), 0)}mA
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Temp</span>
              <div className="font-mono">
                {(servoList.reduce((sum, s) => sum + (s.temp_c || 0), 0) / servoList.length).toFixed(1)}°C
              </div>
            </div>
          </div>
        </div>

        {/* Last update */}
        <div className="text-xs text-muted-foreground">
          {servoList[0] && formatTimestamp(servoList[0].ts)}
        </div>
      </div>
    </div>
  )
}