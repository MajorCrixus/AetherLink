/**
 * 3D Antenna view page with detailed model and controls
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, Home, Minimize2 } from 'lucide-react'

import { Antenna3DModel } from '@/components/antenna/Antenna3DModel'
import { AntennaControls } from '@/components/antenna/AntennaControls'
import { AntennaStatus } from '@/components/antenna/AntennaStatus'

export function AntennaView() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showStatus, setShowStatus] = useState(true)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const resetView = () => {
    // This would reset the camera in the 3D view
    // For now, just a placeholder
  }

  return (
    <div className="h-full flex">
      {/* 3D View */}
      <div className="flex-1 relative bg-gradient-to-br from-background via-background to-background/90">
        {/* 3D Antenna Model */}
        <div className="absolute inset-0">
          <Antenna3DModel />
        </div>

        {/* 3D View Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={toggleFullscreen}
            className="btn btn-secondary p-2"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={resetView}
            className="btn btn-secondary p-2"
            title="Reset View"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Coordinate System Indicator */}
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-3 rounded z-10">
          <div className="text-xs font-mono space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span className="text-red-400">X: East</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span className="text-green-400">Y: Up</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-500"></div>
              <span className="text-blue-400">Z: North</span>
            </div>
          </div>
        </div>

        {/* View Controls Legend */}
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm p-3 rounded text-xs z-10">
          <div className="space-y-1 text-muted-foreground">
            <div>Left Click + Drag: Rotate</div>
            <div>Right Click + Drag: Pan</div>
            <div>Scroll: Zoom</div>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-96 bg-secondary/30 border-l border-secondary overflow-y-auto">
        <div className="p-4 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Toggle between controls and status */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowStatus(false)}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                  !showStatus
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 hover:bg-secondary'
                }`}
              >
                Controls
              </button>
              <button
                onClick={() => setShowStatus(true)}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                  showStatus
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 hover:bg-secondary'
                }`}
              >
                Status
              </button>
            </div>

            {/* Content */}
            {showStatus ? <AntennaStatus /> : <AntennaControls />}
          </motion.div>
        </div>
      </div>
    </div>
  )
}