/**
 * Main application layout with INAV-style sidebar and health bar
 */

import React from 'react'
import { motion } from 'framer-motion'

import { Sidebar } from './Sidebar'
import { HealthBar } from '@/components/health/HealthBar'
import { useUIState } from '@/stores/telemetryStore'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { sidebarCollapsed } = useUIState()

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Health/Status Bar */}
      <HealthBar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <motion.main
          layout
          className={`flex-1 overflow-hidden transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          }`}
        >
          <div className="h-full overflow-auto">
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  )
}