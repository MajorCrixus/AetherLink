/**
 * Satellite Visualization Control Widget
 * Switch between Digital Arsenal visualization modes
 */

import React, { useState } from 'react'
import { Eye, Radio, Grid3x3, Settings } from 'lucide-react'

import type { VisualizationMode } from '@/services/satelliteVisualization'

interface SatelliteVisualizationWidgetProps {
  mode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
  showOrbits?: boolean
  showLabels?: boolean
  onToggleOrbits?: () => void
  onToggleLabels?: () => void
}

export function SatelliteVisualizationWidget({
  mode,
  onModeChange,
  showOrbits = false,
  showLabels = false,
  onToggleOrbits,
  onToggleLabels,
}: SatelliteVisualizationWidgetProps) {
  const [expanded, setExpanded] = useState(false)

  const modes: Array<{ id: VisualizationMode; label: string; icon: React.ReactNode; description: string }> = [
    {
      id: 'orbit',
      label: 'Orbit Generation',
      icon: <Radio className="w-4 h-4" />,
      description: 'SGP4 propagated orbits from TLEs',
    },
    {
      id: 'los',
      label: 'Line-of-Sight',
      icon: <Eye className="w-4 h-4" />,
      description: 'Visibility from ground station',
    },
    {
      id: 'massive',
      label: 'Massive Set',
      icon: <Grid3x3 className="w-4 h-4" />,
      description: 'Efficient batch rendering',
    },
  ]

  const currentMode = modes.find(m => m.id === mode)

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      {/* Header */}
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          {currentMode?.icon}
          <span className="font-semibold">Visualization</span>

          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto p-1 hover:bg-white/5 rounded transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-3">
        {/* Current Mode */}
        <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded">
          <div className="flex items-center gap-2 mb-1">
            {currentMode?.icon}
            <span className="font-medium text-sm">{currentMode?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {currentMode?.description}
          </div>
        </div>

        {/* Mode Selector */}
        {expanded && (
          <>
            <div className="text-xs text-cyan-400 font-medium">Select Mode</div>
            <div className="space-y-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onModeChange(m.id)
                    setExpanded(false)
                  }}
                  className={`
                    w-full p-2 rounded border transition-all text-left
                    ${mode === m.id
                      ? 'border-cyan-400 bg-cyan-500/20'
                      : 'border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {m.icon}
                    <span className="font-medium text-sm">{m.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Options */}
            <div className="border-t border-cyan-500/30 pt-3 space-y-2">
              <div className="text-xs text-cyan-400 font-medium">Options</div>

              {onToggleOrbits && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Show Orbits</span>
                  <input
                    type="checkbox"
                    checked={showOrbits}
                    onChange={onToggleOrbits}
                    className="w-4 h-4"
                  />
                </label>
              )}

              {onToggleLabels && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Show Labels</span>
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={onToggleLabels}
                    className="w-4 h-4"
                  />
                </label>
              )}
            </div>

            {/* Info */}
            <div className="border-t border-cyan-500/30 pt-3">
              <div className="text-xs text-muted-foreground">
                <div className="font-medium text-cyan-400 mb-1">Digital Arsenal Modes:</div>
                <ul className="space-y-1 pl-4">
                  <li>• <strong>Orbit:</strong> TLE-based propagation</li>
                  <li>• <strong>LOS:</strong> Ground station visibility</li>
                  <li>• <strong>Massive:</strong> Optimized for 1000s of sats</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
