/**
 * System status widget showing CPU, memory, disk, and temperature
 */

import React from 'react'
import { Cpu, HardDrive, Thermometer } from 'lucide-react'

import type { SystemState } from '@/types/telemetry'
import { formatPercentage, formatTemperature, formatTimestamp } from '@/lib/utils'
import { useWidgetConfigStore } from '@/stores/widgetConfigStore'
import { WidgetMenu, WidgetMenuItem } from './WidgetMenu'

interface SystemWidgetProps {
  data: SystemState
}

function ProgressBar({ value, max = 100, color = 'primary' }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min(100, (value / max) * 100)

  const getColor = () => {
    if (percentage > 90) return 'bg-health-error'
    if (percentage > 70) return 'bg-health-warn'
    return 'bg-health-ok'
  }

  return (
    <div className="w-full bg-secondary/30 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${getColor()}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export function SystemWidget({ data }: SystemWidgetProps) {
  const setCustomSetting = useWidgetConfigStore((state) => state.setCustomSetting)
  const customSettings = useWidgetConfigStore((state) => state.widgets.system.customSettings || {})

  // Menu options with defaults
  const showProgressBars = customSettings.showProgressBars ?? true
  const showTemperatures = customSettings.showTemperatures ?? true
  const showCPU = customSettings.showCPU ?? true
  const showMemory = customSettings.showMemory ?? true
  const showDisk = customSettings.showDisk ?? true
  const showGPU = customSettings.showGPU ?? true
  const showPercentageValues = customSettings.showPercentageValues ?? true

  const getStatusColor = (value: number, threshold1: number, threshold2: number) => {
    if (value > threshold2) return 'text-health-error'
    if (value > threshold1) return 'text-health-warn'
    return 'text-health-ok'
  }

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span className="font-semibold">System</span>
          </div>
          <WidgetMenu>
            <div className="text-[10px] text-muted-foreground px-1.5 py-1 font-semibold">Display Options</div>
            <WidgetMenuItem
              label="Show Progress Bars"
              checked={showProgressBars}
              onChange={(c) => setCustomSetting('system', 'showProgressBars', c)}
            />
            <WidgetMenuItem
              label="Show Percentages"
              checked={showPercentageValues}
              onChange={(c) => setCustomSetting('system', 'showPercentageValues', c)}
            />
            <WidgetMenuItem
              label="Show Temperatures"
              checked={showTemperatures}
              onChange={(c) => setCustomSetting('system', 'showTemperatures', c)}
            />
            <div className="border-t border-white/10 my-1" />
            <div className="text-[10px] text-muted-foreground px-1.5 py-1 font-semibold">Metrics</div>
            <WidgetMenuItem
              label="Show CPU"
              checked={showCPU}
              onChange={(c) => setCustomSetting('system', 'showCPU', c)}
            />
            <WidgetMenuItem
              label="Show Memory"
              checked={showMemory}
              onChange={(c) => setCustomSetting('system', 'showMemory', c)}
            />
            <WidgetMenuItem
              label="Show Disk"
              checked={showDisk}
              onChange={(c) => setCustomSetting('system', 'showDisk', c)}
            />
            <WidgetMenuItem
              label="Show GPU"
              checked={showGPU}
              onChange={(c) => setCustomSetting('system', 'showGPU', c)}
            />
          </WidgetMenu>
        </div>
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-3">
        {/* CPU Usage */}
        {showCPU && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">CPU</span>
              {showPercentageValues && (
                <span className={`text-sm font-mono ${getStatusColor(data.cpu, 70, 90)}`}>
                  {formatPercentage(data.cpu)}
                </span>
              )}
            </div>
            {showProgressBars && <ProgressBar value={data.cpu} />}
          </div>
        )}

        {/* Memory Usage */}
        {showMemory && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Memory</span>
              {showPercentageValues && (
                <span className={`text-sm font-mono ${getStatusColor(data.mem, 80, 95)}`}>
                  {formatPercentage(data.mem)}
                </span>
              )}
            </div>
            {showProgressBars && <ProgressBar value={data.mem} />}
          </div>
        )}

        {/* Disk Usage */}
        {showDisk && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                <span className="text-sm text-muted-foreground">Disk</span>
              </div>
              {showPercentageValues && (
                <span className={`text-sm font-mono ${getStatusColor(data.disk, 85, 95)}`}>
                  {formatPercentage(data.disk)}
                </span>
              )}
            </div>
            {showProgressBars && <ProgressBar value={data.disk} />}
          </div>
        )}

        {/* GPU Usage (if available) */}
        {showGPU && data.gpu > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">GPU</span>
              {showPercentageValues && (
                <span className={`text-sm font-mono ${getStatusColor(data.gpu, 70, 90)}`}>
                  {formatPercentage(data.gpu)}
                </span>
              )}
            </div>
            {showProgressBars && <ProgressBar value={data.gpu} />}
          </div>
        )}

        {/* Temperatures */}
        {showTemperatures && Object.keys(data.temps).length > 0 && (
          <div className="border-t border-primary/20 pt-3">
            <div className="flex items-center gap-1 mb-2">
              <Thermometer className="w-3 h-3" />
              <span className="text-xs text-muted-foreground">Temperatures</span>
            </div>
            <div className="space-y-1">
              {Object.entries(data.temps).map(([sensor, temp]) => (
                temp !== undefined && (
                  <div key={sensor} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground capitalize">
                      {sensor}
                    </span>
                    <span className={`text-xs font-mono ${
                      temp > 80 ? 'text-health-error' :
                      temp > 70 ? 'text-health-warn' :
                      'text-health-ok'
                    }`}>
                      {formatTemperature(temp)}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className="border-t border-primary/20 pt-2">
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(data.ts)}
          </span>
        </div>
      </div>
    </div>
  )
}