/**
 * Selected satellite info widget
 */

import React from 'react'
import { Satellite, Clock, TrendingUp } from 'lucide-react'

import type { SatelliteSummary } from '@/types/telemetry'
import { formatAngle, formatTimestamp } from '@/lib/utils'

interface SatelliteWidgetProps {
  satellite?: SatelliteSummary
}

export function SatelliteWidget({ satellite }: SatelliteWidgetProps) {
  if (!satellite) {
    return (
      <div className="hud-widget h-full w-full flex flex-col">
        <div className="hud-widget-header flex-shrink-0">
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4" />
            <span className="font-semibold">Satellite</span>
          </div>
        </div>
        <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden">
          <div className="text-center text-muted-foreground py-4">
            <Satellite className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No satellite selected</div>
            <div className="text-xs">Click on globe to select</div>
          </div>
        </div>
      </div>
    )
  }

  const getOrbitColor = (orbit: string) => {
    switch (orbit) {
      case 'LEO': return 'text-red-400'
      case 'MEO': return 'text-blue-400'
      case 'HEO': return 'text-purple-400'
      case 'GEO': return 'text-green-400'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4" />
          <span className="font-semibold">Satellite</span>
          <div className="ml-auto">
            <span className={`text-xs px-2 py-1 rounded ${getOrbitColor(satellite.orbit)}`}>
              {satellite.orbit}
            </span>
          </div>
        </div>
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-3">
        {/* Satellite Name */}
        <div>
          <div className="font-medium text-sm truncate">{satellite.name}</div>
          <div className="text-xs text-muted-foreground">
            NORAD: {satellite.norad_id}
          </div>
        </div>

        {/* Current Elevation */}
        {satellite.el_now_deg !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-sm text-muted-foreground">Elevation</span>
            </div>
            <span className={`text-sm font-mono ${
              satellite.el_now_deg > 0 ? 'text-health-ok' : 'text-muted-foreground'
            }`}>
              {formatAngle(satellite.el_now_deg)}
            </span>
          </div>
        )}

        {/* Next Pass */}
        {satellite.next_pass && (
          <div className="border-t border-primary/20 pt-3">
            <div className="flex items-center gap-1 mb-2">
              <Clock className="w-3 h-3" />
              <span className="text-xs text-muted-foreground">Next Pass</span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AOS</span>
                <span className="font-mono">
                  {formatTimestamp(satellite.next_pass.aos)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">LOS</span>
                <span className="font-mono">
                  {formatTimestamp(satellite.next_pass.los)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Max El</span>
                <span className="font-mono">
                  {formatAngle(satellite.next_pass.max_elevation_deg)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Frequency Bands */}
        {satellite.band && satellite.band.length > 0 && (
          <div className="border-t border-primary/20 pt-3">
            <div className="text-xs text-muted-foreground mb-1">Bands</div>
            <div className="flex flex-wrap gap-1">
              {satellite.band.map((band, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-primary/20 text-primary text-xs rounded"
                >
                  {band}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-primary/20 pt-3">
          <button className="btn btn-primary w-full text-sm">
            Track Satellite
          </button>
        </div>
      </div>
    </div>
  )
}