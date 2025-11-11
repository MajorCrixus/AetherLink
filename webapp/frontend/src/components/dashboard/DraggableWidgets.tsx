/**
 * Draggable and resizable widget grid with localStorage persistence
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import { Lock, Unlock, Eye, EyeOff, Settings, RotateCcw, ChevronLeft } from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { GPSWidget } from './widgets/GPSWidget'
import { IMUWidget } from './widgets/IMUWidget'
import { AxesWidget } from './widgets/AxesWidget'
import { ServoWidget } from './widgets/ServoWidget'
import { SystemWidget } from './widgets/SystemWidget'
import { SatelliteWidget } from './widgets/SatelliteWidget'
import { LogsWidget } from './widgets/LogsWidget'
import { SatelliteCatalogWidget } from './widgets/SatelliteCatalogWidget'
import { SatelliteVisualizationWidget } from './widgets/SatelliteVisualizationWidget'

import { useIMUData, useGPSData, useAxesData, useServosData, useTelemetryData } from '@/stores/telemetryStore'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import type { SatelliteSummary } from '@/types/satellite'
import type { VisualizationMode } from '@/services/satelliteVisualization'

// Default layout configuration (100-column grid for pixel-precise positioning)
// Widgets positioned around edges to leave center open for GlobalView interaction
const DEFAULT_LAYOUT: Layout[] = [
  { i: 'gps', x: 0, y: 0, w: 20, h: 3, minW: 15, minH: 2 },        // Top-left
  { i: 'imu', x: 0, y: 3, w: 20, h: 3, minW: 15, minH: 2 },        // Left side
  { i: 'system', x: 80, y: 0, w: 20, h: 2, minW: 15, minH: 2 },    // Top-right
  { i: 'axes', x: 0, y: 6, w: 20, h: 3, minW: 15, minH: 2 },       // Bottom-left
  { i: 'servos', x: 80, y: 2, w: 20, h: 3, minW: 15, minH: 2 },    // Right side
  { i: 'satellite', x: 80, y: 5, w: 20, h: 3, minW: 15, minH: 2 }, // Bottom-right
  { i: 'logs', x: 25, y: 9, w: 50, h: 2, minW: 20, minH: 2 },      // Bottom center
  { i: 'actions', x: 80, y: 8, w: 20, h: 1, minW: 15, minH: 1 },   // Bottom-right edge
  { i: 'satcat', x: 0, y: 9, w: 24, h: 4, minW: 20, minH: 3 },     // Bottom-left (satellite catalog)
  { i: 'satvis', x: 76, y: 9, w: 24, h: 2, minW: 15, minH: 2 }     // Bottom-right (visualization controls)
]

const STORAGE_KEY = 'aetherlink-dashboard-layout'
const LOCK_KEY = 'aetherlink-dashboard-locked'

type MenuState = 'closed' | 'settings' | 'visibility'

interface SatelliteVisualizationProps {
  mode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
  showOrbits: boolean
  showLabels: boolean
  onToggleOrbits: () => void
  onToggleLabels: () => void
  satelliteLimit: number
  onSatelliteLimitChange: (limit: number) => void
  onSelectSatellite: (satellite: SatelliteSummary) => void
  selectedSatellite: SatelliteSummary | null
  satellites: SatelliteSummary[]
  loading: boolean
  error: string | null
}

interface DraggableWidgetsProps {
  satelliteVisualization?: SatelliteVisualizationProps
}

export function DraggableWidgets({ satelliteVisualization }: DraggableWidgetsProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [menuState, setMenuState] = useState<MenuState>('closed')
  const settingsMenuRef = useRef<HTMLDivElement>(null)

  const [layout, setLayout] = useState<Layout[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const savedLayout = JSON.parse(saved)
        // Merge saved layout with DEFAULT_LAYOUT to add any new widgets
        const savedWidgetIds = new Set(savedLayout.map((item: Layout) => item.i))
        const missingWidgets = DEFAULT_LAYOUT.filter(item => !savedWidgetIds.has(item.i))
        return [...savedLayout, ...missingWidgets]
      } catch (e) {
        console.error('Failed to parse saved layout, using default', e)
      }
    }
    return DEFAULT_LAYOUT
  })

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const saved = localStorage.getItem(LOCK_KEY)
    return saved ? JSON.parse(saved) : false // Default to unlocked for easier editing
  })

  // Get telemetry data
  const imu = useIMUData()
  const gps = useGPSData()
  const axes = useAxesData()
  const servos = useServosData()
  const telemetry = useTelemetryData()

  // Get widget visibility configuration
  const widgetConfig = useWidgetConfigStore((state) => state.widgets)
  const toggleWidgetVisibility = useWidgetConfigStore((state) => state.toggleWidgetVisibility)

  // Measure container width for responsive grid - responds to sidebar toggle
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width - 32 // Account for padding
        setContainerWidth(width)
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setMenuState('closed')
      }
    }

    if (menuState !== 'closed') {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuState])

  // Save layout to localStorage when it changes
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
  }, [])

  // Toggle lock state
  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const newValue = !prev
      localStorage.setItem(LOCK_KEY, JSON.stringify(newValue))
      return newValue
    })
  }, [])

  // Reset to default layout
  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LAYOUT))
  }, [])

  // Handle widget resize requests from minimize/maximize buttons
  useEffect(() => {
    const handleResizeWidget = (event: any) => {
      const { widgetId, w, h } = event.detail
      setLayout((currentLayout) => {
        const newLayout = currentLayout.map((item) => {
          if (item.i === widgetId) {
            return { ...item, w, h }
          }
          return item
        })
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
        return newLayout
      })
    }

    window.addEventListener('resize-widget', handleResizeWidget)
    return () => window.removeEventListener('resize-widget', handleResizeWidget)
  }, [])

  if (!telemetry) {
    return null
  }

  return (
    <>
      {/* Settings Gear Icon - Fixed to HealthBar area */}
      <div ref={settingsMenuRef} className="fixed top-2 right-4 z-[100]" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={() => setMenuState(menuState === 'closed' ? 'settings' : 'closed')}
          className={`p-1.5 rounded-md transition-colors ${
            menuState !== 'closed'
              ? 'bg-primary/20 text-primary'
              : 'hover:bg-primary/10 text-muted-foreground hover:text-foreground'
          }`}
          title="Dashboard Settings"
        >
          <Settings className={`w-4 h-4 ${menuState !== 'closed' ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
        </button>

        {/* Settings Menu */}
        {menuState === 'settings' && (
          <div className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur-sm border border-primary/30 rounded-lg shadow-lg min-w-[220px] z-[110]">
            <div className="p-2">
              <div className="text-sm font-semibold mb-2 px-3 py-2 border-b border-primary/20">
                Dashboard Settings
              </div>

              {/* Lock/Unlock */}
              <button
                onClick={() => {
                  toggleLock()
                  setMenuState('closed')
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 rounded flex items-center gap-3"
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{isLocked ? 'Unlock Layout' : 'Lock Layout'}</span>
              </button>

              {/* Widget Visibility Toggle */}
              {!isLocked && (
                <button
                  onClick={() => setMenuState('visibility')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 rounded flex items-center gap-3"
                >
                  <Eye className="w-4 h-4" />
                  <span>Show/Hide Widgets</span>
                </button>
              )}

              {/* Reset Layout */}
              {!isLocked && (
                <button
                  onClick={() => {
                    resetLayout()
                    setMenuState('closed')
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 rounded flex items-center gap-3"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Layout</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Widget Visibility Submenu */}
        {menuState === 'visibility' && (
          <div className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur-sm border border-primary/30 rounded-lg shadow-lg min-w-[220px] z-[110]">
            <div className="p-2">
              {/* Header with back button */}
              <div className="flex items-center gap-2 mb-2 px-3 py-2 border-b border-primary/20">
                <button
                  onClick={() => setMenuState('settings')}
                  className="p-1 hover:bg-primary/10 rounded transition-colors"
                  title="Back to Settings"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-sm font-semibold">Show/Hide Widgets</div>
              </div>

              {/* Widget toggles */}
              {Object.entries(widgetConfig).map(([widgetId, config]) => (
                <button
                  key={widgetId}
                  onClick={() => toggleWidgetVisibility(widgetId as any)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 rounded flex items-center gap-2"
                >
                  {config.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span className="capitalize">{widgetId}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div ref={containerRef} className="absolute inset-0" style={{ pointerEvents: 'none' }}>

      {/* Grid Layout */}
      <GridLayout
        className="layout"
        layout={layout}
        cols={100}
        rowHeight={40}
        width={containerWidth}
        isDraggable={!isLocked}
        isResizable={!isLocked}
        onLayoutChange={handleLayoutChange}
        compactType={null}
        preventCollision={false}
        allowOverlap={true}
        margin={[8, 8]}
        containerPadding={[16, 16]}
        useCSSTransforms={true}
        style={{ height: '100%' }}
        draggableHandle=".hud-widget-header"
        resizeHandles={['se']}
      >
        {/* GPS Widget */}
        {gps && (
          <div key="gps" style={{ display: widgetConfig.gps.visible ? 'block' : 'none' }}>
            <GPSWidget data={gps} isEditing={!isLocked} />
          </div>
        )}

        {/* IMU Widget */}
        {imu && (
          <div key="imu" style={{ display: widgetConfig.imu.visible ? 'block' : 'none' }}>
            <IMUWidget data={imu} />
          </div>
        )}

        {/* System Widget */}
        <div key="system" style={{ display: widgetConfig.system.visible ? 'block' : 'none' }}>
          <SystemWidget data={telemetry.system} />
        </div>

        {/* Axes Widget */}
        {axes && (
          <div key="axes" style={{ display: widgetConfig.axes.visible ? 'block' : 'none' }}>
            <AxesWidget axes={axes} limits={telemetry.limits} imu={telemetry.imu} servos={telemetry.servos} />
          </div>
        )}

        {/* Servos Widget */}
        {servos && (
          <div key="servos" style={{ display: widgetConfig.servos.visible ? 'block' : 'none' }}>
            <ServoWidget servos={servos} />
          </div>
        )}

        {/* Satellite Widget */}
        <div key="satellite" style={{ display: widgetConfig.satellite.visible ? 'block' : 'none' }}>
          <SatelliteWidget satellite={telemetry.selected_satellite} />
        </div>

        {/* Logs Widget */}
        <div key="logs" style={{ display: widgetConfig.logs.visible ? 'block' : 'none' }}>
          <LogsWidget />
        </div>

        {/* Quick Actions */}
        <div key="actions" className="hud-widget h-full flex flex-col" style={{ display: widgetConfig.actions.visible ? 'block' : 'none' }}>
          <div className="hud-widget-header">
            <span className="font-semibold">Actions</span>
          </div>
          <div className="hud-widget-content flex-1 flex items-center justify-center gap-2">
            <button className="btn btn-danger px-4 py-2 text-sm">
              EMERGENCY STOP
            </button>
            <button className="btn btn-secondary px-4 py-2 text-sm">
              HOME ALL
            </button>
          </div>
        </div>

        {/* Satellite Catalog Widget */}
        {satelliteVisualization && (
          <div key="satcat" style={{ display: widgetConfig.satcat.visible ? 'block' : 'none' }}>
            <SatelliteCatalogWidget
              isEditing={!isLocked}
              onSelectSatellite={satelliteVisualization.onSelectSatellite}
            />
          </div>
        )}

        {/* Satellite Visualization Widget */}
        {satelliteVisualization && (
          <div key="satvis" style={{ display: widgetConfig.satvis.visible ? 'block' : 'none' }}>
            <SatelliteVisualizationWidget
              mode={satelliteVisualization.mode}
              onModeChange={satelliteVisualization.onModeChange}
              showOrbits={satelliteVisualization.showOrbits}
              showLabels={satelliteVisualization.showLabels}
              onToggleOrbits={satelliteVisualization.onToggleOrbits}
              onToggleLabels={satelliteVisualization.onToggleLabels}
              satelliteLimit={satelliteVisualization.satelliteLimit}
              onSatelliteLimitChange={satelliteVisualization.onSatelliteLimitChange}
            />
          </div>
        )}
      </GridLayout>

        {/* Instructions overlay when unlocked */}
        {!isLocked && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary/90 backdrop-blur-sm rounded-lg px-4 py-2 text-sm font-medium pointer-events-none z-50">
            Drag widgets to reposition • Drag corners to resize • Click gear icon to lock
          </div>
        )}
      </div>
    </>
  )
}
