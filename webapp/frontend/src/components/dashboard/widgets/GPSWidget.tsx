/**
 * GPS HUD widget displaying fix status, position, and satellite count
 */

import React, { useState, useRef, useEffect } from 'react'
import { Satellite, MapPin, Clock, Menu, X, RotateCcw } from 'lucide-react'

import type { GPSFix } from '@/types/telemetry'
import { formatLatLon, formatAltitude, formatTimestamp } from '@/lib/utils'
import { HealthStatusIcon } from '@/components/health/HealthBar'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'

interface GPSWidgetProps {
  data: GPSFix
  isEditing?: boolean
}

export function GPSWidget({ data, isEditing = false }: GPSWidgetProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const config = useWidgetConfigStore((state) => state.widgets.gps)
  const toggleTimestamp = useWidgetConfigStore((state) => state.toggleTimestamp)
  const toggleCompactMode = useWidgetConfigStore((state) => state.toggleCompactMode)
  const resetWidget = useWidgetConfigStore((state) => state.resetWidget)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const getFixStatusColor = (mode: GPSFix['mode']) => {
    switch (mode) {
      case '3D': return 'text-health-ok'
      case '2D': return 'text-health-warn'
      case 'NO_FIX': return 'text-health-error'
      default: return 'text-health-off'
    }
  }

  const getFixStatus = (mode: GPSFix['mode']) => {
    switch (mode) {
      case '3D': return 'OK'
      case '2D': return 'WARN'
      case 'NO_FIX': return 'ERROR'
      default: return 'OFF'
    }
  }

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      {/* Header with Menu - Drag handle for moving widget */}
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4" />
          <span className="font-semibold">GPS</span>

          {/* Only show hamburger menu when editing */}
          {isEditing && (
            <div className="relative ml-auto" ref={menuRef} style={{ zIndex: 10000 }}>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpen(!menuOpen)
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                }}
                className="p-1 hover:bg-primary/20 rounded transition-colors cursor-pointer relative z-[10001]"
                style={{ pointerEvents: 'auto' }}
                title="Widget settings"
              >
                {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 bg-background border border-primary/30 rounded-lg shadow-lg min-w-[200px]"
                  style={{ zIndex: 10002, pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <div className="py-1">
                    {/* Show/Hide Timestamp */}
                    <button
                      onClick={() => {
                        toggleTimestamp('gps')
                        setMenuOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      <span>{config.showTimestamp ? 'Hide' : 'Show'} Timestamp</span>
                    </button>

                    {/* Compact Mode */}
                    <button
                      onClick={() => {
                        toggleCompactMode('gps')
                        setMenuOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2"
                    >
                      <span>{config.compactMode ? 'Detailed' : 'Compact'} View</span>
                    </button>

                    <div className="border-t border-primary/20 my-1" />

                    {/* Reset Widget */}
                    <button
                      onClick={() => {
                        resetWidget('gps')
                        setMenuOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 text-health-warn"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset to Default</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Widget Content - Scrollable */}
      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden">
        <div className={`space-y-${config.compactMode ? '2' : '3'}`}>
        {/* Status Badge */}
        <div className="flex justify-end -mt-2">
          <HealthStatusIcon status={getFixStatus(data.mode)} />
        </div>

        {/* Fix Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Fix</span>
          <span className={`text-sm font-mono font-medium ${getFixStatusColor(data.mode)}`}>
            {data.mode}
          </span>
        </div>

        {/* Satellite Count */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Satellites</span>
          <span className="text-sm font-mono">
            {data.sats || 0}/24
          </span>
        </div>

        {/* Accuracy */}
        {data.hdop && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">HDOP</span>
            <span className="text-sm font-mono">
              {data.hdop.toFixed(1)}
            </span>
          </div>
        )}

        {/* Position */}
        {data.lat && data.lon && (
          <>
            <div className="border-t border-primary/20 pt-3">
              <div className="flex items-center gap-1 mb-2">
                <MapPin className="w-3 h-3" />
                <span className="text-xs text-muted-foreground">Position</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Lat</span>
                  <span className="text-xs font-mono">
                    {formatLatLon(data.lat)}°
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Lon</span>
                  <span className="text-xs font-mono">
                    {formatLatLon(data.lon)}°
                  </span>
                </div>
                {data.alt_m && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Alt</span>
                    <span className="text-xs font-mono">
                      {formatAltitude(data.alt_m)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Motion */}
        {!config.compactMode && (data.speed_mps != null || data.course_deg != null) && (
          <div className="border-t border-primary/20 pt-3">
            <div className="space-y-1">
              {data.speed_mps != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Speed</span>
                  <span className="text-xs font-mono">
                    {data.speed_mps.toFixed(2)} m/s
                  </span>
                </div>
              )}
              {data.course_deg != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Course</span>
                  <span className="text-xs font-mono">
                    {data.course_deg.toFixed(1)}°
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timestamp */}
        {config.showTimestamp && (
          <div className="border-t border-primary/20 pt-2">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(data.ts)}
              </span>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
