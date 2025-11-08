import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Database, RefreshCw, Search, CheckCircle, XCircle, AlertCircle, Satellite } from 'lucide-react'
import {
  fetchSatellites,
  fetchSatelliteStats,
  checkSatcatHealth,
  type SatelliteSummary,
  type SatelliteStats,
  type SatelliteFilters,
} from '../../services/satelliteApi'

export function DatabaseModule() {
  const [satellites, setSatellites] = useState<SatelliteSummary[]>([])
  const [stats, setStats] = useState<SatelliteStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [filters, setFilters] = useState<SatelliteFilters>({ limit: 50 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrbit, setSelectedOrbit] = useState<string>('')
  const [ingesting, setIngesting] = useState(false)

  // Check backend health
  const checkHealth = async () => {
    try {
      await checkSatcatHealth()
      setHealthStatus('connected')
      return true
    } catch {
      setHealthStatus('disconnected')
      return false
    }
  }

  // Load data
  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check health first
      const isHealthy = await checkHealth()

      if (!isHealthy) {
        setError('Satellite database backend is not running on port 9001')
        setLoading(false)
        return
      }

      // Load stats and satellites
      const [statsData, satellitesData] = await Promise.all([
        fetchSatelliteStats(),
        fetchSatellites(filters),
      ])

      setStats(statsData)
      setSatellites(satellitesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load satellite data')
    } finally {
      setLoading(false)
    }
  }

  // Trigger data ingest
  const triggerIngest = async () => {
    setIngesting(true)
    try {
      const response = await fetch('http://192.168.68.135:9001/api/ingest/start', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to start ingest')
      }

      // Reload data after a delay
      setTimeout(() => {
        loadData()
        setIngesting(false)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger ingest')
      setIngesting(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadData()
  }, [])

  // Reload when filters change
  useEffect(() => {
    if (healthStatus === 'connected') {
      loadData()
    }
  }, [filters])

  // Filter satellites by search term
  const filteredSatellites = satellites.filter((sat) =>
    sat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sat.norad_id.toString().includes(searchTerm)
  )

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Satellite Database</h1>
                <p className="text-muted-foreground">Space-Track.org & SatNOGS Catalog</p>
              </div>
            </div>

            {/* Health Status */}
            <div className="flex items-center gap-2">
              {healthStatus === 'connected' && (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              )}
              {healthStatus === 'disconnected' && (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Disconnected</span>
                </div>
              )}
              {healthStatus === 'checking' && (
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Checking...</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
          >
            <div className="panel">
              <div className="panel-content">
                <div className="text-sm text-muted-foreground mb-1">Satellites</div>
                <div className="text-3xl font-bold">{stats.satellites.toLocaleString()}</div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-content">
                <div className="text-sm text-muted-foreground mb-1">TLE Elements</div>
                <div className="text-3xl font-bold">{stats.tles.toLocaleString()}</div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-content">
                <div className="text-sm text-muted-foreground mb-1">Transmitters</div>
                <div className="text-3xl font-bold">{stats.transmitters.toLocaleString()}</div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-content">
                <div className="text-sm text-muted-foreground mb-1">Tags</div>
                <div className="text-3xl font-bold">{stats.tags.toLocaleString()}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel mb-6"
        >
          <div className="panel-content">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or NORAD ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Orbit Filter */}
              <select
                value={selectedOrbit}
                onChange={(e) => {
                  const orbit = e.target.value
                  setSelectedOrbit(orbit)
                  setFilters({
                    ...filters,
                    orbit: orbit ? (orbit as SatelliteFilters['orbit']) : undefined,
                  })
                }}
                className="px-4 py-2 bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All Orbits</option>
                <option value="LEO">LEO</option>
                <option value="MEO">MEO</option>
                <option value="GEO">GEO</option>
                <option value="HEO">HEO</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              {/* Ingest Button */}
              <button
                onClick={triggerIngest}
                disabled={ingesting || healthStatus !== 'connected'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Database className={`w-4 h-4 ${ingesting ? 'animate-pulse' : ''}`} />
                {ingesting ? 'Ingesting...' : 'Update Database'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel mb-6 border-red-500/50"
          >
            <div className="panel-content bg-red-500/10">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <div>
                  <div className="font-semibold text-red-500">Error</div>
                  <div className="text-sm text-muted-foreground">{error}</div>
                  {healthStatus === 'disconnected' && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Start the satcat-backend with: <code className="bg-background/50 px-2 py-1 rounded">cd satcat-backend && npm start</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Satellite Table */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="panel"
          >
            <div className="panel-content p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">NORAD ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Orbit</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Launch Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Bands</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">TLE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSatellites.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                          <Satellite className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <div>No satellites found</div>
                          {searchTerm && (
                            <div className="text-sm mt-1">Try adjusting your search or filters</div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredSatellites.map((sat) => (
                        <tr key={sat.id} className="hover:bg-background/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-mono">{sat.norad_id}</td>
                          <td className="px-4 py-3 text-sm font-medium">{sat.name}</td>
                          <td className="px-4 py-3 text-sm">{sat.owner || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            {sat.orbit_class ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                sat.orbit_class === 'LEO' ? 'bg-blue-500/20 text-blue-400' :
                                sat.orbit_class === 'MEO' ? 'bg-green-500/20 text-green-400' :
                                sat.orbit_class === 'GEO' ? 'bg-purple-500/20 text-purple-400' :
                                sat.orbit_class === 'HEO' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {sat.orbit_class}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sat.launch_date ? new Date(sat.launch_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sat.bands.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {sat.bands.slice(0, 3).map((band) => (
                                  <span
                                    key={band}
                                    className="px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary-foreground"
                                  >
                                    {band}
                                  </span>
                                ))}
                                {sat.bands.length > 3 && (
                                  <span className="px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary-foreground">
                                    +{sat.bands.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sat.tle ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="panel">
            <div className="panel-content text-center py-12">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
              <h3 className="text-xl font-semibold mb-2">Loading Satellite Database</h3>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}