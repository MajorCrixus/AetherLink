/**
 * GPS module configuration and monitoring page
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Satellite, MapPin, Clock, Settings } from 'lucide-react'

import { useTelemetryData } from '@/stores/telemetryStore'

export function GPSModule() {
  const telemetry = useTelemetryData()
  const gpsData = telemetry?.gps

  const moduleConfig = {
    port: '/dev/ttyAMA0',
    baud: 9600,
    protocol: 'NMEA + UBX',
    updateRate: '10 Hz',
    constellation: 'GPS + GLONASS + Galileo',
    dynamicModel: 'Stationary'
  }

  return (
    <div className="h-full p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
              <Satellite className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">GPS Module</h1>
              <p className="text-muted-foreground">u-blox M10-25Q GNSS Receiver</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="font-semibold">Live Data</span>
              </div>
            </div>
            <div className="panel-content space-y-4">
              {gpsData ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Fix Type</label>
                      <div className={`font-mono text-lg ${
                        gpsData.mode === '3D' ? 'text-health-ok' :
                        gpsData.mode === '2D' ? 'text-health-warn' :
                        'text-health-error'
                      }`}>
                        {gpsData.mode}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Satellites</label>
                      <div className="font-mono text-lg">
                        {gpsData.sats || 0}/24
                      </div>
                    </div>
                  </div>

                  {gpsData.lat && gpsData.lon && (
                    <div className="border-t border-secondary pt-4">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Latitude</span>
                          <span className="font-mono">{gpsData.lat.toFixed(6)}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Longitude</span>
                          <span className="font-mono">{gpsData.lon.toFixed(6)}°</span>
                        </div>
                        {gpsData.alt_m && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Altitude</span>
                            <span className="font-mono">{gpsData.alt_m.toFixed(1)}m</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {gpsData.hdop && (
                    <div className="border-t border-secondary pt-4">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">HDOP</span>
                        <span className="font-mono">{gpsData.hdop.toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Satellite className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div>No GPS data available</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="font-semibold">Configuration</span>
              </div>
            </div>
            <div className="panel-content space-y-4">
              {Object.entries(moduleConfig).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-sm font-mono">{value}</span>
                </div>
              ))}

              <div className="border-t border-secondary pt-4">
                <button className="btn btn-primary w-full mb-2">
                  Save Configuration
                </button>
                <button className="btn btn-secondary w-full">
                  Reset to Defaults
                </button>
              </div>
            </div>
          </motion.div>

          {/* Diagnostics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="panel lg:col-span-2"
          >
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">Diagnostics & Tests</span>
              </div>
            </div>
            <div className="panel-content">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="btn btn-secondary">
                  NMEA Stream Test
                </button>
                <button className="btn btn-secondary">
                  Position Accuracy Test
                </button>
                <button className="btn btn-secondary">
                  Time Sync Check
                </button>
                <button className="btn btn-secondary">
                  Antenna Status
                </button>
                <button className="btn btn-secondary">
                  Cold Start Test
                </button>
                <button className="btn btn-secondary">
                  Factory Reset
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}