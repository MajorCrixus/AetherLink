/**
 * INAV-style collapsible sidebar navigation
 */

import React from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Settings,
  Globe,
  Layers,
  FileText,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Satellite,
  Compass,
  Zap,
  Radio,
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react'

import { useUIState, useServosData } from '@/stores/telemetryStore'
import { cn } from '@/lib/utils'

interface NavigationItem {
  path: string
  label: string
  icon: React.ReactNode
  children?: NavigationItem[]
}

const navigationItems: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <Home className="w-5 h-5" />
  },
  {
    path: '/servos',
    label: 'Servos Console',
    icon: <Zap className="w-5 h-5" />
  },
  {
    path: '/config',
    label: 'Setup/Configuration',
    icon: <Settings className="w-5 h-5" />
  },
  {
    path: '/antenna',
    label: '3D Antenna View',
    icon: <Globe className="w-5 h-5" />
  },
  {
    path: '/modules',
    label: 'Modules',
    icon: <Layers className="w-5 h-5" />,
    children: [
      {
        path: '/modules/gps',
        label: 'GPS',
        icon: <Satellite className="w-4 h-4" />
      },
      {
        path: '/modules/imu',
        label: 'IMU',
        icon: <Compass className="w-4 h-4" />
      },
      {
        path: '/modules/servos',
        label: 'Servos',
        icon: <Zap className="w-4 h-4" />
      },
      {
        path: '/modules/ephemeris',
        label: 'Ephemeris/TLE',
        icon: <Radio className="w-4 h-4" />
      },
      {
        path: '/modules/sdr',
        label: 'SDR',
        icon: <Radio className="w-4 h-4" />
      },
      {
        path: '/modules/database',
        label: 'Database',
        icon: <Database className="w-4 h-4" />
      }
    ]
  },
  {
    path: '/logs',
    label: 'Logs & Events',
    icon: <FileText className="w-5 h-5" />
  },
  {
    path: '/cli',
    label: 'CLI',
    icon: <Terminal className="w-5 h-5" />
  }
]

interface NavItemProps {
  item: NavigationItem
  collapsed: boolean
  isChild?: boolean
  hasError?: boolean
}

function NavItem({ item, collapsed, isChild = false, hasError = false }: NavItemProps) {
  const hasChildren = item.children && item.children.length > 0
  const [expanded, setExpanded] = React.useState(false)

  const toggleExpanded = () => {
    if (hasChildren && !collapsed) {
      setExpanded(!expanded)
    }
  }

  return (
    <div className="relative">
      {/* Main nav item */}
      <NavLink
        to={item.path}
        onClick={hasChildren ? (e) => { e.preventDefault(); toggleExpanded() } : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
            'hover:bg-primary/10 hover:text-primary',
            isActive && !hasChildren && 'bg-primary/20 text-primary border-r-2 border-primary',
            isChild && 'ml-4 text-sm',
            collapsed && 'justify-center px-2',
            hasError && 'animate-pulse'
          )
        }
        title={collapsed ? item.label : undefined}
      >
        <div className="flex-shrink-0 relative">
          {item.icon}
          {hasError && (
            <AlertTriangle className="w-3 h-3 text-red-500 absolute -top-1 -right-1 animate-pulse" />
          )}
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex-1 flex items-center justify-between"
            >
              <span className="truncate">{item.label}</span>
              {hasChildren && (
                <ChevronRight
                  className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    expanded && 'rotate-90'
                  )}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </NavLink>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && expanded && !collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="py-1 space-y-1">
              {item.children!.map((child) => (
                <NavItem
                  key={child.path}
                  item={child}
                  collapsed={collapsed}
                  isChild={true}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIState()
  const servos = useServosData()

  // Check if any servo has an error
  const hasServoErrors = React.useMemo(() => {
    if (!servos) return false
    return Object.values(servos).some(servo => servo.error_code && servo.error_code !== '')
  }, [servos])

  return (
    <motion.aside
      layout
      className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-secondary/30 border-r border-secondary backdrop-blur-sm z-40',
        'transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-secondary">
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Satellite className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-sm">AetherLink</h1>
                <p className="text-xs text-muted-foreground">SATCOM Control</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1 rounded hover:bg-primary/10 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-2 overflow-y-auto">
        {navigationItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={sidebarCollapsed}
            hasError={item.path === '/servos' && hasServoErrors}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 px-4">
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground text-center"
            >
              <div>v1.0.0</div>
              <div>Build 2024-01-01</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}