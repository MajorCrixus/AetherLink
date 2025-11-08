/**
 * useSatelliteVisualization Hook
 *
 * Manages satellite visualization on Cesium globe
 * Integrates with satcat-backend API and Digital Arsenal modes
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Viewer as CesiumViewer } from 'cesium'

import {
  SatelliteVisualizationService,
  type VisualizationMode,
  type VisualizationConfig,
} from '@/services/satelliteVisualization'
import { fetchSatellites, type SatelliteFilters } from '@/services/satelliteApi'
import type { SatelliteSummary } from '@/types/satellite'

interface UseSatelliteVisualizationOptions {
  viewer: CesiumViewer | null
  enabled?: boolean
  mode?: VisualizationMode
  filters?: SatelliteFilters
  groundStationLat?: number
  groundStationLon?: number
  groundStationAlt?: number
}

export function useSatelliteVisualization({
  viewer,
  enabled = true,
  mode = 'massive',
  filters = { limit: 100 },
  groundStationLat,
  groundStationLon,
  groundStationAlt,
}: UseSatelliteVisualizationOptions) {
  const serviceRef = useRef<SatelliteVisualizationService | null>(null)
  const prevModeRef = useRef<VisualizationMode>(mode)
  const [satellites, setSatellites] = useState<SatelliteSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOrbits, setShowOrbits] = useState(false)
  const [showLabels, setShowLabels] = useState(false)

  // Stable filters reference to prevent infinite loops
  const stableFilters = useMemo(() => filters, [JSON.stringify(filters)])

  // Initialize visualization service
  useEffect(() => {
    if (!viewer || !enabled) {
      if (serviceRef.current) {
        serviceRef.current.dispose()
        serviceRef.current = null
      }
      return
    }

    const config: VisualizationConfig = {
      mode,
      groundStationLat,
      groundStationLon,
      groundStationAlt,
      showOrbits,
      showLabels,
    }

    if (!serviceRef.current) {
      serviceRef.current = new SatelliteVisualizationService(viewer, config)
    } else {
      serviceRef.current.updateConfig(config)
    }

    return () => {
      if (serviceRef.current) {
        serviceRef.current.dispose()
        serviceRef.current = null
      }
    }
  }, [viewer, enabled, mode, groundStationLat, groundStationLon, groundStationAlt, showOrbits, showLabels])

  // Load satellites from API
  const loadSatellites = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)
      const data = await fetchSatellites(stableFilters)
      setSatellites(data)

      // Add to visualization
      if (serviceRef.current) {
        await serviceRef.current.addSatellites(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load satellites')
    } finally {
      setLoading(false)
    }
  }, [enabled, stableFilters])

  // Load satellites when loadSatellites function changes (which happens when enabled or stableFilters change)
  useEffect(() => {
    loadSatellites()
  }, [loadSatellites]) // Safe now because loadSatellites uses stableFilters

  // Reload visualization when mode changes (not when satellites change)
  useEffect(() => {
    if (mode !== prevModeRef.current && satellites.length > 0 && serviceRef.current) {
      serviceRef.current.clearAll()
      serviceRef.current.addSatellites(satellites)
      prevModeRef.current = mode
    }
  }, [mode]) // Only depend on mode, use ref to avoid re-running on satellites change

  // Highlight satellite
  const highlightSatellite = useCallback((noradId: number) => {
    serviceRef.current?.highlightSatellite(noradId)
  }, [])

  // Unhighlight satellite
  const unhighlightSatellite = useCallback((noradId: number) => {
    serviceRef.current?.unhighlightSatellite(noradId)
  }, [])

  // Fly to satellite
  const flyToSatellite = useCallback((noradId: number) => {
    serviceRef.current?.flyToSatellite(noradId)
  }, [])

  // Toggle options
  const toggleOrbits = useCallback(() => {
    setShowOrbits(prev => !prev)
  }, [])

  const toggleLabels = useCallback(() => {
    setShowLabels(prev => !prev)
  }, [])

  return {
    satellites,
    loading,
    error,
    showOrbits,
    showLabels,
    highlightSatellite,
    unhighlightSatellite,
    flyToSatellite,
    toggleOrbits,
    toggleLabels,
    reload: loadSatellites,
  }
}
