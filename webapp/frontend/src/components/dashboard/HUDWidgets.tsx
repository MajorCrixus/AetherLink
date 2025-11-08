/**
 * HUD overlay widgets for the dashboard
 * Drag-and-drop, resizable widgets showing telemetry data
 */

import React from 'react'
import { motion } from 'framer-motion'

import { GPSWidget } from './widgets/GPSWidget'
import { IMUWidget } from './widgets/IMUWidget'
import { ServoWidget } from './widgets/ServoWidget'
import { SystemWidget } from './widgets/SystemWidget'
import { SatelliteWidget } from './widgets/SatelliteWidget'
import { LogsWidget } from './widgets/LogsWidget'

import { useIMUData, useGPSData, useAxesData, useServosData, useTelemetryData } from '@/stores/telemetryStore'

const widgetVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 }
}

export function HUDWidgets() {
  // Use granular selectors to reduce re-renders
  const imu = useIMUData()
  const gps = useGPSData()
  const axes = useAxesData()
  const servos = useServosData()
  const telemetry = useTelemetryData() // Still need for system and satellite

  if (!telemetry) {
    return null
  }

  return (
    <div className="absolute inset-0 p-4 pointer-events-none">
      {/* Top row widgets */}
      <div className="flex justify-between mb-4">
        {/* Left side */}
        <div className="flex gap-4">
          {gps && (
            <motion.div
              variants={widgetVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="pointer-events-auto"
            >
              <GPSWidget data={gps} />
            </motion.div>
          )}

          {imu && (
            <motion.div
              variants={widgetVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="pointer-events-auto"
            >
              <IMUWidget data={imu} axes={axes} />
            </motion.div>
          )}
        </div>

        {/* Right side */}
        <div className="flex gap-4">
          <motion.div
            variants={widgetVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
            className="pointer-events-auto"
          >
            <SystemWidget data={telemetry.system} />
          </motion.div>
        </div>
      </div>

      {/* Middle row widgets */}
      <div className="flex justify-between items-center h-full">
        {/* Left side */}
        <div className="flex flex-col gap-4">
          {servos && (
            <motion.div
              variants={widgetVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
              className="pointer-events-auto"
            >
              <ServoWidget servos={servos} />
            </motion.div>
          )}
        </div>

        {/* Right side */}
        <div className="flex flex-col gap-4">
          <motion.div
            variants={widgetVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.6 }}
            className="pointer-events-auto"
          >
            <SatelliteWidget satellite={telemetry.selected_satellite} />
          </motion.div>
        </div>
      </div>

      {/* Bottom row widgets */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex justify-between">
          <motion.div
            variants={widgetVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.7 }}
            className="pointer-events-auto"
          >
            <LogsWidget />
          </motion.div>

          {/* Quick actions */}
          <motion.div
            variants={widgetVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.8 }}
            className="pointer-events-auto"
          >
            <div className="hud-widget">
              <div className="hud-widget-header">
                <span className="font-semibold">Actions</span>
              </div>
              <div className="hud-widget-content">
                <div className="flex gap-2">
                  <button className="btn btn-danger px-3 py-2 text-sm">
                    EMERGENCY STOP
                  </button>
                  <button className="btn btn-secondary px-3 py-2 text-sm">
                    HOME ALL
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}