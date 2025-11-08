/**
 * Satellite Catalog HUD widget
 * Displays searchable satellite catalog from satcat-backend
 */

import React, { useState, useRef, useEffect } from 'react'
import { Satellite as SatelliteIcon, Menu, X, RotateCcw, Filter } from 'lucide-react'

import type { SatelliteSummary, SatelliteFilters } from '@/types/satellite'
import { fetchSatellites, acquireSatellite } from '@/services/satelliteApi'
import { SatelliteDetailModal } from '../SatelliteDetailModal'

interface SatelliteCatalogWidgetProps {
  isEditing?: boolean
  onSelectSatellite?: (satellite: SatelliteSummary) => void
}

export function SatelliteCatalogWidget({ isEditing = false, onSelectSatellite }: SatelliteCatalogWidgetProps) {
  const [satellites, setSatellites] = useState<SatelliteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSat, setSelectedSat] = useState<SatelliteSummary | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalNoradId, setModalNoradId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  const [filters, setFilters] = useState<SatelliteFilters>({
    limit: 20,
  })

  // Load satellites
  useEffect(() => {
    loadSatellites()
  }, [filters])

  const loadSatellites = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchSatellites(filters)
      setSatellites(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load satellites')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSatellite = (sat: SatelliteSummary) => {
    setSelectedSat(sat)
    setModalNoradId(sat.norad_id)
    setModalOpen(true)
    if (onSelectSatellite) {
      onSelectSatellite(sat)
    }
  }

  const handleAcquire = async (noradId: number) => {
    try {
      await acquireSatellite(noradId)
      const sat = satellites.find(s => s.norad_id === noradId)
      console.log(`Acquisition queued for ${sat?.name || noradId}`)
    } catch (err) {
      console.error('Acquisition failed:', err)
    }
  }

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterMenuOpen(false)
      }
    }

    if (menuOpen || filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen, filterMenuOpen])

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      {/* Header */}
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <SatelliteIcon className="w-4 h-4" />
          <span className="font-semibold">SATCAT</span>

          <span className="ml-auto text-xs text-health-ok">
            {satellites.length}
          </span>

          {/* Filter button */}
          <div className="relative" ref={filterRef} style={{ zIndex: 10001 }}>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFilterMenuOpen(!filterMenuOpen)
              }}
              className="p-1 hover:bg-white/5 rounded transition-colors"
            >
              <Filter className="w-4 h-4" />
            </button>

            {filterMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-black/95 border border-cyan-500/30 rounded p-3 min-w-[200px]">
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-cyan-400">Orbit</label>
                    <select
                      value={filters.orbit || ''}
                      onChange={(e) => setFilters({ ...filters, orbit: e.target.value as any || undefined })}
                      className="w-full bg-black/50 border border-cyan-500/30 rounded p-1 text-white"
                    >
                      <option value="">All</option>
                      <option value="LEO">LEO</option>
                      <option value="MEO">MEO</option>
                      <option value="GEO">GEO</option>
                      <option value="HEO">HEO</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-cyan-400">Frequency Band</label>
                    <select
                      value={filters.band || ''}
                      onChange={(e) => setFilters({ ...filters, band: e.target.value || undefined })}
                      className="w-full bg-black/50 border border-cyan-500/30 rounded p-1 text-white"
                    >
                      <option value="">All</option>
                      <option value="VHF">VHF</option>
                      <option value="UHF">UHF</option>
                      <option value="L">L-Band</option>
                      <option value="S">S-Band</option>
                      <option value="C">C-Band</option>
                      <option value="X">X-Band</option>
                      <option value="Ku">Ku-Band</option>
                      <option value="K">K-Band</option>
                      <option value="Ka">Ka-Band</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-cyan-400">Owner</label>
                    <select
                      value={filters.owner || ''}
                      onChange={(e) => setFilters({ ...filters, owner: e.target.value || undefined })}
                      className="w-full bg-black/50 border border-cyan-500/30 rounded p-1 text-white"
                    >
                      <option value="">All</option>
                      <option value="US">US</option>
                      <option value="PRC">China</option>
                      <option value="CIS">Russia</option>
                      <option value="JPN">Japan</option>
                      <option value="ESA">ESA</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-cyan-400">Limit</label>
                    <select
                      value={filters.limit || 20}
                      onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                      className="w-full bg-black/50 border border-cyan-500/30 rounded p-1 text-white"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setFilters({ limit: 20 })
                      setFilterMenuOpen(false)
                    }}
                    className="w-full mt-2 p-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded text-xs transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Menu button (edit mode only) */}
          {isEditing && (
            <div className="relative" ref={menuRef} style={{ zIndex: 10000 }}>
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
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-black/95 border border-cyan-500/30 rounded p-2 min-w-[150px]">
                  <button
                    onClick={() => {
                      loadSatellites()
                      setMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-cyan-500/10 rounded text-sm flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden space-y-2">
        {loading && (
          <div className="text-center text-sm text-cyan-400 py-4">
            Loading satellites...
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-health-error py-4">
            {error}
          </div>
        )}

        {!loading && !error && satellites.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-4">
            No satellites found
          </div>
        )}

        {!loading && !error && satellites.map((sat) => (
          <div
            key={sat.id}
            onClick={() => handleSelectSatellite(sat)}
            className={`
              p-2 rounded border cursor-pointer transition-all
              ${selectedSat?.id === sat.id
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{sat.name}</div>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <div className="flex gap-2">
                    <span className="text-cyan-400">NORAD:</span>
                    <span>{sat.norad_id}</span>
                  </div>
                  {sat.orbit_class && (
                    <div className="flex gap-2">
                      <span className="text-cyan-400">Orbit:</span>
                      <span>{sat.orbit_class}</span>
                    </div>
                  )}
                  {sat.owner && (
                    <div className="flex gap-2">
                      <span className="text-cyan-400">Owner:</span>
                      <span>{sat.owner}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedSat?.id === sat.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAcquire(sat.norad_id)
                  }}
                  className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded text-xs transition-colors flex-shrink-0"
                >
                  Acquire
                </button>
              )}
            </div>

            {selectedSat?.id === sat.id && sat.tle && (
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="text-cyan-400">TLE Available</div>
                <div className="font-mono text-[10px] truncate">{sat.tle.line1}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Satellite Detail Modal */}
      {modalOpen && modalNoradId !== null && (
        <SatelliteDetailModal
          noradId={modalNoradId}
          onClose={() => setModalOpen(false)}
          onAcquire={handleAcquire}
        />
      )}
    </div>
  )
}
