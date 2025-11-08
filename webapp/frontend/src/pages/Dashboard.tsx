/**
 * Main dashboard with 3D globe and draggable HUD widgets
 */

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Viewer as CesiumViewer } from 'cesium'

// import { GlobalView } from '@/components/dashboard/GlobalView' // DEPRECATED - replaced by Cesium
import { CesiumGlobe } from '@/components/dashboard/CesiumGlobe'
import { DraggableWidgets } from '@/components/dashboard/DraggableWidgets'
import { useTelemetryData, useServosData } from '@/stores/telemetryStore'
import { useSatelliteVisualization } from '@/hooks/useSatelliteVisualization'
import type { VisualizationMode } from '@/services/satelliteVisualization'
import type { SatelliteSummary } from '@/types/satellite'

export function Dashboard() {
  const telemetry = useTelemetryData()
  const servos = useServosData()

  // Cesium viewer ref
  const cesiumViewerRef = useRef<CesiumViewer | null>(null)

  // Satellite visualization state
  const [vizMode, setVizMode] = useState<VisualizationMode>('massive')
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteSummary | null>(null)

  // Initialize satellite visualization with ground station GPS from telemetry
  const satViz = useSatelliteVisualization({
    viewer: cesiumViewerRef.current,
    enabled: true, // Re-enabled after fixing circular dependency infinite loop
    mode: vizMode,
    filters: { limit: 100 },
    groundStationLat: telemetry?.gps?.lat,
    groundStationLon: telemetry?.gps?.lon,
    groundStationAlt: telemetry?.gps?.alt_m,
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
              mode: vizMode,
              onModeChange: setVizMode,
              showOrbits: satViz.showOrbits,
              showLabels: satViz.showLabels,
              onToggleOrbits: satViz.toggleOrbits,
              onToggleLabels: satViz.toggleLabels,
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