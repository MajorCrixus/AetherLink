/**
 * Main dashboard with 3D globe and draggable HUD widgets
 */

import React, { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Viewer as CesiumViewer } from 'cesium'
import { Settings } from 'lucide-react'

// import { GlobalView } from '@/components/dashboard/GlobalView' // DEPRECATED - replaced by Cesium
import { CesiumGlobe } from '@/components/dashboard/CesiumGlobe'
import { DraggableWidgets } from '@/components/dashboard/DraggableWidgets'
import { useTelemetryData, useServosData } from '@/stores/telemetryStore'
import { useSatelliteVisualization } from '@/hooks/useSatelliteVisualization'
import { useSatelliteFilters, useVisualizationSettings, useDashboardSettingsStore } from '@/stores/dashboardSettingsStore'
import type { VisualizationMode } from '@/services/satelliteVisualization'
import type { SatelliteSummary } from '@/types/satellite'

export function Dashboard() {
  const navigate = useNavigate()
  const telemetry = useTelemetryData()
  const servos = useServosData()

  // Cesium viewer ref
  const cesiumViewerRef = useRef<CesiumViewer | null>(null)

  // Get settings from store
  const filters = useSatelliteFilters()
  const vizSettings = useVisualizationSettings()
  const updateVisualization = useDashboardSettingsStore((state) => state.updateVisualization)
  const updateFilters = useDashboardSettingsStore((state) => state.updateFilters)

  // Local UI state
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteSummary | null>(null)

  // Memoize GPS coordinates to prevent unnecessary re-renders on minor updates
  // Only update if coordinates change by more than 0.0001 degrees (~11m)
  const [stableGPS, setStableGPS] = useState({
    lat: telemetry?.gps?.lat,
    lon: telemetry?.gps?.lon,
    alt: telemetry?.gps?.alt_m,
  })

  React.useEffect(() => {
    const newLat = telemetry?.gps?.lat
    const newLon = telemetry?.gps?.lon
    const newAlt = telemetry?.gps?.alt_m

    // Only update if coordinates changed significantly (more than ~11 meters)
    const latChanged = Math.abs((newLat || 0) - (stableGPS.lat || 0)) > 0.0001
    const lonChanged = Math.abs((newLon || 0) - (stableGPS.lon || 0)) > 0.0001
    const altChanged = Math.abs((newAlt || 0) - (stableGPS.alt || 0)) > 10 // 10 meters

    if (latChanged || lonChanged || altChanged) {
      setStableGPS({ lat: newLat, lon: newLon, alt: newAlt })
    }
  }, [telemetry?.gps?.lat, telemetry?.gps?.lon, telemetry?.gps?.alt_m, stableGPS])

  // Initialize satellite visualization with ground station GPS from telemetry
  const satViz = useSatelliteVisualization({
    viewer: cesiumViewerRef.current,
    enabled: true, // Re-enabled after fixing circular dependency infinite loop
    mode: vizSettings.mode,
    filters: filters, // Use filters from settings store
    groundStationLat: stableGPS.lat,
    groundStationLon: stableGPS.lon,
    groundStationAlt: stableGPS.alt,
  })

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-background to-background/90">
      {/* Hero Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Cesium Globe View - Lower layer (z-0) */}
        <div className="absolute inset-0 z-0">
          <CesiumGlobe ref={cesiumViewerRef} />
        </div>

        {/* Draggable HUD Widgets - Upper layer (z-10) */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <DraggableWidgets
            satelliteVisualization={{
              mode: vizSettings.mode,
              onModeChange: (mode) => updateVisualization({ mode }),
              showOrbits: vizSettings.showOrbits,
              showLabels: vizSettings.labelMode !== 'never',
              onToggleOrbits: () => updateVisualization({ showOrbits: !vizSettings.showOrbits }),
              onToggleLabels: () => updateVisualization({ labelMode: vizSettings.labelMode === 'never' ? 'select' : 'never' }),
              satelliteLimit: filters.limit || 2000,
              onSatelliteLimitChange: (limit) => updateFilters({ limit }),
              onSelectSatellite: (sat: SatelliteSummary) => {
                setSelectedSatellite(sat)
                satViz.highlightSatellite(sat.norad_id)
                satViz.flyToSatellite(sat.norad_id)
              },
              selectedSatellite: selectedSatellite,
              satellites: satViz.satellites,
              loading: satViz.loading,
              error: satViz.error,
            }}
          />
        </div>

        {/* Floating Settings Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/dashboard/settings')}
          className="absolute bottom-6 right-6 z-20 p-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg pointer-events-auto transition-colors"
          title="Dashboard Settings"
        >
          <Settings className="w-6 h-6" />
        </motion.button>

        {/* Loading State */}
        {!telemetry && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="loading-spinner w-8 h-8 mx-auto mb-4" />
              <div className="text-lg font-medium">Connecting to AetherLink...</div>
              <div className="text-sm text-muted-foreground">
                Initializing telemetry stream
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}