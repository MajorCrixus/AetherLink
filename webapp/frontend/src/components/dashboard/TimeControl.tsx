/**
 * Cesium-style time control for animating date/time and controlling sun position
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Play, Pause, SkipForward, SkipBack, Calendar } from 'lucide-react'

interface TimeControlProps {
  onTimeChange: (date: Date) => void
  className?: string
}

const SPEED_MULTIPLIERS = [
  { label: '0.1x', value: 0.1 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
  { label: '50x', value: 50 },
  { label: '100x', value: 100 },
  { label: '500x', value: 500 },
  { label: '1000x', value: 1000 },
]

export function TimeControl({ onTimeChange, className = '' }: TimeControlProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(1) // 1 = real time
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = new Date(prev.getTime() + 1000 * speedMultiplier)
        onTimeChange(next)
        return next
      })
    }, 100) // Update 10 times per second

    return () => clearInterval(interval)
  }, [isPlaying, speedMultiplier, onTimeChange])

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  const handleStepForward = useCallback(() => {
    setCurrentTime((prev) => {
      const next = new Date(prev.getTime() + 3600000) // +1 hour
      onTimeChange(next)
      return next
    })
  }, [onTimeChange])

  const handleStepBackward = useCallback(() => {
    setCurrentTime((prev) => {
      const next = new Date(prev.getTime() - 3600000) // -1 hour
      onTimeChange(next)
      return next
    })
  }, [onTimeChange])

  const handleSetToNow = useCallback(() => {
    const now = new Date()
    setCurrentTime(now)
    onTimeChange(now)
  }, [onTimeChange])

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value
    const [year, month, day] = dateStr.split('-').map(Number)
    const newDate = new Date(currentTime)
    newDate.setFullYear(year, month - 1, day)
    setCurrentTime(newDate)
    onTimeChange(newDate)
  }, [currentTime, onTimeChange])

  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timeStr = e.target.value
    const [hours, minutes] = timeStr.split(':').map(Number)
    const newDate = new Date(currentTime)
    newDate.setHours(hours, minutes, 0, 0)
    setCurrentTime(newDate)
    onTimeChange(newDate)
  }, [currentTime, onTimeChange])

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const getDateInputValue = () => {
    const year = currentTime.getFullYear()
    const month = String(currentTime.getMonth() + 1).padStart(2, '0')
    const day = String(currentTime.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getTimeInputValue = () => {
    const hours = String(currentTime.getHours()).padStart(2, '0')
    const minutes = String(currentTime.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  return (
    <div className={`flex items-center gap-3 bg-black/70 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2 ${className}`}>
      {/* Animation Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleStepBackward}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
          title="Step backward 1 hour"
        >
          <SkipBack className="w-4 h-4 text-white" />
        </button>

        <button
          onClick={handlePlayPause}
          className={`p-1.5 rounded transition-colors ${
            isPlaying ? 'bg-primary/30 hover:bg-primary/40' : 'hover:bg-white/10'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white" />
          )}
        </button>

        <button
          onClick={handleStepForward}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
          title="Step forward 1 hour"
        >
          <SkipForward className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Speed Controls */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-white/60">Speed:</span>
        <select
          value={speedMultiplier}
          onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
          className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-primary"
        >
          {SPEED_MULTIPLIERS.map((speed) => (
            <option key={speed.value} value={speed.value} className="bg-gray-900">
              {speed.label}
            </option>
          ))}
        </select>
      </div>

      {/* Current Time Display */}
      <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10">
        <Calendar className="w-4 h-4 text-white/60" />
        <span className="text-sm text-white font-mono">{formatDateTime(currentTime)}</span>
      </div>

      {/* Date/Time Picker */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={getDateInputValue()}
          onChange={handleDateChange}
          className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-primary"
        />
        <input
          type="time"
          value={getTimeInputValue()}
          onChange={handleTimeChange}
          className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Set to Now Button */}
      <button
        onClick={handleSetToNow}
        className="px-3 py-1 text-xs bg-primary/20 hover:bg-primary/30 text-white rounded transition-colors"
      >
        Now
      </button>
    </div>
  )
}
