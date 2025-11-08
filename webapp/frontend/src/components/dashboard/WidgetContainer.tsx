/**
 * Reusable widget container with hamburger menu and settings
 */

import React, { useState, useRef, useEffect } from 'react'
import { Menu, X, Eye, EyeOff, Clock, Minimize2, Maximize2, RotateCcw } from 'lucide-react'
import { useWidgetConfigStore, type WidgetType } from '@/stores/widgetConfigStore'

interface WidgetContainerProps {
  widgetId: WidgetType
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  isEditing?: boolean
}

export function WidgetContainer({ widgetId, title, icon, children, className = '', isEditing = false }: WidgetContainerProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const config = useWidgetConfigStore((state) => state.widgets[widgetId])
  const toggleTimestamp = useWidgetConfigStore((state) => state.toggleTimestamp)
  const toggleCompactMode = useWidgetConfigStore((state) => state.toggleCompactMode)
  const resetWidget = useWidgetConfigStore((state) => state.resetWidget)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  return (
    <div className={`hud-widget h-full w-full flex flex-col ${className}`}>
      {/* Header with Menu - Drag handle for moving widget */}
      <div className={`hud-widget-header flex-shrink-0 ${isEditing ? 'cursor-move' : 'cursor-default'}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold">{title}</span>

          {/* Only show hamburger menu when editing */}
          {isEditing && (
            <div className="ml-auto relative" ref={menuRef} style={{ zIndex: 10000 }}>
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
                onTouchStart={(e) => {
                  e.stopPropagation()
                }}
                className="p-1 hover:bg-primary/20 rounded transition-colors cursor-pointer relative z-[10001]"
                style={{ pointerEvents: 'auto' }}
                title="Widget settings"
              >
                {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 bg-background border border-primary/30 rounded-lg shadow-lg min-w-[200px]"
                  style={{ zIndex: 10002, pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                <div className="py-1">
                  {/* Show/Hide Timestamp */}
                  <button
                    onClick={() => {
                      toggleTimestamp(widgetId)
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{config.showTimestamp ? 'Hide' : 'Show'} Timestamp</span>
                  </button>

                  {/* Compact Mode */}
                  <button
                    onClick={() => {
                      toggleCompactMode(widgetId)
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2"
                  >
                    {config.compactMode ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    <span>{config.compactMode ? 'Detailed' : 'Compact'} View</span>
                  </button>

                  <div className="border-t border-primary/20 my-1" />

                  {/* Reset Widget */}
                  <button
                    onClick={() => {
                      resetWidget(widgetId)
                      setMenuOpen(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 text-health-warn"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset to Default</span>
                  </button>
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Widget Content - Scrollable */}
      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  )
}
