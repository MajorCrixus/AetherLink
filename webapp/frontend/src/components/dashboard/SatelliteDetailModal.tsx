/**
 * Satellite Detail Modal
 * Displays extended satellite information with Acquire button
 */

import React, { useEffect, useState } from 'react'
import { X, Satellite as SatelliteIcon, Radio, Globe, Calendar, Target, Orbit } from 'lucide-react'

import type { SatelliteDetail } from '@/types/satellite'
import { fetchSatelliteDetail } from '@/services/satelliteApi'
import { OrbitalElementsPanel } from './OrbitalElementsPanel'

interface SatelliteDetailModalProps {
  noradId: number
  onClose: () => void
  onAcquire: (noradId: number) => void
}

export function SatelliteDetailModal({ noradId, onClose, onAcquire }: SatelliteDetailModalProps) {
  const [satellite, setSatellite] = useState<SatelliteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showOrbitalElements, setShowOrbitalElements] = useState(false)

  // Load satellite details
  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchSatelliteDetail(noradId)
        setSatellite(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load satellite details')
      } finally {
        setLoading(false)
      }
    }

    loadDetails()
  }, [noradId])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-black/95 border border-cyan-500/50 rounded-lg shadow-lg shadow-cyan-500/20 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <SatelliteIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-cyan-400">
              {loading ? 'Loading...' : satellite?.name || 'Satellite Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5 text-cyan-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center text-cyan-400 py-8">
              Loading satellite details...
            </div>
          )}

          {error && (
            <div className="text-center text-health-error py-8">
              {error}
            </div>
          )}

          {!loading && !error && satellite && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-cyan-400/70 text-xs">NORAD ID</div>
                  <div className="text-white font-mono">{satellite.norad_id}</div>
                </div>
                <div>
                  <div className="text-cyan-400/70 text-xs">International Designator</div>
                  <div className="text-white font-mono">{satellite.intl_desig || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-cyan-400/70 text-xs">Owner</div>
                  <div className="text-white">{satellite.owner || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-cyan-400/70 text-xs">Object Type</div>
                  <div className="text-white">{satellite.object_type || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-cyan-400/70 text-xs">RCS Size</div>
                  <div className="text-white">{satellite.rcs_size || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-cyan-400/70 text-xs">Launch Date</div>
                  <div className="text-white">
                    {satellite.launch_date ? new Date(satellite.launch_date).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Orbital Parameters */}
              <div className="border border-cyan-500/30 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-cyan-400">Orbital Parameters</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-cyan-400/70 text-xs">Orbit Class</div>
                    <div className="text-white">{satellite.orbit.class}</div>
                  </div>
                  {satellite.orbit.period_minutes && (
                    <div>
                      <div className="text-cyan-400/70 text-xs">Period</div>
                      <div className="text-white">{satellite.orbit.period_minutes.toFixed(2)} min</div>
                    </div>
                  )}
                  {satellite.orbit.inclination_deg !== undefined && (
                    <div>
                      <div className="text-cyan-400/70 text-xs">Inclination</div>
                      <div className="text-white">{satellite.orbit.inclination_deg.toFixed(2)}°</div>
                    </div>
                  )}
                  {satellite.orbit.apogee_km !== undefined && (
                    <div>
                      <div className="text-cyan-400/70 text-xs">Apogee</div>
                      <div className="text-white">{satellite.orbit.apogee_km.toFixed(0)} km</div>
                    </div>
                  )}
                  {satellite.orbit.perigee_km !== undefined && (
                    <div>
                      <div className="text-cyan-400/70 text-xs">Perigee</div>
                      <div className="text-white">{satellite.orbit.perigee_km.toFixed(0)} km</div>
                    </div>
                  )}
                </div>
              </div>

              {/* TLE Data */}
              {satellite.tle && (
                <div className="border border-cyan-500/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-cyan-400">TLE Data</h3>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>
                      <div className="text-cyan-400/70">Epoch</div>
                      <div className="text-white">
                        {new Date(satellite.tle.epoch).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-cyan-400/70">TLE Lines</div>
                      <div className="font-mono text-[10px] bg-black/50 p-2 rounded mt-1 space-y-1">
                        <div className="text-white break-all">{satellite.tle.line1}</div>
                        <div className="text-white break-all">{satellite.tle.line2}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transmitters */}
              {satellite.transmitters && satellite.transmitters.length > 0 && (
                <div className="border border-cyan-500/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-cyan-400">
                      Transmitters ({satellite.transmitters.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {satellite.transmitters.map((tx) => (
                      <div key={tx.uuid} className="text-xs bg-black/30 p-2 rounded">
                        <div className="grid grid-cols-2 gap-2">
                          {tx.downlink_freq_mhz && (
                            <div>
                              <span className="text-cyan-400/70">Downlink:</span>{' '}
                              <span className="text-white">{tx.downlink_freq_mhz} MHz</span>
                              {tx.downlink_band && (
                                <span className="text-cyan-400/70"> ({tx.downlink_band})</span>
                              )}
                            </div>
                          )}
                          {tx.uplink_freq_mhz && (
                            <div>
                              <span className="text-cyan-400/70">Uplink:</span>{' '}
                              <span className="text-white">{tx.uplink_freq_mhz} MHz</span>
                              {tx.uplink_band && (
                                <span className="text-cyan-400/70"> ({tx.uplink_band})</span>
                              )}
                            </div>
                          )}
                          {tx.mode && (
                            <div>
                              <span className="text-cyan-400/70">Mode:</span>{' '}
                              <span className="text-white">{tx.mode}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-cyan-400/70">Status:</span>{' '}
                            <span className={`${tx.status === 'active' ? 'text-health-ok' : 'text-health-warning'}`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {satellite.tags && Object.keys(satellite.tags).length > 0 && (
                <div className="border border-cyan-500/30 rounded p-3">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-2">Tags</h3>
                  <div className="space-y-1 text-xs">
                    {Object.entries(satellite.tags).map(([category, values]) => (
                      <div key={category}>
                        <span className="text-cyan-400/70">{category}:</span>{' '}
                        <span className="text-white">{values.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Acquire and Orbital Elements buttons */}
        {!loading && !error && satellite && (
          <div className="border-t border-cyan-500/30 p-4 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-cyan-500/30 rounded text-sm transition-colors"
            >
              Close
            </button>
            <div className="flex gap-2">
              {satellite.tle && (
                <button
                  onClick={() => setShowOrbitalElements(!showOrbitalElements)}
                  className={`px-4 py-2 border rounded text-sm font-semibold transition-colors flex items-center gap-2 ${
                    showOrbitalElements
                      ? 'bg-purple-500/50 border-purple-500/50'
                      : 'bg-purple-500/30 hover:bg-purple-500/50 border-purple-500/50'
                  }`}
                >
                  <Orbit className="w-4 h-4" />
                  {showOrbitalElements ? 'Hide' : 'View'} Orbital Elements
                </button>
              )}
              <button
                onClick={() => {
                  onAcquire(noradId)
                  onClose()
                }}
                className="px-6 py-2 bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-500/50 rounded text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                Acquire
              </button>
            </div>
          </div>
        )}

        {/* Orbital Elements Panel */}
        {showOrbitalElements && satellite?.tle && (
          <OrbitalElementsPanel
            tle={satellite.tle}
            satelliteName={satellite.name}
            onClose={() => setShowOrbitalElements(false)}
          />
        )}
      </div>
    </div>
  )
}
