/**
 * Configuration and setup page
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Settings, Network, Eye, Clock, Shield, Play } from 'lucide-react'

export function Configuration() {
  const configSections = [
    {
      icon: <Network className="w-5 h-5" />,
      title: 'Network & Roles',
      description: 'Configure network settings and user roles',
      status: 'configured'
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: 'API Endpoints',
      description: 'External service configuration',
      status: 'pending'
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: 'Units & Geodesy',
      description: 'Coordinate systems and units',
      status: 'configured'
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Time Source',
      description: 'GPS/NTP time synchronization',
      status: 'configured'
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Limits & Safety',
      description: 'Motion limits and safety parameters',
      status: 'configured'
    },
    {
      icon: <Play className="w-5 h-5" />,
      title: 'Demo Mode',
      description: 'Simulation and testing configuration',
      status: 'active'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured': return 'text-health-ok'
      case 'active': return 'text-health-sim'
      case 'pending': return 'text-health-warn'
      default: return 'text-muted-foreground'
    }
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
          <h1 className="text-3xl font-bold mb-2">Setup & Configuration</h1>
          <p className="text-muted-foreground">
            Configure system settings, safety parameters, and operational modes
          </p>
        </motion.div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="panel hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <div className="panel-content">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{section.title}</h3>
                      <div className={`w-2 h-2 rounded-full ${
                        section.status === 'configured' ? 'bg-health-ok' :
                        section.status === 'active' ? 'bg-health-sim' :
                        section.status === 'pending' ? 'bg-health-warn' :
                        'bg-health-off'
                      }`} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {section.description}
                    </p>
                    <div className={`text-xs font-medium ${getStatusColor(section.status)}`}>
                      {section.status.toUpperCase()}
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
          transition={{ delay: 0.7 }}
          className="mt-8 panel"
        >
          <div className="panel-header">
            <h2 className="font-semibold">Quick Actions</h2>
          </div>
          <div className="panel-content">
            <div className="flex gap-4">
              <button className="btn btn-primary">
                Export Configuration
              </button>
              <button className="btn btn-secondary">
                Import Configuration
              </button>
              <button className="btn btn-secondary">
                Reset to Defaults
              </button>
              <button className="btn btn-secondary">
                Run System Check
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}