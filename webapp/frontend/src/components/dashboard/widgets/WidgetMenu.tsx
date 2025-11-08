/**
 * Standardized widget menu component
 */

import React, { useState } from 'react'
import { Menu } from 'lucide-react'

interface WidgetMenuProps {
  children: React.ReactNode
}

export function WidgetMenu({ children }: WidgetMenuProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 hover:bg-white/10 rounded transition-colors"
        title="Menu"
      >
        <Menu className="w-4 h-4" />
      </button>
      {showMenu && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          {/* Menu dropdown */}
          <div className="absolute right-0 top-8 z-50 min-w-[160px] p-2 bg-black/90 backdrop-blur rounded border border-white/20 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

interface WidgetMenuItemProps {
  label: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  onClick?: () => void
  type?: 'checkbox' | 'button'
}

export function WidgetMenuItem({ label, checked, onChange, onClick, type = 'checkbox' }: WidgetMenuItemProps) {
  if (type === 'button') {
    return (
      <button
        onClick={onClick}
        className="w-full text-left flex items-center gap-2 text-xs cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors"
      >
        <span>{label}</span>
      </button>
    )
  }

  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="w-3 h-3"
      />
      <span>{label}</span>
    </label>
  )
}
