/**
 * Modules overview page
 */

import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Satellite,
  Compass,
  Zap,
  Activity,
  Radio,
  Database,
  Settings,
  Play,
  AlertTriangle
} from 'lucide-react'

import { useHealthStatus } from '@/stores/telemetryStore'
import { HealthStatusIcon } from '@/components/health/HealthBar'

export function ModulesList() {
  const navigate = useNavigate()
  const health = useHealthStatus()

  const modules = [
    {
      id: 'gps',
      name: 'GPS',
      description: 'u-blox M10-25Q GNSS receiver',
      icon: <Satellite className="w-6 h-6" />,
      path: '/modules/gps',
      status: health?.gps?.status || 'OFF',
      message: health?.gps?.message || 'Not connected'
    },
    {
      id: 'imu',
      name: 'IMU',
      description: 'WitMotion WT901C-TTL 9-axis sensor',
      icon: <Compass className="w-6 h-6" />,
      path: '/modules/imu',
      status: health?.imu?.status || 'OFF',
      message: health?.imu?.message || 'Not connected'
    },
    {
      id: 'servos',
      name: 'Servos',
      description: 'MKS Servo57D motor controllers',
      icon: <Zap className="w-6 h-6" />,
      path: '/modules/servos',
      status: health?.servos?.status || 'OFF',
      message: health?.servos?.message || 'Not connected'
    },
    {
      id: 'ephemeris',
      name: 'Ephemeris/TLE',
      description: 'Satellite tracking data and orbit prediction',
      icon: <Radio className="w-6 h-6" />,
      path: '/modules/ephemeris',
      status: health?.tle?.status || 'OFF',
      message: health?.tle?.message || 'No TLE data'
    },
    {
      id: 'sdr',
      name: 'SDR',
      description: 'Software-defined radio interface',
      icon: <Radio className="w-6 h-6" />,
      path: '/modules/sdr',
      status: 'OFF',
      message: 'Not configured'
    },
    {
      id: 'database',
      name: 'Database',
      description: 'Telemetry storage and historical data',
      icon: <Database className="w-6 h-6" />,
      path: '/modules/database',
      status: 'OK',
      message: 'Connected'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'text-health-ok'
      case 'WARN': return 'text-health-warn'
      case 'ERROR': return 'text-health-error'
      case 'INIT': return 'text-health-init'
      case 'SIM': return 'text-health-sim'
      default: return 'text-health-off'
    }
  }

  return (
    <div className="h-full p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Hardware Modules</h1>
          <p className="text-muted-foreground">
            Monitor and configure individual hardware components
          </p>
        </motion.div>

        {/* System Status Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="panel mb-8"
        >
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="font-semibold">System Status</span>
            </div>
          </div>
          <div className="panel-content">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-health-ok">
                  {modules.filter(m => m.status === 'OK').length}
                </div>
                <div className="text-sm text-muted-foreground">Online</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-health-warn">
                  {modules.filter(m => m.status === 'WARN').length}
                </div>
                <div className="text-sm text-muted-foreground">Warning</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-health-error">
                  {modules.filter(m => m.status === 'ERROR').length}
                </div>
                <div className="text-sm text-muted-foreground">Error</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-health-off">
                  {modules.filter(m => m.status === 'OFF').length}
                </div>
                <div className="text-sm text-muted-foreground">Offline</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => navigate(module.path)}
              className="panel hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <div className="panel-content">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {module.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{module.name}</h3>
                      <HealthStatusIcon status={module.status as any} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {module.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${getStatusColor(module.status)}`}>
                        {module.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {module.message}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8 panel"
        >
          <div className="panel-header">
            <h2 className="font-semibold">Quick Actions</h2>
          </div>
          <div className="panel-content">
            <div className="flex gap-4">
              <button className="btn btn-primary">
                <Play className="w-4 h-4 mr-2" />
                Initialize All
              </button>
              <button className="btn btn-secondary">
                <Settings className="w-4 h-4 mr-2" />
                Run Diagnostics
              </button>
              <button className="btn btn-secondary">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Emergency Stop
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}