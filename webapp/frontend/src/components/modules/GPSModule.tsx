/**
 * GPS module configuration and monitoring page
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Satellite, MapPin, Clock, Settings, Navigation2 } from 'lucide-react'

import { useTelemetryData } from '@/stores/telemetryStore'

export function GPSModule() {
  const telemetry = useTelemetryData()
  const gpsData = telemetry?.gps

  // Manual coordinate override
  const [useManual, setUseManual] = React.useState(() => {
    const saved = localStorage.getItem('aetherlink-gps-manual-mode')
    return saved === 'true'
  })
  const [manualLat, setManualLat] = React.useState(() => {
    const saved = localStorage.getItem('aetherlink-gps-manual-lat')
    return saved || '0'
  })
  const [manualLon, setManualLon] = React.useState(() => {
    const saved = localStorage.getItem('aetherlink-gps-manual-lon')
    return saved || '0'
  })
  const [manualAlt, setManualAlt] = React.useState(() => {
    const saved = localStorage.getItem('aetherlink-gps-manual-alt')
    return saved || '0'
  })

  // Course/heading offset
  const [headingOffset, setHeadingOffset] = React.useState(() => {
    const saved = localStorage.getItem('aetherlink-gps-heading-offset')
    return saved || '0'
  })

  const handleToggleManual = () => {
    const newValue = !useManual
    setUseManual(newValue)
    localStorage.setItem('aetherlink-gps-manual-mode', String(newValue))
  }

  const handleSaveManualCoords = () => {
    localStorage.setItem('aetherlink-gps-manual-lat', manualLat)
    localStorage.setItem('aetherlink-gps-manual-lon', manualLon)
    localStorage.setItem('aetherlink-gps-manual-alt', manualAlt)
    // TODO: Send to backend to update ground station location
  }

  const handleSaveHeadingOffset = () => {
    localStorage.setItem('aetherlink-gps-heading-offset', headingOffset)
    // TODO: Send to backend to update heading offset
  }

  // Apply heading offset to displayed course
  const displayCourse = gpsData?.course_deg !== undefined && gpsData?.course_deg !== null
    ? (gpsData.course_deg + parseFloat(headingOffset || '0')) % 360
    : null

  const moduleConfig = {
    model: 'GlobalSat BU-353N',
    chipset: 'SiRF Star IV',
    port: '/dev/gps',
    baud: 4800,
    protocol: 'NMEA 0183',
    sentences: 'GGA, RMC, GSA, GSV, GLL, VTG',
    interface: 'USB Serial'
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
              <p className="text-muted-foreground">GlobalSat BU-353N USB GPS Receiver</p>
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
                        {gpsData.sats || 0}
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
                        {gpsData.alt_m !== undefined && gpsData.alt_m !== null && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Altitude</span>
                            <span className="font-mono">{gpsData.alt_m.toFixed(1)}m</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(gpsData.speed_mps !== undefined || gpsData.course_deg !== undefined) && (
                    <div className="border-t border-secondary pt-4">
                      <div className="grid grid-cols-1 gap-2">
                        {gpsData.speed_mps !== undefined && gpsData.speed_mps !== null && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Speed</span>
                            <span className="font-mono">{gpsData.speed_mps.toFixed(1)} m/s</span>
                          </div>
                        )}
                        {displayCourse !== null && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Course/Heading</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{displayCourse.toFixed(1)}°</span>
                              <Navigation2
                                className="w-4 h-4 text-primary"
                                style={{ transform: `rotate(${displayCourse}deg)` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {gpsData.hdop !== undefined && gpsData.hdop !== null && (
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
            </div>
          </motion.div>

          {/* Manual Coordinate Override */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="font-semibold">Manual Coordinate Override</span>
              </div>
            </div>
            <div className="panel-content space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Use Manual Coordinates</label>
                  <p className="text-xs text-muted-foreground">Override GPS with manual values</p>
                </div>
                <button
                  onClick={handleToggleManual}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useManual ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      useManual ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Manual input fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Latitude (deg)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary rounded-lg font-mono text-sm"
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Longitude (deg)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary rounded-lg font-mono text-sm"
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Altitude (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualAlt}
                    onChange={(e) => setManualAlt(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary rounded-lg font-mono text-sm"
                    placeholder="0.0"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveManualCoords}
                className="btn btn-primary w-full"
              >
                Save Coordinates
              </button>
            </div>
          </motion.div>

          {/* Heading Offset */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Navigation2 className="w-4 h-4" />
                <span className="font-semibold">Heading Offset</span>
              </div>
            </div>
            <div className="panel-content space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Offset Angle (deg)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Adjust for mounting position/angle
                </p>
                <input
                  type="number"
                  step="0.1"
                  value={headingOffset}
                  onChange={(e) => setHeadingOffset(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary rounded-lg font-mono text-sm"
                  placeholder="0.0"
                />
              </div>

              <button
                onClick={handleSaveHeadingOffset}
                className="btn btn-primary w-full"
              >
                Save Offset
              </button>

              {/* Info */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  The offset is added to the GPS Course Over Ground (COG) to compensate for GPS module mounting angle.
                </p>
              </div>
            </div>
          </motion.div>

          {/* About This Module */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="panel lg:col-span-2"
          >
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="font-semibold">About This Module</span>
              </div>
            </div>
            <div className="panel-content">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• USB GPS receiver with SiRF Star IV chipset</li>
                <li>• NMEA 0183 protocol at 4800 baud</li>
                <li>• Outputs position, altitude, speed, and course/heading</li>
                <li>• Course Over Ground (COG) provides heading information</li>
                <li>• HDOP indicates horizontal position accuracy</li>
                <li>• Manual coordinates override GPS for ground station location</li>
                <li>• Heading offset compensates for GPS module mounting angle</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
