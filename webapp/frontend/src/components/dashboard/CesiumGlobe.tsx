/**
 * CesiumGlobe - Full-featured Cesium globe implementation
 * Replaces Three.js GlobalView with industry-standard Cesium
 *
 * Features:
 * - Native Cesium UI controls (Search, Home, 3D/2D/Columbus, Imagery, Help)
 * - Time-dynamic visualization via native timeline/animation
 * - Terrain and elevation data
 * - Geocoding and search
 * - Satellite tracking (prep for Digital Arsenal)
 */

import React, { useRef, useEffect, useMemo, useState } from 'react'
import {
  Viewer,
  Entity,
  CesiumComponentRef,
  ImageryLayer
} from 'resium'
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Ion,
  OpenStreetMapImageryProvider,
  createWorldTerrainAsync,
  Camera,
  Rectangle,
  defined,
  GeocoderService,
  Credit,
  HeightReference,
  Math as CesiumMath
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { Compass, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

import { useTelemetryData } from '@/stores/telemetryStore'

// Cesium Ion Token - Configured for full imagery and terrain access
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkODk0NWVlZS0xMjcyLTQxNjAtODlhNy01MDc2NTdmNDYzMGQiLCJpZCI6MzU2Mzc2LCJpYXQiOjE3NjIxMTA1MjB9.Cq6y5pY0u5iGtba018uINmfDXDF63VGvtpf9tzbwgxY'

// With Ion token, you now have access to:
// - Bing Maps (aerial/satellite imagery)
// - Sentinel-2 satellite imagery
// - World Terrain for 3D elevation
// - Ion asset streaming

// Custom Nominatim Geocoder Service (free, no token required)
class NominatimGeocoderService implements GeocoderService {
  credit: Credit | undefined = new Credit('OpenStreetMap Nominatim')

  async geocode(query: string): Promise<any[]> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AetherLink-SATCOM-Webapp'
      }
    })

    if (!response.ok) {
      throw new Error('Geocoding request failed')
    }

    const results = await response.json()

    return results.map((result: any) => ({
      displayName: result.display_name,
      destination: Rectangle.fromDegrees(
        parseFloat(result.boundingbox[2]), // west
        parseFloat(result.boundingbox[0]), // south
        parseFloat(result.boundingbox[3]), // east
        parseFloat(result.boundingbox[1])  // north
      )
    }))
  }
}

interface CesiumGlobeProps {
  className?: string
  onViewerReady?: (viewer: CesiumViewer) => void
}

export const CesiumGlobe = React.forwardRef<CesiumViewer | null, CesiumGlobeProps>(
  ({ className = '', onViewerReady }, forwardedRef) => {
  const viewerRef = useRef<CesiumComponentRef<CesiumViewer>>(null)
  const telemetry = useTelemetryData()
  const [showNavWidget, setShowNavWidget] = useState(true)

  // GPS coordinates
  const gsLat = telemetry?.gps?.lat ?? null
  const gsLon = telemetry?.gps?.lon ?? null
  const gsAltM = telemetry?.gps?.alt_m ?? 0

  // Custom geocoder service - memoized to prevent viewer recreation
  const geocoderServices = useMemo(() => [new NominatimGeocoderService()], [])

  // Camera navigation functions
  const flyToView = (heading: number, pitch: number, roll: number = 0) => {
    const viewer = viewerRef.current?.cesiumElement
    if (!viewer) return

    const camera = viewer.camera
    const currentPosition = camera.positionCartographic

    viewer.camera.flyTo({
      destination: Cartesian3.fromRadians(
        currentPosition.longitude,
        currentPosition.latitude,
        20000000 // 20,000 km altitude for good global view
      ),
      orientation: {
        heading: CesiumMath.toRadians(heading),
        pitch: CesiumMath.toRadians(pitch),
        roll: CesiumMath.toRadians(roll)
      },
      duration: 1.5
    })
  }

  const resetToNorth = () => {
    const viewer = viewerRef.current?.cesiumElement
    if (!viewer) return

    // Fly to current position with North up and looking down
    const camera = viewer.camera
    const currentPosition = camera.positionCartographic

    viewer.camera.flyTo({
      destination: Cartesian3.fromRadians(
        currentPosition.longitude,
        currentPosition.latitude,
        currentPosition.height
      ),
      orientation: {
        heading: CesiumMath.toRadians(0), // North
        pitch: CesiumMath.toRadians(-90), // Looking straight down
        roll: CesiumMath.toRadians(0)
      },
      duration: 1.0
    })
  }

  const flyToAntenna = () => {
    const viewer = viewerRef.current?.cesiumElement
    if (!viewer || gsLat === null || gsLon === null) return

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(gsLon, gsLat, 5000), // 5km altitude
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: CesiumMath.toRadians(0)
      },
      duration: 2.0
    })
  }

  // Expose viewer through ref and notify parent when ready
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement
    if (!viewer) return

    // Expose viewer through forwarded ref
    if (typeof forwardedRef === 'function') {
      forwardedRef(viewer)
    } else if (forwardedRef) {
      forwardedRef.current = viewer
    }

    // Notify parent component
    if (onViewerReady) {
      onViewerReady(viewer)
    }

    return () => {
      // Clear ref on unmount
      if (typeof forwardedRef === 'function') {
        forwardedRef(null)
      } else if (forwardedRef) {
        forwardedRef.current = null
      }
    }
  }, [viewerRef.current, forwardedRef, onViewerReady])

  // Configure Cesium clock for realtime animation
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement
    if (!viewer) return

    // Set clock to realtime speed (1.0x)
    // This prevents satellites from blinking due to fast time progression
    viewer.clock.multiplier = 1.0

    // Optionally pause the clock since we're showing static satellite positions
    // Uncomment the next line if you want the timeline paused by default:
    // viewer.clock.shouldAnimate = false
  }, [viewerRef.current])

  // Position Cesium toolbar in the top health bar (next to Dashboard Settings)
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement
    if (!viewer) return

    // Move Cesium toolbar to custom position
    const toolbar = viewer.container.querySelector('.cesium-viewer-toolbar')
    if (toolbar) {
      (toolbar as HTMLElement).style.position = 'fixed'
      ;(toolbar as HTMLElement).style.top = '8px'  // Align with health bar padding
      ;(toolbar as HTMLElement).style.right = '60px' // Left of Dashboard Settings gear icon
      ;(toolbar as HTMLElement).style.display = 'flex'
      ;(toolbar as HTMLElement).style.alignItems = 'center'
      ;(toolbar as HTMLElement).style.gap = '2px'
    }

    // Compact Cesium toolbar buttons to fit in top bar
    const toolbarButtons = viewer.container.querySelectorAll('.cesium-button')
    toolbarButtons.forEach((button) => {
      const btn = button as HTMLElement
      btn.style.width = '28px'
      btn.style.height = '28px'
      btn.style.padding = '4px'
      btn.style.margin = '0'
    })

    // Compact geocoder search box
    const geocoder = viewer.container.querySelector('.cesium-geocoder-input')
    if (geocoder) {
      (geocoder as HTMLElement).style.height = '28px'
      ;(geocoder as HTMLElement).style.fontSize = '12px'
      ;(geocoder as HTMLElement).style.padding = '2px 6px'
    }
  }, [viewerRef.current])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Navigation Widget */}
      {showNavWidget && (
        <div className="absolute bottom-20 left-4 z-50 flex flex-col gap-2">
          {/* Compass Reset Button */}
          <button
            onClick={resetToNorth}
            className="w-12 h-12 bg-background/90 hover:bg-background border-2 border-primary/50 hover:border-primary rounded-lg flex items-center justify-center transition-all shadow-lg"
            title="Reset to North (top-down view)"
          >
            <Compass className="w-6 h-6 text-primary" />
          </button>

          {/* Cardinal Direction Controls */}
          <div className="bg-background/90 border-2 border-secondary rounded-lg p-2 shadow-lg">
            <div className="grid grid-cols-3 gap-1">
              {/* Top Row */}
              <div />
              <button
                onClick={() => flyToView(0, -90)} // Top view (North)
                className="w-8 h-8 bg-secondary/50 hover:bg-primary/20 rounded flex items-center justify-center transition-colors"
                title="Top View (North)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div />

              {/* Middle Row */}
              <button
                onClick={() => flyToView(270, -45)} // West view
                className="w-8 h-8 bg-secondary/50 hover:bg-primary/20 rounded flex items-center justify-center transition-colors"
                title="West View"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={flyToAntenna}
                className="w-8 h-8 bg-primary/30 hover:bg-primary/50 rounded flex items-center justify-center transition-colors"
                title="Fly to Antenna"
                disabled={gsLat === null || gsLon === null}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => flyToView(90, -45)} // East view
                className="w-8 h-8 bg-secondary/50 hover:bg-primary/20 rounded flex items-center justify-center transition-colors"
                title="East View"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Bottom Row */}
              <div />
              <button
                onClick={() => flyToView(180, -45)} // South view
                className="w-8 h-8 bg-secondary/50 hover:bg-primary/20 rounded flex items-center justify-center transition-colors"
                title="South View"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <div />
            </div>
          </div>
        </div>
      )}

      {/* Cesium Viewer with Native Controls */}
      <Viewer
        ref={viewerRef}
        full
        timeline={true}
        animation={true}
        baseLayerPicker={true} // Enabled - Ion token configured above
        geocoder={geocoderServices}
        homeButton={true}
        infoBox={true}
        sceneModePicker={true}
        selectionIndicator={true}
        navigationHelpButton={true}
        fullscreenButton={false}
        vrButton={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
        {/* Antenna Marker */}
        {gsLat !== null && gsLon !== null && (
          <Entity
            name="Antenna"
            position={Cartesian3.fromDegrees(gsLon, gsLat, 0)} // Use 0 for ground level
            point={{
              pixelSize: 10,
              color: Color.LIME,
              outlineColor: Color.WHITE,
              outlineWidth: 2,
              heightReference: HeightReference.CLAMP_TO_GROUND // Clamp to terrain surface
            }}
            label={{
              text: 'ANTENNA',
              font: '14pt sans-serif',
              fillColor: Color.LIME,
              outlineColor: Color.BLACK,
              outlineWidth: 2,
              style: 0, // FILL
              pixelOffset: new Cartesian3(0, -20, 0),
              showBackground: true,
              backgroundColor: Color.BLACK.withAlpha(0.7),
              heightReference: HeightReference.CLAMP_TO_GROUND // Clamp label too
            }}
          />
        )}
      </Viewer>
    </div>
  )
})

CesiumGlobe.displayName = 'CesiumGlobe'
