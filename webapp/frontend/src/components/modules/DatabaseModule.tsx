import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Satellite,
  ChevronDown,
  ChevronRight,
  Filter,
  X
} from 'lucide-react'
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
  const [filters, setFilters] = useState<SatelliteFilters>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrbit, setSelectedOrbit] = useState<string>('')
  const [ingesting, setIngesting] = useState(false)

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Column filters
  const [columnFilters, setColumnFilters] = useState({
    norad_id: '',
    name: '',
    owner: '',
    orbit: '',
    band: '',
    launch_date: '',
  })

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

  // Toggle row expansion
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  // Clear all filters
  const clearColumnFilters = () => {
    setColumnFilters({
      norad_id: '',
      name: '',
      owner: '',
      orbit: '',
      band: '',
      launch_date: '',
    })
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

  // Filter satellites by search term and column filters
  const filteredSatellites = satellites.filter((sat) => {
    // Global search
    const matchesSearch =
      sat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sat.norad_id.toString().includes(searchTerm)

    // Column filters
    const matchesNoradFilter = sat.norad_id.toString().includes(columnFilters.norad_id)
    const matchesNameFilter = sat.name.toLowerCase().includes(columnFilters.name.toLowerCase())
    const matchesOwnerFilter = !columnFilters.owner ||
      (sat.owner && sat.owner.toLowerCase().includes(columnFilters.owner.toLowerCase()))
    const matchesOrbitFilter = !columnFilters.orbit ||
      (sat.orbit_class && sat.orbit_class.toLowerCase().includes(columnFilters.orbit.toLowerCase()))
    const matchesBandFilter = !columnFilters.band ||
      (sat.bands && Array.isArray(sat.bands) && sat.bands.some(band => band.toLowerCase().includes(columnFilters.band.toLowerCase())))
    const matchesLaunchDateFilter = !columnFilters.launch_date ||
      (sat.launch_date && sat.launch_date.includes(columnFilters.launch_date))

    return matchesSearch &&
           matchesNoradFilter &&
           matchesNameFilter &&
           matchesOwnerFilter &&
           matchesOrbitFilter &&
           matchesBandFilter &&
           matchesLaunchDateFilter
  })

  // Pagination
  const totalPages = Math.ceil(filteredSatellites.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSatellites = filteredSatellites.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, columnFilters, selectedOrbit])

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

              {/* Clear Filters Button */}
              <button
                onClick={clearColumnFilters}
                className="px-4 py-2 bg-background/50 border border-border rounded-lg hover:bg-background transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>

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
              {/* Results Info */}
              <div className="px-4 py-3 border-b border-border bg-background/50 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredSatellites.length)} of {filteredSatellites.length} satellites
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-background/50">
                    {/* Column Headers */}
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12"></th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">NORAD ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Orbit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Band</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Launch Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">TLE</th>
                    </tr>
                    {/* Filter Row */}
                    <tr>
                      <th className="px-4 py-2"></th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.norad_id}
                          onChange={(e) => setColumnFilters({ ...columnFilters, norad_id: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.name}
                          onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.owner}
                          onChange={(e) => setColumnFilters({ ...columnFilters, owner: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.orbit}
                          onChange={(e) => setColumnFilters({ ...columnFilters, orbit: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.band}
                          onChange={(e) => setColumnFilters({ ...columnFilters, band: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </th>
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.launch_date}
                          onChange={(e) => setColumnFilters({ ...columnFilters, launch_date: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedSatellites.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          <Satellite className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <div>No satellites found</div>
                          {(searchTerm || Object.values(columnFilters).some(v => v)) && (
                            <div className="text-sm mt-1">Try adjusting your search or filters</div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedSatellites.map((sat) => (
                        <React.Fragment key={sat.id}>
                          {/* Main Row */}
                          <tr className="hover:bg-background/50 transition-colors">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleRow(sat.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {expandedRows.has(sat.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
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
                              {sat.bands && sat.bands.length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {sat.bands.slice(0, 2).map((band) => (
                                    <span
                                      key={band}
                                      className="px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary-foreground"
                                    >
                                      {band}
                                    </span>
                                  ))}
                                  {sat.bands.length > 2 && (
                                    <span className="px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary-foreground">
                                      +{sat.bands.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {sat.launch_date ? new Date(sat.launch_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {sat.tle ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </td>
                          </tr>

                          {/* Expanded Detail Row */}
                          <AnimatePresence>
                            {expandedRows.has(sat.id) && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden bg-background/30"
                                  >
                                    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-l-2 border-primary/50">
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">NORAD Catalog ID</div>
                                        <div className="text-sm font-mono">{sat.norad_id}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">Satellite Name</div>
                                        <div className="text-sm font-medium">{sat.name}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">Owner/Operator</div>
                                        <div className="text-sm">{sat.owner || 'Unknown'}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">Orbit Classification</div>
                                        <div className="text-sm">{sat.orbit_class || 'Unknown'}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">Launch Date</div>
                                        <div className="text-sm">
                                          {sat.launch_date ? new Date(sat.launch_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                          }) : 'Unknown'}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">TLE Status</div>
                                        <div className="text-sm flex items-center gap-2">
                                          {sat.tle ? (
                                            <>
                                              <CheckCircle className="w-4 h-4 text-green-500" />
                                              <span>Available</span>
                                            </>
                                          ) : (
                                            <>
                                              <XCircle className="w-4 h-4 text-red-500" />
                                              <span>Not Available</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="md:col-span-2 lg:col-span-3">
                                        <div className="text-xs text-muted-foreground mb-1">Frequency Bands</div>
                                        <div className="flex gap-2 flex-wrap">
                                          {sat.bands.length > 0 ? (
                                            sat.bands.map((band) => (
                                              <span
                                                key={band}
                                                className="px-2 py-1 rounded text-xs bg-primary/20 text-primary-foreground"
                                              >
                                                {band}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-sm text-muted-foreground">No frequency data available</span>
                                          )}
                                        </div>
                                      </div>
                                      {sat.tle && (
                                        <div className="md:col-span-2 lg:col-span-3">
                                          <div className="text-xs text-muted-foreground mb-1">Two-Line Element Set</div>
                                          <div className="bg-background/50 rounded p-2 font-mono text-xs">
                                            <div>{sat.tle.line1}</div>
                                            <div>{sat.tle.line2}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredSatellites.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-background/50 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 text-sm rounded ${
                              currentPage === pageNum
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border hover:bg-background'
                            } transition-colors`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
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
