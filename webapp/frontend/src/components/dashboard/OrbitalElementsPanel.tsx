/**
 * Orbital Elements Panel
 * Displays the 6 Classical Orbital Elements (COEs) from TLE data
 * Perfect for orbital mechanics students!
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Orbit, Info, Circle } from 'lucide-react'
import type { TLE } from '@/types/satellite'

interface OrbitalElementsPanelProps {
  tle: TLE | null
  satelliteName: string
  onClose: () => void
}

interface OrbitalElements {
  // Classical Orbital Elements (COEs)
  semiMajorAxis_km: number  // a
  eccentricity: number       // e
  inclination_deg: number    // i
  raan_deg: number           // Ω (Right Ascension of Ascending Node)
  argOfPerigee_deg: number   // ω (Argument of Perigee)
  meanAnomaly_deg: number    // M

  // Derived values
  period_minutes: number
  apogee_km: number
  perigee_km: number

  // TLE epoch
  epochYear: number
  epochDay: number
}

/**
 * Parse TLE Line 2 to extract orbital elements
 * TLE Line 2 format:
 * Columns 1-8: Inclination (degrees)
 * Columns 9-16: RAAN (degrees)
 * Columns 17-25: Eccentricity (implied decimal point)
 * Columns 26-34: Argument of Perigee (degrees)
 * Columns 35-43: Mean Anomaly (degrees)
 * Columns 44-63: Mean Motion (revs/day)
 */
function parseTLE(tle: TLE): OrbitalElements | null {
  try {
    const line1 = tle.line1
    const line2 = tle.line2

    // Extract from Line 1
    const epochYearStr = line1.substring(18, 20)
    const epochDayStr = line1.substring(20, 32)
    const epochYear = 2000 + parseInt(epochYearStr)
    const epochDay = parseFloat(epochDayStr)

    // Extract from Line 2
    const inclination = parseFloat(line2.substring(8, 16).trim())
    const raan = parseFloat(line2.substring(17, 25).trim())
    const eccentricityStr = line2.substring(26, 33).trim()
    const eccentricity = parseFloat('0.' + eccentricityStr)
    const argOfPerigee = parseFloat(line2.substring(34, 42).trim())
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim())
    const meanMotion = parseFloat(line2.substring(52, 63).trim()) // revs per day

    // Calculate semi-major axis from mean motion
    // n = sqrt(μ/a³) where μ = 398600.4418 km³/s² (Earth's gravitational parameter)
    // Period = 1440/meanMotion minutes
    const period_minutes = 1440 / meanMotion
    const period_seconds = period_minutes * 60

    // a³ = μ * (T/(2π))²
    const mu = 398600.4418 // km³/s²
    const semiMajorAxis_km = Math.pow((mu * Math.pow(period_seconds / (2 * Math.PI), 2)), 1/3)

    // Calculate apogee and perigee
    const earthRadius_km = 6378.137
    const perigee_km = semiMajorAxis_km * (1 - eccentricity) - earthRadius_km
    const apogee_km = semiMajorAxis_km * (1 + eccentricity) - earthRadius_km

    return {
      semiMajorAxis_km,
      eccentricity,
      inclination_deg: inclination,
      raan_deg: raan,
      argOfPerigee_deg: argOfPerigee,
      meanAnomaly_deg: meanAnomaly,
      period_minutes,
      apogee_km,
      perigee_km,
      epochYear,
      epochDay
    }
  } catch (error) {
    console.error('Failed to parse TLE:', error)
    return null
  }
}

export function OrbitalElementsPanel({ tle, satelliteName, onClose }: OrbitalElementsPanelProps) {
  if (!tle) {
    return (
      <div className="absolute right-4 top-16 z-50 w-96 bg-background/95 backdrop-blur-sm border-2 border-yellow-500/50 rounded-lg shadow-2xl p-4">
        <div className="text-yellow-500 text-sm">No TLE data available for {satelliteName}</div>
      </div>
    )
  }

  const elements = parseTLE(tle)

  if (!elements) {
    return (
      <div className="absolute right-4 top-16 z-50 w-96 bg-background/95 backdrop-blur-sm border-2 border-red-500/50 rounded-lg shadow-2xl p-4">
        <div className="text-red-500 text-sm">Failed to parse TLE data</div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      className="absolute right-4 top-16 z-50 w-[450px] bg-background/95 backdrop-blur-sm border-2 border-primary/50 rounded-lg shadow-2xl"
    >
      {/* Header */}
      <div className="bg-primary/20 border-b border-primary/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Orbit className="w-5 h-5 text-primary" />
          <div>
            <div className="font-bold text-sm">Classical Orbital Elements</div>
            <div className="text-xs text-muted-foreground">{satelliteName}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Epoch */}
        <div className="pb-3 border-b border-secondary">
          <div className="text-xs text-muted-foreground mb-1">TLE Epoch</div>
          <div className="font-mono text-sm">
            Year {elements.epochYear}, Day {elements.epochDay.toFixed(8)}
          </div>
        </div>

        {/* The 6 Classical Orbital Elements (COEs) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
            <Circle className="w-3 h-3" />
            <span>Six Classical Orbital Elements (COEs)</span>
          </div>

          {/* 1. Semi-major Axis */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-blue-400">1. Semi-major Axis (a)</div>
              <div className="text-xs text-muted-foreground">TLE: Mean Motion → a</div>
            </div>
            <div className="text-2xl font-bold font-mono text-blue-300">
              {elements.semiMajorAxis_km.toFixed(2)} <span className="text-sm text-muted-foreground">km</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Defines orbit size (average radius from Earth's center)
            </div>
          </div>

          {/* 2. Eccentricity */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-green-400">2. Eccentricity (e)</div>
              <div className="text-xs text-muted-foreground">TLE: Line 2, Col 26-33</div>
            </div>
            <div className="text-2xl font-bold font-mono text-green-300">
              {elements.eccentricity.toFixed(7)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Defines orbit shape (0 = circular, {'<'}1 = elliptical)
            </div>
            <div className="text-xs mt-2 grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Perigee:</span>{' '}
                <span className="font-mono">{elements.perigee_km.toFixed(1)} km</span>
              </div>
              <div>
                <span className="text-muted-foreground">Apogee:</span>{' '}
                <span className="font-mono">{elements.apogee_km.toFixed(1)} km</span>
              </div>
            </div>
          </div>

          {/* 3. Inclination */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-purple-400">3. Inclination (i)</div>
              <div className="text-xs text-muted-foreground">TLE: Line 2, Col 8-16</div>
            </div>
            <div className="text-2xl font-bold font-mono text-purple-300">
              {elements.inclination_deg.toFixed(4)}°
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Tilt of orbit plane relative to equator
            </div>
          </div>

          {/* 4. RAAN */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-yellow-400">4. RAAN (Ω)</div>
              <div className="text-xs text-muted-foreground">TLE: Line 2, Col 17-25</div>
            </div>
            <div className="text-2xl font-bold font-mono text-yellow-300">
              {elements.raan_deg.toFixed(4)}°
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Right Ascension of Ascending Node - where orbit crosses equator (south to north)
            </div>
          </div>

          {/* 5. Argument of Perigee */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-orange-400">5. Argument of Perigee (ω)</div>
              <div className="text-xs text-muted-foreground">TLE: Line 2, Col 34-42</div>
            </div>
            <div className="text-2xl font-bold font-mono text-orange-300">
              {elements.argOfPerigee_deg.toFixed(4)}°
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Angle from ascending node to perigee (closest approach point)
            </div>
          </div>

          {/* 6. Mean Anomaly */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold text-red-400">6. Mean Anomaly (M)</div>
              <div className="text-xs text-muted-foreground">TLE: Line 2, Col 43-51</div>
            </div>
            <div className="text-2xl font-bold font-mono text-red-300">
              {elements.meanAnomaly_deg.toFixed(4)}°
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Satellite's position in orbit at epoch (0° at perigee)
            </div>
          </div>
        </div>

        {/* Orbital Period */}
        <div className="pt-3 border-t border-secondary">
          <div className="text-sm font-semibold mb-2 text-primary">Orbital Period</div>
          <div className="text-xl font-mono font-bold">
            {elements.period_minutes.toFixed(2)} <span className="text-sm text-muted-foreground">minutes</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ({(elements.period_minutes / 60).toFixed(2)} hours per orbit)
          </div>
        </div>

        {/* TLE Raw Data */}
        <div className="pt-3 border-t border-secondary">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>Raw TLE Data</span>
          </div>
          <div className="bg-secondary/20 rounded p-2 font-mono text-xs break-all space-y-1">
            <div className="text-muted-foreground">Line 1:</div>
            <div>{tle.line1}</div>
            <div className="text-muted-foreground mt-2">Line 2:</div>
            <div>{tle.line2}</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
