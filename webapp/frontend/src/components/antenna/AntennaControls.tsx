/**
 * Antenna control panel with interactive controls
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  Move,
  Home,
  RotateCw,
  AlertTriangle,
  Lock,
  Unlock,
  Satellite,
  ChevronRight
} from 'lucide-react'

import { useTelemetryData, useSatelliteData } from '@/stores/telemetryStore'
import { antennaApi } from '@/services/antennaApi'

interface AxisControlProps {
  axis: 'az' | 'el' | 'cl'
  label: string
  min: number
  max: number
  value: number
  target: number
  unit?: string
  onMove: (value: number) => void
}

function AxisControl({ axis, label, min, max, value, target, unit = '°', onMove }: AxisControlProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  const [isEditing, setIsEditing] = useState(false)

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setInputValue(val.toString())
    onMove(val)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const val = parseFloat(inputValue)
    if (!isNaN(val) && val >= min && val <= max) {
      onMove(val)
    } else {
      setInputValue(value.toString())
    }
    setIsEditing(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur()
    } else if (e.key === 'Escape') {
      setInputValue(value.toString())
      setIsEditing(false)
    }
  }

  const errorDeg = Math.abs(value - target)
  const isAtTarget = errorDeg < 0.5

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Target: {target.toFixed(1)}{unit}
          </span>
          {!isAtTarget && (
            <span className="text-xs text-amber-400">
              (Δ{errorDeg.toFixed(1)}{unit})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={target}
          onChange={handleSliderChange}
          className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <input
          type="number"
          value={isEditing ? inputValue : target.toFixed(1)}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsEditing(true)}
          onKeyDown={handleInputKeyDown}
          step={0.1}
          min={min}
          max={max}
          className="w-20 px-2 py-1 text-sm font-mono bg-secondary border border-secondary-foreground/20 rounded text-right"
        />
        <span className="text-sm font-mono w-6">{unit}</span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Current: <span className="font-mono">{value.toFixed(1)}{unit}</span>
        </span>
        <span className="text-muted-foreground">
          Range: {min}{unit} to {max}{unit}
        </span>
      </div>

      {/* Progress bar showing current vs target */}
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${isAtTarget ? 'bg-green-500' : 'bg-amber-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${((value - min) / (max - min)) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  )
}

export function AntennaControls() {
  const telemetry = useTelemetryData()
  const satellites = useSatelliteData()
  const [isLocked, setIsLocked] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [selectedSatellite, setSelectedSatellite] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [targets, setTargets] = useState({
    az: telemetry?.axes.AZ?.target_deg || 0,
    el: telemetry?.axes.EL?.target_deg || 0,
    cl: telemetry?.axes.CL?.target_deg || 0
  })

  const handleMove = async (axis: 'az' | 'el' | 'cl', value: number) => {
    if (isLocked) return
    setTargets(prev => ({ ...prev, [axis]: value }))
  }

  const handleExecuteMove = async () => {
    if (isLocked || isMoving) return

    setIsMoving(true)
    setError(null)

    try {
      await Promise.all([
        antennaApi.move('az', targets.az),
        antennaApi.move('el', targets.el),
        antennaApi.move('cl', targets.cl)
      ])
    } catch (err: any) {
      setError(err.message || 'Failed to move antenna')
    } finally {
      setIsMoving(false)
    }
  }

  const handlePreset = async (preset: 'stow' | 'zenith' | 'north' | 'south' | 'east' | 'west') => {
    if (isLocked || isMoving) return

    setIsMoving(true)
    setError(null)

    try {
      await antennaApi.moveToPreset(preset)
    } catch (err: any) {
      setError(err.message || 'Failed to move to preset')
    } finally {
      setIsMoving(false)
    }
  }

  const handleHome = async () => {
    if (isLocked || isMoving) return

    setIsMoving(true)
    setError(null)

    try {
      await Promise.all([
        antennaApi.home('az'),
        antennaApi.home('el'),
        antennaApi.home('cl')
      ])
    } catch (err: any) {
      setError(err.message || 'Failed to home antenna')
    } finally {
      setIsMoving(false)
    }
  }

  const handleEmergencyStop = async () => {
    try {
      await antennaApi.stopAll()
      setIsMoving(false)
    } catch (err: any) {
      console.error('Emergency stop failed:', err)
    }
  }

  const handleTrackSatellite = async (satId: number) => {
    if (isLocked || isMoving) return

    setIsMoving(true)
    setError(null)
    setSelectedSatellite(satId)

    try {
      await antennaApi.trackSatellite(satId)
    } catch (err: any) {
      setError(err.message || 'Failed to track satellite')
      setSelectedSatellite(null)
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Antenna Control</h2>
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`btn btn-sm ${isLocked ? 'btn-danger' : 'btn-secondary'}`}
          title={isLocked ? 'Unlock controls' : 'Lock controls'}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/50 rounded p-3 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Position Control */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span>Position Control</span>
          </div>
        </div>
        <div className="panel-content space-y-4">
          <AxisControl
            axis="az"
            label="Azimuth (AZ)"
            min={-300}
            max={300}
            value={telemetry?.axes.AZ?.actual_deg || 0}
            target={targets.az}
            onMove={(val) => handleMove('az', val)}
          />

          <AxisControl
            axis="el"
            label="Elevation (EL)"
            min={-59}
            max={59}
            value={telemetry?.axes.EL?.actual_deg || 0}
            target={targets.el}
            onMove={(val) => handleMove('el', val)}
          />

          <AxisControl
            axis="cl"
            label="Cross-level (CL)"
            min={-10}
            max={10}
            value={telemetry?.axes.CL?.actual_deg || 0}
            target={targets.cl}
            onMove={(val) => handleMove('cl', val)}
          />

          {/* Control buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleExecuteMove}
              disabled={isLocked || isMoving}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMoving ? (
                <>
                  <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                <>
                  <Move className="w-4 h-4 mr-2" />
                  Execute Move
                </>
              )}
            </button>
            <button
              onClick={handleHome}
              disabled={isLocked || isMoving}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Home all axes"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Positions */}
      <div className="panel">
        <div className="panel-header">
          <span>Quick Positions</span>
        </div>
        <div className="panel-content">
          <div className="grid grid-cols-2 gap-2">
            {(['stow', 'zenith', 'north', 'south', 'east', 'west'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePreset(preset)}
                disabled={isLocked || isMoving}
                className="btn btn-secondary text-xs capitalize disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Satellite Tracking */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4" />
            <span>Satellite Tracking</span>
          </div>
        </div>
        <div className="panel-content">
          {satellites?.list && satellites.list.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {satellites.list.slice(0, 10).map((sat) => (
                <button
                  key={sat.norad_id}
                  onClick={() => handleTrackSatellite(sat.norad_id)}
                  disabled={isLocked || isMoving}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedSatellite === sat.norad_id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{sat.name}</span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {sat.orbit} • NORAD {sat.norad_id}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No satellites available
            </p>
          )}
        </div>
      </div>

      {/* Emergency Stop */}
      <button
        onClick={handleEmergencyStop}
        className="btn btn-danger w-full"
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        EMERGENCY STOP
      </button>
    </div>
  )
}
