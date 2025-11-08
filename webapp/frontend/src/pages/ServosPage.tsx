/**
 * Servos Console Page - Interactive servo control and diagnostics
 * Model-aware design for MKS SERVO42D & SERVO57D v1.0.6
 */

import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, XCircle, Activity, Zap, Home, Settings, Terminal, AlertTriangle } from 'lucide-react'
import { servoApi, ServoStatus, CommandResponse } from '@/services/servoApi'
import { useTelemetryStore } from '@/stores/telemetryStore'

// Servo configuration with model info
const SERVO_CONFIG = {
  az: {
    label: 'Azimuth (Az)',
    address: 0x01,
    model: '57D',
    hasLimitSwitches: true,
    homingMethod: 'limit',
    currentLimitWork_mA: 3200,
    currentLimitHome_mA: 800,
    io: { inputs: 2, outputs: 2 }
  },
  el: {
    label: 'Elevation (El)',
    address: 0x02,
    model: '57D',
    hasLimitSwitches: false,
    homingMethod: 'stall',
    currentLimitWork_mA: 3200,
    currentLimitHome_mA: 400,
    io: { inputs: 2, outputs: 2 }
  },
  cl: {
    label: 'Cross-Level (CL)',
    address: 0x03,
    model: '42D',
    hasLimitSwitches: false,
    homingMethod: 'stall',
    currentLimitWork_mA: 1600,
    currentLimitHome_mA: 400,
    io: { inputs: 1, outputs: 0 }
  }
} as const

type ServoAxis = keyof typeof SERVO_CONFIG

interface StatusCardProps {
  axis: string
  config: typeof SERVO_CONFIG[ServoAxis]
}

function StatusCard({ axis, config }: StatusCardProps) {
  const [status, setStatus] = useState<ServoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const telemetry = useTelemetryStore((state) => state.telemetry)

  const fetchStatus = async () => {
    try {
      const result = await servoApi.getFullStatus(axis)
      if (result.data) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error(`Failed to fetch ${axis} status:`, error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [axis])

  const axisData = telemetry?.axes?.[axis.toUpperCase()]
  const limitData = telemetry?.limits?.[axis.toUpperCase()]
  const servoData = telemetry?.servos?.[axis.toUpperCase()]
  const isOnline = status?.online ?? false
  const errors = status?.errors ?? []

  const handleClearError = async () => {
    try {
      await servoApi.releaseLockedRotor(axis)
    } catch (error) {
      console.error(`Failed to clear error for ${axis}:`, error)
    }
  }

  const hasError = servoData?.error_code && servoData.error_code !== ''

  return (
    <div className="border border-primary/30 rounded bg-black/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-sm">{config.label}</h3>
          <span className="text-xs text-muted-foreground">MKS {config.model} @ 0x{config.address.toString(16).toUpperCase().padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-xs text-green-500">Online</span></>
          ) : (
            <><XCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-red-500">Offline</span></>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position:</span>
          <span className="font-mono font-semibold">{axisData?.actual_deg.toFixed(2) ?? '--'}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rate:</span>
          <span className="font-mono">{axisData?.rate_dps?.toFixed(1) ?? '--'} °/s</span>
        </div>

        {errors.length > 0 && (
          <div className="mt-2 p-1.5 bg-red-500/10 border border-red-500/30 rounded">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                {errors.map((err, idx) => (
                  <div key={idx} className="text-xs text-red-400">{err}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* I/O Status */}
        <div className="mt-2 pt-2 border-t border-primary/20">
          <div className="text-xs text-muted-foreground mb-1.5">I/O Status</div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">IN1</span>
              <div className={`w-2 h-2 rounded-full ${limitData?.in1 ? 'bg-red-500' : 'bg-green-500'}`} />
            </div>
            {config.io.inputs >= 2 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs">IN2</span>
                <div className={`w-2 h-2 rounded-full ${limitData?.in2 ? 'bg-red-500' : 'bg-green-500'}`} />
              </div>
            )}
            {config.io.outputs >= 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs">OUT1</span>
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            )}
            {config.io.outputs >= 2 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs">OUT2</span>
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            )}
          </div>
        </div>

        {/* Servo Error Status */}
        <div className="mt-2 pt-2 border-t border-primary/20">
          <div className="text-xs text-muted-foreground mb-1.5">Servo Status</div>
          {hasError ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/40 rounded">
                <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse flex-shrink-0" />
                <span className="text-red-400 font-mono text-xs">{servoData?.error_code}</span>
              </div>
              <button
                onClick={handleClearError}
                className="w-full px-2 py-1 bg-red-500/30 hover:bg-red-500/50 border border-red-500/60 rounded text-xs transition-colors"
              >
                Clear Error
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 text-green-500">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs">OK</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ControlSectionProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function ControlSection({ title, icon, children, className = '' }: ControlSectionProps) {
  return (
    <div className={`border border-primary/30 rounded bg-black/40 p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      {children}
    </div>
  )
}

interface InputFieldProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number'
  placeholder?: string
  unit?: string
  min?: number
  max?: number
  step?: number
  className?: string
}

function InputField({ label, value, onChange, type = 'number', placeholder, unit, min, max, step, className = '' }: InputFieldProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{label}:</label>
      <div className="flex-1 flex items-center gap-1">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="flex-1 bg-black/60 border border-primary/30 rounded px-2 py-1 text-xs font-mono"
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

function ServoConsole() {
  const [selectedAxis, setSelectedAxis] = useState<ServoAxis>('az')
  const [consoleOutput, setConsoleOutput] = useState<CommandResponse[]>([])

  const config = SERVO_CONFIG[selectedAxis]

  // Motion state
  const [moveAbsTarget, setMoveAbsTarget] = useState('0')
  const [moveRelDelta, setMoveRelDelta] = useState('10')
  const [speedPct, setSpeedPct] = useState(10)
  const [movementMode, setMovementMode] = useState<'position' | 'speed' | 'hybrid'>('position')

  // Tracking mode state
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [statusBundle, setStatusBundle] = useState<any>(null)
  const [isButtonCooldown, setIsButtonCooldown] = useState(false)

  // Position lock state
  const [lockStates, setLockStates] = useState<{ AZ: boolean; EL: boolean; CL: boolean }>({ AZ: false, EL: false, CL: false })

  // Motion parameters state
  const [motionParams, setMotionParams] = useState({
    settling_time_ms: 800,
    working_current_ma: 1600,
    holding_current_ma: 800,
    idle_current_ma: 400,
    current_ramp_duration_ms: 250
  })
  const [showMotionParams, setShowMotionParams] = useState(false)

  // PID/ACC/Torque section state
  const [showPIDSection, setShowPIDSection] = useState(false)
  const [showPIDDangerModal, setShowPIDDangerModal] = useState(false)
  const [pendingPIDAction, setPendingPIDAction] = useState<(() => Promise<void>) | null>(null)

  // Default PID/ACC/Torque values from MKS SERVO42C CONTROL V1.1
  const DEFAULT_PID_VALUES = {
    kp: '1616',
    ki: '1',
    kd: '1616',
    acc: '286',
    torque: '1200'
  }

  // Load command history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const result = await servoApi.getCommandHistory(20)
        if (result.status === 'success' && result.commands) {
          setConsoleOutput(result.commands)
        }
      } catch (error) {
        console.error('Failed to load command history:', error)
      }
    }
    loadHistory()
  }, [])

  // Tracking mode: continuous polling of status bundle
  useEffect(() => {
    if (!trackingEnabled) return

    const pollStatusBundle = async () => {
      try {
        const result = await servoApi.readStatusBundle(selectedAxis)
        if (result.status === 'success' && result.response?.parsed) {
          setStatusBundle(result.response.parsed)
        }
      } catch (error) {
        console.error('Failed to poll status bundle:', error)
      }
    }

    // Poll immediately on enable
    pollStatusBundle()

    // Then poll every 100ms (similar to MKS app)
    const interval = setInterval(pollStatusBundle, 100)

    return () => clearInterval(interval)
  }, [trackingEnabled, selectedAxis])

  // Load current movement mode on mount
  useEffect(() => {
    const loadMovementMode = async () => {
      try {
        const result = await servoApi.getMovementMode()
        if (result.status === 'success' && result.mode) {
          setMovementMode(result.mode)
        }
      } catch (error) {
        console.error('Failed to load movement mode:', error)
      }
    }
    loadMovementMode()
  }, [])

  // Load lock states on mount
  useEffect(() => {
    const loadLockStates = async () => {
      try {
        const result = await servoApi.getLockStates()
        if (result.status === 'success' && result.lock_states) {
          setLockStates(result.lock_states)
        }
      } catch (error) {
        console.error('Failed to load lock states:', error)
      }
    }
    loadLockStates()
  }, [])

  // Load motion parameters on mount
  useEffect(() => {
    const loadMotionParams = async () => {
      try {
        const result = await servoApi.getMotionParams()
        if (result.status === 'success' && result.params) {
          setMotionParams(result.params)
        }
      } catch (error) {
        console.error('Failed to load motion parameters:', error)
      }
    }
    loadMotionParams()
  }, [])

  // Load servo parameters when selectedAxis changes
  useEffect(() => {
    const loadServoParams = async () => {
      try {
        const result = await servoApi.readAllParams(selectedAxis)
        if (result.status === 'success' && result.response?.parsed) {
          const params = result.response.parsed

          // Update all parameter fields
          if (params.current_ma !== undefined) setWorkCurrent(String(params.current_ma))
          if (params.hold_current_pct !== undefined) setHoldCurrent(String(params.hold_current_pct))
          if (params.microstep !== undefined) setMicrostep(String(params.microstep))
          if (params.mode !== undefined) setMode(String(params.mode))
          if (params.en_active !== undefined) setEnActive(String(params.en_active))
          if (params.direction !== undefined) setDirection(String(params.direction))
          if (params.kp !== undefined) setKp(String(params.kp))
          if (params.ki !== undefined) setKi(String(params.ki))
          if (params.kd !== undefined) setKd(String(params.kd))
          if (params.start_accel !== undefined) setStartAccel(String(params.start_accel))
          if (params.stop_accel !== undefined) setStopAccel(String(params.stop_accel))

          // Save as baseline for change detection
          setSavedParams({
            workCurrent: String(params.current_ma ?? ''),
            holdCurrent: String(params.hold_current_pct ?? ''),
            microstep: String(params.microstep ?? ''),
            mode: String(params.mode ?? ''),
            enActive: String(params.en_active ?? ''),
            direction: String(params.direction ?? ''),
            kp: String(params.kp ?? ''),
            ki: String(params.ki ?? ''),
            kd: String(params.kd ?? ''),
            startAccel: String(params.start_accel ?? ''),
            stopAccel: String(params.stop_accel ?? '')
          })

          setHasUnsavedChanges(false)
        }
      } catch (error) {
        console.error(`Failed to load params for ${selectedAxis}:`, error)
      }
    }
    loadServoParams()
  }, [selectedAxis])

  // Handle movement mode change
  const handleMovementModeChange = async (mode: 'position' | 'speed' | 'hybrid') => {
    try {
      const result = await servoApi.setMovementMode(mode)
      if (result.status === 'success') {
        setMovementMode(mode)
        addToConsole({
          axis: 'SYSTEM',
          command: 'set_movement_mode',
          request: { mode },
          response: { success: true, message: result.message },
          status: 'success',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Failed to set movement mode:', error)
      addToConsole({
        axis: 'SYSTEM',
        command: 'set_movement_mode',
        request: { mode },
        response: { success: false, message: String(error) },
        status: 'error',
        timestamp: new Date().toISOString()
      })
    }
  }

  // Handle lock position
  const handleLockPosition = async (axis: string) => {
    try {
      const result = await servoApi.lockPosition(axis)
      if (result.status === 'success') {
        setLockStates(prev => ({ ...prev, [axis.toUpperCase()]: true }))
        addToConsole({
          axis: axis.toUpperCase(),
          command: 'lock_position',
          request: { axis },
          response: { success: true, message: result.message },
          status: 'success',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error(`Failed to lock ${axis}:`, error)
      addToConsole({
        axis: axis.toUpperCase(),
        command: 'lock_position',
        request: { axis },
        response: { success: false, message: String(error) },
        status: 'error',
        timestamp: new Date().toISOString()
      })
    }
  }

  // Handle unlock position
  const handleUnlockPosition = async (axis: string) => {
    try {
      const result = await servoApi.unlockPosition(axis)
      if (result.status === 'success') {
        setLockStates(prev => ({ ...prev, [axis.toUpperCase()]: false }))
        addToConsole({
          axis: axis.toUpperCase(),
          command: 'unlock_position',
          request: { axis },
          response: { success: true, message: result.message },
          status: 'success',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error(`Failed to unlock ${axis}:`, error)
      addToConsole({
        axis: axis.toUpperCase(),
        command: 'unlock_position',
        request: { axis },
        response: { success: false, message: String(error) },
        status: 'error',
        timestamp: new Date().toISOString()
      })
    }
  }

  // Handle motion parameters update
  const handleMotionParamsUpdate = async () => {
    try {
      const result = await servoApi.setMotionParams(motionParams)
      if (result.status === 'success') {
        addToConsole({
          axis: 'SYSTEM',
          command: 'set_motion_params',
          request: motionParams,
          response: { success: true, message: result.message },
          status: 'success',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Failed to set motion parameters:', error)
      addToConsole({
        axis: 'SYSTEM',
        command: 'set_motion_params',
        request: motionParams,
        response: { success: false, message: String(error) },
        status: 'error',
        timestamp: new Date().toISOString()
      })
    }
  }

  // PID/ACC/Torque danger modal handlers
  const handlePIDApplyRequest = async (actionFn: () => Promise<void>) => {
    // Show danger modal and store the action to execute on confirmation
    setPendingPIDAction(() => actionFn)
    setShowPIDDangerModal(true)
  }

  const handlePIDDangerConfirm = async () => {
    if (pendingPIDAction) {
      try {
        await pendingPIDAction()
      } catch (error) {
        console.error('Failed to apply PID/ACC/Torque changes:', error)
      }
    }
    setShowPIDDangerModal(false)
    setPendingPIDAction(null)
  }

  const handlePIDDangerCancel = () => {
    setShowPIDDangerModal(false)
    setPendingPIDAction(null)
  }

  const handleResetPIDToDefaults = () => {
    setKp(DEFAULT_PID_VALUES.kp)
    setKi(DEFAULT_PID_VALUES.ki)
    setKd(DEFAULT_PID_VALUES.kd)
    setStartAccel(DEFAULT_PID_VALUES.acc)
    setStopAccel(DEFAULT_PID_VALUES.acc)
  }

  // Handlers that update savedParams after applying changes
  const handleApplyWorkCurrent = async () => {
    await handleCommand(() => servoApi.setWorkCurrent(selectedAxis, parseInt(workCurrent)), 'Set Work Current')
    // Update saved params baseline to prevent "unsaved changes" detection
    setSavedParams(prev => ({ ...prev, workCurrent }))
  }

  const handleApplyHoldCurrent = async () => {
    await handleCommand(() => servoApi.setHoldCurrent(selectedAxis, parseInt(holdCurrent)), 'Set Hold Current')
    setSavedParams(prev => ({ ...prev, holdCurrent }))
  }

  const handleApplyMicrostep = async () => {
    await handleCommand(() => servoApi.setMicrostep(selectedAxis, parseInt(microstep)), 'Set Microstep')
    setSavedParams(prev => ({ ...prev, microstep }))
  }

  const handleApplyMode = async () => {
    await handleCommand(() => servoApi.setMode(selectedAxis, parseInt(mode)), 'Set Mode')
    setSavedParams(prev => ({ ...prev, mode }))
  }

  const handleApplyEnActive = async () => {
    await handleCommand(() => servoApi.setEnActive(selectedAxis, parseInt(enActive)), 'Set EN Active')
    setSavedParams(prev => ({ ...prev, enActive }))
  }

  const handleApplyDirection = async () => {
    await handleCommand(() => servoApi.setDirection(selectedAxis, parseInt(direction)), 'Set Direction')
    setSavedParams(prev => ({ ...prev, direction }))
  }

  // Handle axis selection with unsaved changes check
  const handleAxisChange = (newAxis: ServoAxis) => {
    if (hasUnsavedChanges) {
      setPendingAxisChange(newAxis)
      setShowUnsavedModal(true)
    } else {
      setSelectedAxis(newAxis)
    }
  }

  // Modal action: Discard changes and switch axis
  const handleDiscardChanges = () => {
    if (pendingAxisChange) {
      setSelectedAxis(pendingAxisChange)
      setPendingAxisChange(null)
    }
    setShowUnsavedModal(false)
    setHasUnsavedChanges(false)
  }

  // Modal action: Apply all pending changes
  const handleApplyPendingChanges = async () => {
    // Apply all changed parameters
    const promises: Promise<any>[] = []

    if (workCurrent !== savedParams.workCurrent) {
      promises.push(servoApi.setWorkCurrent(selectedAxis, parseInt(workCurrent)))
    }
    if (holdCurrent !== savedParams.holdCurrent) {
      promises.push(servoApi.setHoldCurrent(selectedAxis, parseInt(holdCurrent)))
    }
    if (microstep !== savedParams.microstep) {
      promises.push(servoApi.setMicrostep(selectedAxis, parseInt(microstep)))
    }
    if (mode !== savedParams.mode) {
      promises.push(servoApi.setMode(selectedAxis, parseInt(mode)))
    }
    if (enActive !== savedParams.enActive) {
      promises.push(servoApi.setEnActive(selectedAxis, parseInt(enActive)))
    }
    if (direction !== savedParams.direction) {
      promises.push(servoApi.setDirection(selectedAxis, parseInt(direction)))
    }
    // PID - use combined setPID method if any changed
    if ((kp !== savedParams.kp && kp !== '') ||
        (ki !== savedParams.ki && ki !== '') ||
        (kd !== savedParams.kd && kd !== '')) {
      promises.push(servoApi.setPID(
        selectedAxis,
        kp !== '' ? parseInt(kp) : undefined,
        ki !== '' ? parseInt(ki) : undefined,
        kd !== '' ? parseInt(kd) : undefined
      ))
    }
    // Acceleration - use combined setAcceleration method if any changed
    if ((startAccel !== savedParams.startAccel && startAccel !== '') ||
        (stopAccel !== savedParams.stopAccel && stopAccel !== '')) {
      promises.push(servoApi.setAcceleration(
        selectedAxis,
        startAccel !== '' ? parseInt(startAccel) : undefined,
        stopAccel !== '' ? parseInt(stopAccel) : undefined
      ))
    }

    try {
      await Promise.all(promises)
      addToConsole({
        axis: selectedAxis.toUpperCase(),
        command: 'apply_pending_changes',
        request: { count: promises.length },
        response: { success: true, message: `Applied ${promises.length} parameter changes` },
        status: 'success',
        timestamp: new Date().toISOString()
      })

      // Update saved params
      setSavedParams({
        workCurrent,
        holdCurrent,
        microstep,
        mode,
        enActive,
        direction,
        kp,
        ki,
        kd,
        startAccel,
        stopAccel
      })

      setHasUnsavedChanges(false)

      // Now switch to pending axis
      if (pendingAxisChange) {
        setSelectedAxis(pendingAxisChange)
        setPendingAxisChange(null)
      }
      setShowUnsavedModal(false)
    } catch (error) {
      console.error('Failed to apply pending changes:', error)
      addToConsole({
        axis: selectedAxis.toUpperCase(),
        command: 'apply_pending_changes',
        request: { count: promises.length },
        response: { success: false, message: String(error) },
        status: 'error',
        timestamp: new Date().toISOString()
      })
    }
  }

  // Modal action: Cancel (stay on current axis)
  const handleCancelAxisChange = () => {
    setPendingAxisChange(null)
    setShowUnsavedModal(false)
  }

  // Homing state (limit-based for Az)
  const [hmTrig, setHmTrig] = useState<'low' | 'high'>('low')
  const [hmDir, setHmDir] = useState<'cw' | 'ccw'>('ccw')
  const [hmSpeed, setHmSpeed] = useState('200')
  const [endLimitEnable, setEndLimitEnable] = useState(true)

  // Homing state (stall-based for El/CL)
  const [hmCurrentMa, setHmCurrentMa] = useState('400')
  const [retValueDeg, setRetValueDeg] = useState('180')

  // Protection
  const [protectEnabled, setProtectEnabled] = useState(true)

  // Configuration state (dynamic per-axis) - initialized empty, loaded from servo via readAllParams
  const [workCurrent, setWorkCurrent] = useState('')
  const [holdCurrent, setHoldCurrent] = useState('')
  const [microstep, setMicrostep] = useState('')
  const [mode, setMode] = useState('')
  const [enActive, setEnActive] = useState('')
  const [direction, setDirection] = useState('')

  // PID state
  const [kp, setKp] = useState('')
  const [ki, setKi] = useState('')
  const [kd, setKd] = useState('')
  const [startAccel, setStartAccel] = useState('')
  const [stopAccel, setStopAccel] = useState('')

  // Saved parameter state (for unsaved changes detection)
  const [savedParams, setSavedParams] = useState({
    workCurrent: '',
    holdCurrent: '',
    microstep: '',
    mode: '',
    enActive: '',
    direction: '',
    kp: '',
    ki: '',
    kd: '',
    startAccel: '',
    stopAccel: ''
  })

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [pendingAxisChange, setPendingAxisChange] = useState<ServoAxis | null>(null)

  // Detect unsaved changes
  useEffect(() => {
    const changed =
      workCurrent !== savedParams.workCurrent ||
      holdCurrent !== savedParams.holdCurrent ||
      microstep !== savedParams.microstep ||
      mode !== savedParams.mode ||
      enActive !== savedParams.enActive ||
      direction !== savedParams.direction ||
      kp !== savedParams.kp ||
      ki !== savedParams.ki ||
      kd !== savedParams.kd ||
      startAccel !== savedParams.startAccel ||
      stopAccel !== savedParams.stopAccel

    setHasUnsavedChanges(changed)
  }, [workCurrent, holdCurrent, microstep, mode, enActive, direction, kp, ki, kd, startAccel, stopAccel, savedParams])

  // Raw UART
  const [rawHexInput, setRawHexInput] = useState('')
  const [showRawTranslated, setShowRawTranslated] = useState(false)

  // Display mode (hex/decimal)
  const [displayMode, setDisplayMode] = useState<'hex' | 'decimal'>('decimal')

  // IO Control state
  const [out1State, setOut1State] = useState<number | null>(null)  // null=don't write, 0=write 0, 1=write 1
  const [out2State, setOut2State] = useState<number | null>(null)

  const addToConsole = (response: CommandResponse) => {
    setConsoleOutput(prev => [response, ...prev].slice(0, 30))
  }

  // Format numeric value based on display mode
  const formatNumeric = (value: number | undefined, prefix: string = ''): string => {
    if (value === undefined) return '--'
    if (displayMode === 'hex') {
      return prefix + '0x' + value.toString(16).toUpperCase()
    }
    return prefix + value.toString()
  }

  // Format command response for console display with translations
  const formatResponseForDisplay = (output: CommandResponse): string => {
    const lines: string[] = []

    // Add command info
    if (output.command) {
      lines.push(`Command: ${output.command}`)
      lines.push(`Status: ${output.status}`)
      lines.push('')
    }

    // Special handling for status bundle (0x48)
    if (output.command === 'read_status_bundle' && output.response?.parsed) {
      const p = output.response.parsed
      lines.push('=== PARSED STATUS BUNDLE ===')
      lines.push('')
      lines.push(`Encoder Position: ${p.encoder_value || 0} counts (${p.encoder_deg?.toFixed(2) || '0.00'}°)`)
      lines.push(`Encoder Carry: ${p.encoder_carry || 0}`)
      lines.push('')
      lines.push(`Speed: ${p.speed_rpm || 0} RPM`)
      lines.push(`Direction: ${p.speed_direction || 'STOP'}`)
      lines.push('')
      lines.push(`Pulse Count: ${p.pulses || 0}`)
      lines.push(`Angle Error: ${p.angle_error_counts || 0} counts (${p.angle_error_deg?.toFixed(3) || '0.000'}°)`)
      lines.push('')
      lines.push(`EN Status: ${p.en_enabled ? 'ENABLED' : 'DISABLED'}`)
      lines.push(`Zero Status: ${p.zero_status_text?.toUpperCase() || 'UNKNOWN'}`)
      lines.push(`Stall Protected: ${p.stall_protected ? 'YES' : 'NO'}`)
      lines.push('')
      if (p.io_state) {
        lines.push('I/O States:')
        lines.push(`  IN1: ${p.io_state.IN1 ? 'HIGH' : 'LOW'}`)
        lines.push(`  IN2: ${p.io_state.IN2 ? 'HIGH' : 'LOW'}`)
        lines.push(`  OUT1: ${p.io_state.OUT1 ? 'HIGH' : 'LOW'}`)
        lines.push(`  OUT2: ${p.io_state.OUT2 ? 'HIGH' : 'LOW'}`)
      }
      lines.push('')
      lines.push('=== RAW HEX ===')
      lines.push(`Received: ${output.response.hex_received || 'N/A'}`)
    }
    // Special handling for full status
    else if (output.command === 'full_status' && output.data) {
      const data = output.data
      lines.push('=== FULL SERVO STATUS ===')
      lines.push('')
      lines.push(`Address: ${data.address}`)
      lines.push(`Online: ${data.online ? 'YES' : 'NO'}`)
      lines.push('')
      if (data.current_deg !== undefined) lines.push(`Current Position: ${data.current_deg.toFixed(2)}°`)
      if (data.target_deg !== undefined) lines.push(`Target Position: ${data.target_deg.toFixed(2)}°`)
      if (data.error_deg !== undefined) lines.push(`Position Error: ${data.error_deg.toFixed(3)}°`)
      lines.push('')
      if (data.speed_rpm !== undefined) lines.push(`Speed: ${data.speed_rpm} RPM`)
      if (data.current_ma !== undefined) lines.push(`Current: ${data.current_ma} mA`)
      if (data.temp_c !== undefined) lines.push(`Temperature: ${data.temp_c}°C`)
      lines.push('')
      if (data.encoder_value !== undefined) lines.push(`Encoder Value: ${data.encoder_value}`)
      if (data.protect_flag !== undefined) lines.push(`Protect Flag: ${data.protect_flag}`)
      lines.push('')
      if (data.io) {
        lines.push('I/O States:')
        lines.push(`  IN1: ${data.io.IN1 ? 'HIGH' : 'LOW'}`)
        lines.push(`  IN2: ${data.io.IN2 ? 'HIGH' : 'LOW'}`)
        lines.push(`  OUT1: ${data.io.OUT1 ? 'HIGH' : 'LOW'}`)
        lines.push(`  OUT2: ${data.io.OUT2 ? 'HIGH' : 'LOW'}`)
      }
      if (data.message) {
        lines.push('')
        lines.push(`Message: ${data.message}`)
      }
    }
    // Special handling for IO read
    else if (output.command === 'read_io' && output.response) {
      lines.push('=== I/O BITMAP ===')
      lines.push('')
      if (output.response.io_states) {
        lines.push(`IN1: ${output.response.io_states.IN1 ? 'HIGH' : 'LOW'}`)
        lines.push(`IN2: ${output.response.io_states.IN2 ? 'HIGH' : 'LOW'}`)
        lines.push(`OUT1: ${output.response.io_states.OUT1 ? 'HIGH' : 'LOW'}`)
        lines.push(`OUT2: ${output.response.io_states.OUT2 ? 'HIGH' : 'LOW'}`)
        lines.push('')
        lines.push(`Raw Bitmap: 0x${output.response.raw_bitmap?.toString(16).toUpperCase().padStart(2, '0')}`)
      }
      if (output.response.hex_received) {
        lines.push('')
        lines.push(`Hex Received: ${output.response.hex_received}`)
      }
    }
    // Special handling for read speed
    else if (output.command === 'read_speed' && output.response) {
      lines.push('=== SPEED READING ===')
      lines.push('')
      lines.push(`Speed: ${output.response.speed_rpm || 0} RPM`)
      if (output.response.direction) {
        lines.push(`Direction: ${output.response.direction}`)
      }
      if (output.response.hex_received) {
        lines.push('')
        lines.push(`Hex Received: ${output.response.hex_received}`)
      }
    }
    // Special handling for angle error
    else if (output.command === 'read_angle_error' && output.response) {
      lines.push('=== ANGLE ERROR ===')
      lines.push('')
      lines.push(`Error: ${output.response.angle_error_deg?.toFixed(3) || '0.000'}°`)
      lines.push(`Error (counts): ${output.response.angle_error_counts || 0}`)
      if (output.response.hex_received) {
        lines.push('')
        lines.push(`Hex Received: ${output.response.hex_received}`)
      }
    }
    // Special handling for EN pin
    else if (output.command === 'read_en_pin' && output.response) {
      lines.push('=== EN PIN STATE ===')
      lines.push('')
      lines.push(`EN Pin: ${output.response.enabled ? 'ENABLED' : 'DISABLED'}`)
      lines.push(`Raw Value: ${output.response.raw_value}`)
      if (output.response.hex_received) {
        lines.push('')
        lines.push(`Hex Received: ${output.response.hex_received}`)
      }
    }
    // Special handling for read all params
    else if (output.command === 'read_all_params' && output.response) {
      lines.push('=== ALL CONFIGURATION PARAMETERS ===')
      lines.push('')
      lines.push(`Length: ${output.response.length} bytes`)
      lines.push('')
      lines.push(`Hex Data: ${output.response.params_hex || 'N/A'}`)
      if (output.response.hex_received) {
        lines.push('')
        lines.push(`Full Frame: ${output.response.hex_received}`)
      }
    }
    // Generic response formatting
    else if (output.response) {
      if (output.response.message) {
        lines.push(`Message: ${output.response.message}`)
      }
      if (output.response.hex_received) {
        lines.push('')
        lines.push(`Hex Received: ${output.response.hex_received}`)
      }
    }

    // Add error message if present
    if (output.message && output.status === 'error') {
      lines.push('')
      lines.push(`ERROR: ${output.message}`)
    }

    return lines.join('\n')
  }

  const handleCommand = async (commandFn: () => Promise<CommandResponse>, label: string) => {
    // Button cooldown protection (prevents command flooding)
    if (isButtonCooldown) return

    // Disable tracking mode temporarily when manual command is sent
    const wasTracking = trackingEnabled
    if (wasTracking) {
      setTrackingEnabled(false)
    }

    try {
      const response = await commandFn()
      addToConsole(response)
    } catch (error) {
      addToConsole({
        status: 'error',
        axis: selectedAxis.toUpperCase(),
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      // Apply 300ms cooldown
      setIsButtonCooldown(true)
      setTimeout(() => {
        setIsButtonCooldown(false)
        // Re-enable tracking mode if it was active
        if (wasTracking) {
          setTrackingEnabled(true)
        }
      }, 300)
    }
  }

  return (
    <div className="space-y-4">
      {/* Servo Selector */}
      <div className="border border-primary/30 rounded bg-black/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">SELECT SERVO</label>
          {hasUnsavedChanges && (
            <span className="text-xs font-semibold text-warning bg-warning/20 px-2 py-0.5 rounded border border-warning/50">
              ⚠ Unsaved Changes
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SERVO_CONFIG) as ServoAxis[]).map(axis => {
            const cfg = SERVO_CONFIG[axis]
            return (
              <button
                key={axis}
                onClick={() => handleAxisChange(axis)}
                className={`p-2 rounded text-xs border transition-colors ${
                  selectedAxis === axis
                    ? 'bg-primary/30 border-primary/50 text-primary'
                    : 'bg-black/40 border-primary/30 hover:bg-primary/10'
                }`}
              >
                <div className="font-semibold">{axis.toUpperCase()}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {cfg.model} • 0x{cfg.address.toString(16).toUpperCase().padStart(2, '0')}
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-2 p-2 bg-primary/5 rounded text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model:</span>
            <span className="font-semibold">MKS SERVO{config.model} v1.0.6</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Homing:</span>
            <span className="font-semibold">{config.hasLimitSwitches ? 'Limit Switches' : 'Stall Detection'}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">I/O:</span>
            <span className="font-semibold">{config.io.inputs} IN / {config.io.outputs} OUT</span>
          </div>
        </div>
        <div className="mt-2 p-2 bg-success/10 border border-success/30 rounded text-xs">
          <div className="font-semibold text-success mb-1">💡 Recommended for Antenna/CNC:</div>
          <div className="text-muted-foreground">
            Mode: <span className="font-semibold text-foreground">CR_Open (0)</span> or <span className="font-semibold text-foreground">SR_Open (3)</span> - Eliminates oscillation with high-inertia loads
          </div>
        </div>
      </div>

      {/* Movement Mode Selector */}
      <div className="border border-primary/30 rounded bg-black/40 p-3">
        <label className="block text-xs font-medium text-muted-foreground mb-2">MOVEMENT MODE</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleMovementModeChange('position')}
            className={`p-2 rounded text-xs border transition-colors ${
              movementMode === 'position'
                ? 'bg-primary/30 border-primary/50 text-primary'
                : 'bg-black/40 border-primary/30 hover:bg-primary/10'
            }`}
          >
            <div className="font-semibold">Position</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Discrete moves
            </div>
          </button>
          <button
            onClick={() => handleMovementModeChange('speed')}
            className={`p-2 rounded text-xs border transition-colors ${
              movementMode === 'speed'
                ? 'bg-primary/30 border-primary/50 text-primary'
                : 'bg-black/40 border-primary/30 hover:bg-primary/10'
            }`}
          >
            <div className="font-semibold">Speed</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Continuous RPM
            </div>
          </button>
          <button
            disabled
            title="Hybrid mode disabled - causes double-loop oscillation"
            className="p-2 rounded text-xs border transition-colors bg-black/40 border-error/30 opacity-50 cursor-not-allowed"
          >
            <div className="font-semibold text-error">Hybrid (Disabled)</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Pending redesign
            </div>
          </button>
        </div>
        <div className="mt-2 p-2 bg-primary/5 rounded text-xs">
          <div className="text-muted-foreground">
            {movementMode === 'position' && '📍 Position Mode: Discrete absolute/relative position commands with position hold'}
            {movementMode === 'speed' && '⚡ Speed Mode: Continuous velocity control, no position hold (good for manual control)'}
            {movementMode === 'hybrid' && '🎯 Hybrid Mode: Intelligent tracking with auto mode-switching (eliminates jitter, smooth tracking)'}
          </div>
        </div>
      </div>

      {/* Position Lock Controls */}
      <div className="border border-primary/30 rounded bg-black/40 p-3">
        <label className="block text-xs font-medium text-muted-foreground mb-2">POSITION LOCKING</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {(['AZ', 'EL', 'CL'] as const).map(axis => {
            const isLocked = lockStates[axis]
            return (
              <button
                key={axis}
                onClick={() => isLocked ? handleUnlockPosition(axis) : handleLockPosition(axis)}
                className={`p-2 rounded text-xs border transition-colors ${
                  isLocked
                    ? 'bg-success/20 border-success/50 text-success'
                    : 'bg-black/40 border-primary/30 hover:bg-primary/10'
                }`}
              >
                <div className="font-semibold">{axis} {isLocked ? '🔒' : '🔓'}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {isLocked ? 'Locked' : 'Unlocked'}
                </div>
              </button>
            )
          })}
        </div>
        <div className="p-2 bg-primary/5 rounded text-xs text-muted-foreground">
          Lock: Engage holding current to prevent drift • Unlock: Coast freely with minimal current
        </div>
      </div>

      {/* Motion Parameters (Anti-Oscillation Tuning) */}
      <div className="border border-primary/30 rounded bg-black/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">MOTION PARAMETERS</label>
          <button
            onClick={() => setShowMotionParams(!showMotionParams)}
            className="text-xs text-primary hover:underline"
          >
            {showMotionParams ? 'Hide' : 'Show'}
          </button>
        </div>
        {showMotionParams && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Settling Time (ms)</label>
              <input
                type="number"
                value={motionParams.settling_time_ms}
                onChange={(e) => setMotionParams(prev => ({ ...prev, settling_time_ms: parseInt(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-black border border-primary/30 rounded mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Working Current (mA)</label>
              <input
                type="number"
                value={motionParams.working_current_ma}
                onChange={(e) => setMotionParams(prev => ({ ...prev, working_current_ma: parseInt(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-black border border-primary/30 rounded mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Holding Current (mA)</label>
              <input
                type="number"
                value={motionParams.holding_current_ma}
                onChange={(e) => setMotionParams(prev => ({ ...prev, holding_current_ma: parseInt(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-black border border-primary/30 rounded mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Idle Current (mA)</label>
              <input
                type="number"
                value={motionParams.idle_current_ma}
                onChange={(e) => setMotionParams(prev => ({ ...prev, idle_current_ma: parseInt(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-black border border-primary/30 rounded mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Current Ramp Duration (ms)</label>
              <input
                type="number"
                value={motionParams.current_ramp_duration_ms}
                onChange={(e) => setMotionParams(prev => ({ ...prev, current_ramp_duration_ms: parseInt(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-sm bg-black border border-primary/30 rounded mt-1"
              />
            </div>
            <button
              onClick={handleMotionParamsUpdate}
              className="w-full px-3 py-2 text-sm font-semibold bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded transition-colors"
            >
              Apply Parameters
            </button>
            <div className="text-xs text-muted-foreground p-2 bg-primary/5 rounded">
              Tune these parameters to eliminate oscillation. Lower holding current reduces fighting. Longer settling time allows momentum to dissipate.
            </div>
          </div>
        )}
      </div>

      {/* Live Tracking Mode */}
      <div className="border border-primary/30 rounded bg-black/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">LIVE TRACKING MODE</label>
          <div className="flex items-center gap-3">
            {/* Display Mode Toggle */}
            <div className="flex items-center gap-1 border border-primary/30 rounded px-2 py-1">
              <button
                onClick={() => setDisplayMode('decimal')}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  displayMode === 'decimal' ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                DEC
              </button>
              <button
                onClick={() => setDisplayMode('hex')}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  displayMode === 'hex' ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                HEX
              </button>
            </div>

            {/* Tracking Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trackingEnabled}
                onChange={(e) => setTrackingEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-xs font-semibold">{trackingEnabled ? 'ACTIVE' : 'DISABLED'}</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Continuously poll servo status at 10Hz (100ms interval) using efficient bulk read command (0x48)
        </div>

        {/* Real-time Status Display */}
        {trackingEnabled && statusBundle && (
          <div className="mt-3 p-2 bg-primary/5 rounded space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Encoder:</span>
                <span className="font-mono font-semibold">
                  {displayMode === 'hex'
                    ? formatNumeric(statusBundle.encoder_value)
                    : (statusBundle.encoder_deg?.toFixed(2) || '--')}
                  {displayMode === 'decimal' && '°'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed:</span>
                <span className="font-mono">{statusBundle.speed_rpm || 0} RPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direction:</span>
                <span className={`font-mono ${statusBundle.speed_direction === 'STOP' ? 'text-gray-500' : 'text-primary'}`}>
                  {statusBundle.speed_direction || '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pulses:</span>
                <span className="font-mono">{formatNumeric(statusBundle.pulses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Angle Error:</span>
                <span className={`font-mono ${Math.abs(statusBundle.angle_error_deg || 0) > 5 ? 'text-yellow-400' : 'text-green-500'}`}>
                  {displayMode === 'hex'
                    ? formatNumeric(statusBundle.angle_error_counts)
                    : (statusBundle.angle_error_deg?.toFixed(3) || '--') + '°'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">EN Status:</span>
                <span className={`font-mono ${statusBundle.en_enabled ? 'text-green-500' : 'text-red-500'}`}>
                  {statusBundle.en_enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zero State:</span>
                <span className="font-mono text-xs">{statusBundle.zero_status_text?.toUpperCase() || '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stall:</span>
                <span className={`font-mono ${statusBundle.stall_protected ? 'text-yellow-400' : 'text-green-500'}`}>
                  {statusBundle.stall_protected ? 'PROTECTED' : 'OK'}
                </span>
              </div>
            </div>

            {/* IO Status from bundle */}
            {statusBundle.io_state && (
              <div className="border-t border-primary/20 pt-2 mt-2">
                <div className="text-xs text-muted-foreground mb-1.5">I/O Status (Live)</div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">IN1</span>
                    <div className={`w-2 h-2 rounded-full ${statusBundle.io_state.IN1 ? 'bg-red-500' : 'bg-green-500'}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">IN2</span>
                    <div className={`w-2 h-2 rounded-full ${statusBundle.io_state.IN2 ? 'bg-red-500' : 'bg-green-500'}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">OUT1</span>
                    <div className={`w-2 h-2 rounded-full ${statusBundle.io_state.OUT1 ? 'bg-yellow-500' : 'bg-gray-600'}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">OUT2</span>
                    <div className={`w-2 h-2 rounded-full ${statusBundle.io_state.OUT2 ? 'bg-yellow-500' : 'bg-gray-600'}`} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {trackingEnabled && !statusBundle && (
          <div className="mt-3 p-2 bg-primary/5 rounded text-xs text-center text-muted-foreground italic">
            Connecting to servo...
          </div>
        )}
      </div>

      {/* Two-column layout for controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Motion Commands */}
          <ControlSection title="Motion Control" icon={<Zap className="w-4 h-4" />}>
            <div className="space-y-2">
              <InputField
                label="Target"
                value={moveAbsTarget}
                onChange={setMoveAbsTarget}
                unit="deg"
                step={0.1}
              />
              <button
                onClick={() => handleCommand(
                  () => servoApi.moveAbsolute(selectedAxis, parseFloat(moveAbsTarget), speedPct),
                  'Move Absolute'
                )}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Move Absolute
              </button>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              <InputField
                label="Delta"
                value={moveRelDelta}
                onChange={setMoveRelDelta}
                unit="deg"
                step={0.1}
              />
              <button
                onClick={() => handleCommand(
                  () => servoApi.moveRelative(selectedAxis, parseFloat(moveRelDelta), speedPct),
                  'Move Relative'
                )}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Move Relative
              </button>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              <label className="block text-xs text-muted-foreground mb-1">Speed: {speedPct}%</label>
              <input
                type="range"
                min="1"
                max="100"
                value={speedPct}
                onChange={(e) => setSpeedPct(parseInt(e.target.value))}
                className="w-full h-2 bg-black/60 rounded-lg appearance-none cursor-pointer accent-primary"
              />

              <div className="border-t border-primary/20 pt-2 mt-2" />

              <label className="block text-xs text-muted-foreground mb-1.5">Continuous Jog</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onMouseDown={() => handleCommand(() => servoApi.jog(selectedAxis, 'cw', speedPct), 'Jog CW')}
                  onMouseUp={() => handleCommand(() => servoApi.stop(selectedAxis), 'Stop')}
                  onMouseLeave={() => handleCommand(() => servoApi.stop(selectedAxis), 'Stop')}
                  className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-xs font-semibold transition-colors"
                >
                  ← CW
                </button>
                <button
                  onMouseDown={() => handleCommand(() => servoApi.jog(selectedAxis, 'ccw', speedPct), 'Jog CCW')}
                  onMouseUp={() => handleCommand(() => servoApi.stop(selectedAxis), 'Stop')}
                  onMouseLeave={() => handleCommand(() => servoApi.stop(selectedAxis), 'Stop')}
                  className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-xs font-semibold transition-colors"
                >
                  CCW →
                </button>
              </div>

              <button
                onClick={() => handleCommand(() => servoApi.stop(selectedAxis), 'Emergency Stop')}
                className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs font-bold transition-colors mt-2"
              >
                ⏹ EMERGENCY STOP
              </button>
            </div>
          </ControlSection>

          {/* Protection */}
          <ControlSection title="Protection & Maintenance" icon={<Settings className="w-4 h-4" />}>
            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground mb-1">Locked-Rotor Protection</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setProtectEnabled(true)
                    handleCommand(() => servoApi.setProtect(selectedAxis, true), 'Protect ON')
                  }}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    protectEnabled
                      ? 'bg-green-500/20 border-green-500/40'
                      : 'bg-black/40 border-primary/30 hover:bg-primary/20'
                  }`}
                >
                  Enable
                </button>
                <button
                  onClick={() => {
                    setProtectEnabled(false)
                    handleCommand(() => servoApi.setProtect(selectedAxis, false), 'Protect OFF')
                  }}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    !protectEnabled
                      ? 'bg-red-500/20 border-red-500/40'
                      : 'bg-black/40 border-primary/30 hover:bg-primary/20'
                  }`}
                >
                  Disable
                </button>
              </div>

              <button
                onClick={() => handleCommand(() => servoApi.releaseLockedRotor(selectedAxis), 'Release Locked-Rotor')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors mt-2"
              >
                Release Locked-Rotor
              </button>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              <button
                onClick={() => handleCommand(() => servoApi.restartDevice(selectedAxis), 'Restart Device')}
                className="w-full px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded text-xs transition-colors"
              >
                Restart Device (Soft Reboot)
              </button>

              <button
                onClick={() => {
                  if (window.confirm(`⚠️ WARNING: This will restore ${selectedAxis.toUpperCase()} servo to factory defaults and reboot the device. Continue?`)) {
                    handleCommand(() => servoApi.factoryReset(selectedAxis), 'Factory Reset')
                  }
                }}
                className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs transition-colors"
              >
                Restore Factory Defaults
              </button>
            </div>
          </ControlSection>

          {/* Motor Configuration */}
          <ControlSection title="Motor Configuration" icon={<Settings className="w-4 h-4" />}>
            <div className="space-y-2">
              <InputField
                label="Work Current"
                value={workCurrent}
                onChange={setWorkCurrent}
                unit="mA"
                min={0}
                max={config.currentLimitWork_mA}
                step={100}
              />
              <button
                onClick={handleApplyWorkCurrent}
                className="w-full px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs"
              >
                Apply Work Current
              </button>

              <InputField
                label="Hold Current"
                value={holdCurrent}
                onChange={setHoldCurrent}
                unit="%"
                min={10}
                max={90}
                step={10}
              />
              <button
                onClick={handleApplyHoldCurrent}
                className="w-full px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs"
              >
                Apply Hold Current
              </button>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              <label className="block text-xs text-muted-foreground mb-1">Control Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full bg-black/60 border border-primary/30 rounded px-2 py-1 text-xs mb-1"
              >
                <option value="0">CR_OPEN</option>
                <option value="1">CR_CLOSE</option>
                <option value="2">CR_vFOC</option>
                <option value="3">SR_OPEN</option>
                <option value="4">SR_CLOSE</option>
                <option value="5">SR_vFOC (recommended)</option>
              </select>
              <button
                onClick={handleApplyMode}
                className="w-full px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs"
              >
                Apply Mode
              </button>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              <label className="block text-xs text-muted-foreground mb-1">Microstep</label>
              <select
                value={microstep}
                onChange={(e) => setMicrostep(e.target.value)}
                className="w-full bg-black/60 border border-primary/30 rounded px-2 py-1 text-xs mb-1"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="4">4</option>
                <option value="8">8</option>
                <option value="16">16</option>
                <option value="32">32</option>
                <option value="64">64</option>
                <option value="128">128</option>
                <option value="256">256</option>
              </select>
              <button
                onClick={handleApplyMicrostep}
                className="w-full px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs"
              >
                Apply Microstep
              </button>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              {/* Microstep Interpolation (0x89) */}
              <label className="block text-xs text-muted-foreground mb-1.5">Microstep Interpolation (0x89)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCommand(() => servoApi.setMicrostepInterpolation(selectedAxis, true), 'Enable Microstep Interp')}
                  className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded text-xs"
                >
                  Enable
                </button>
                <button
                  onClick={() => handleCommand(() => servoApi.setMicrostepInterpolation(selectedAxis, false), 'Disable Microstep Interp')}
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs"
                >
                  Disable
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 italic">
                Smooths movement by interpolating between microsteps (256 subdivisions)
              </p>

              <div className="border-t border-primary/20 pt-2 mt-2" />

              {/* Key Lock (0x8F) */}
              <label className="block text-xs text-muted-foreground mb-1.5">Physical Button Lock (0x8F)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCommand(() => servoApi.setKeyLock(selectedAxis, true), 'Lock Buttons')}
                  className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded text-xs"
                >
                  Lock
                </button>
                <button
                  onClick={() => handleCommand(() => servoApi.setKeyLock(selectedAxis, false), 'Unlock Buttons')}
                  className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded text-xs"
                >
                  Unlock
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 italic">
                Prevents accidental parameter changes from servo's physical buttons
              </p>
            </div>
          </ControlSection>

          {/* PID/ACC/Torque Configuration (Advanced - Dangerous) */}
          <div className="border border-red-500/40 rounded bg-black/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-red-400 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                PID / ACCELERATION / TORQUE
                <span className="text-xs font-normal text-red-400/70">(⚠ CAUTION)</span>
              </label>
              <button
                onClick={() => setShowPIDSection(!showPIDSection)}
                className="text-xs text-red-400 hover:underline"
              >
                {showPIDSection ? 'Hide' : 'Show'}
              </button>
            </div>
            {showPIDSection && (
              <div className="space-y-3">
                {/* Warning Banner */}
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                  <div className="text-xs text-red-400 font-semibold mb-1">⚠ WARNING</div>
                  <div className="text-xs text-muted-foreground">
                    Improper setting of these parameters may damage the motherboard. Please set carefully and don't modify if you are not sure.
                  </div>
                </div>

                {/* Reset to Defaults Button */}
                <button
                  onClick={handleResetPIDToDefaults}
                  className="w-full px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-xs font-semibold transition-colors"
                >
                  Reset to MKS Defaults
                </button>

                {/* PID Parameters */}
                <div className="border-t border-red-500/20 pt-3">
                  <label className="text-xs font-semibold text-red-300 mb-2 block">PID Parameters</label>
                  <div className="space-y-2">
                    <InputField
                      label="Kp"
                      value={kp}
                      onChange={setKp}
                      type="number"
                      placeholder={`Default: ${DEFAULT_PID_VALUES.kp}`}
                    />
                    <InputField
                      label="Ki"
                      value={ki}
                      onChange={setKi}
                      type="number"
                      placeholder={`Default: ${DEFAULT_PID_VALUES.ki}`}
                    />
                    <InputField
                      label="Kd"
                      value={kd}
                      onChange={setKd}
                      type="number"
                      placeholder={`Default: ${DEFAULT_PID_VALUES.kd}`}
                    />
                    <button
                      onClick={() => handlePIDApplyRequest(async () => {
                        await handleCommand(
                          () => servoApi.setPID(
                            selectedAxis,
                            kp ? parseInt(kp) : undefined,
                            ki ? parseInt(ki) : undefined,
                            kd ? parseInt(kd) : undefined
                          ),
                          'Set PID'
                        )
                      })}
                      className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs font-semibold transition-colors"
                    >
                      Apply PID Values
                    </button>
                  </div>
                </div>

                {/* Acceleration Parameters */}
                <div className="border-t border-red-500/20 pt-3">
                  <label className="text-xs font-semibold text-red-300 mb-2 block">Acceleration Parameters</label>
                  <div className="space-y-2">
                    <InputField
                      label="Start Accel"
                      value={startAccel}
                      onChange={setStartAccel}
                      type="number"
                      placeholder={`Default: ${DEFAULT_PID_VALUES.acc} (Range: 1-255)`}
                    />
                    <InputField
                      label="Stop Accel"
                      value={stopAccel}
                      onChange={setStopAccel}
                      type="number"
                      placeholder={`Default: ${DEFAULT_PID_VALUES.acc} (Range: 1-255)`}
                    />
                    <button
                      onClick={() => handlePIDApplyRequest(async () => {
                        await handleCommand(
                          () => servoApi.setAcceleration(
                            selectedAxis,
                            startAccel ? parseInt(startAccel) : undefined,
                            stopAccel ? parseInt(stopAccel) : undefined
                          ),
                          'Set Acceleration'
                        )
                      })}
                      className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs font-semibold transition-colors"
                    >
                      Apply Acceleration
                    </button>
                  </div>
                </div>

                {/* Help Text */}
                <div className="text-xs text-muted-foreground p-2 bg-red-500/5 rounded">
                  <div className="font-semibold mb-1">MKS Default Values:</div>
                  <div className="space-y-0.5 text-xs">
                    <div>• Kp: {DEFAULT_PID_VALUES.kp}, Ki: {DEFAULT_PID_VALUES.ki}, Kd: {DEFAULT_PID_VALUES.kd}</div>
                    <div>• Acceleration: {DEFAULT_PID_VALUES.acc}</div>
                    <div>• Max Torque: {DEFAULT_PID_VALUES.torque} mA</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Homing Commands */}
          <ControlSection title="Homing & Zero" icon={<Home className="w-4 h-4" />}>
            {config.hasLimitSwitches ? (
              // Limit-based homing (Az with limit switches)
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">Limit Switch Configuration</div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Trigger</label>
                    <select
                      value={hmTrig}
                      onChange={(e) => setHmTrig(e.target.value as 'low' | 'high')}
                      className="w-full bg-black/60 border border-primary/30 rounded px-2 py-1 text-xs"
                    >
                      <option value="low">Low</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Direction</label>
                    <select
                      value={hmDir}
                      onChange={(e) => setHmDir(e.target.value as 'cw' | 'ccw')}
                      className="w-full bg-black/60 border border-primary/30 rounded px-2 py-1 text-xs"
                    >
                      <option value="cw">CW</option>
                      <option value="ccw">CCW</option>
                    </select>
                  </div>
                </div>

                <InputField
                  label="Speed"
                  value={hmSpeed}
                  onChange={setHmSpeed}
                  unit="RPM"
                  min={1}
                  max={3000}
                />

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="endLimit"
                    checked={endLimitEnable}
                    onChange={(e) => setEndLimitEnable(e.target.checked)}
                    className="w-3 h-3"
                  />
                  <label htmlFor="endLimit" className="text-xs text-muted-foreground">Enable End Limits</label>
                </div>

                <button
                  onClick={() => handleCommand(() => servoApi.home(selectedAxis, 'limit', {
                    direction: hmDir,
                    speed_rpm: parseInt(hmSpeed) || 200,
                    trigger: hmTrig,
                    end_limit: endLimitEnable
                  }), 'Home (Limit)')}
                  className="w-full px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs font-semibold transition-colors mt-2"
                >
                  🏠 Execute Homing (Limit)
                </button>
              </div>
            ) : (
              // Stall-based homing (El/CL without limit switches)
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">Stall Detection Configuration</div>

                <InputField
                  label="Current"
                  value={hmCurrentMa}
                  onChange={setHmCurrentMa}
                  unit="mA"
                  min={0}
                  max={config.currentLimitWork_mA}
                />

                <InputField
                  label="Backoff"
                  value={retValueDeg}
                  onChange={setRetValueDeg}
                  unit="deg"
                  min={0}
                  max={720}
                />

                <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  <div className="text-xs text-yellow-400">
                    ⚠ Use low current ({config.currentLimitHome_mA}mA recommended) to detect stall safely
                  </div>
                </div>

                <button
                  onClick={() => handleCommand(() => servoApi.home(selectedAxis, 'stall', {
                    current_ma: parseInt(hmCurrentMa) || 400,
                    backoff_deg: parseFloat(retValueDeg) || 180.0
                  }), 'Home (Stall)')}
                  className="w-full px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs font-semibold transition-colors mt-2"
                >
                  🏠 Execute Homing (Stall)
                </button>
              </div>
            )}

            <div className="border-t border-primary/20 pt-2 mt-2" />

            <button
              onClick={() => handleCommand(() => servoApi.setZero(selectedAxis), 'Set Zero')}
              className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
            >
              Set Current Position as Zero
            </button>
          </ControlSection>

          {/* Status Reading */}
          <ControlSection title="Status & Diagnostics">
            <div className="space-y-2">
              <button
                onClick={() => handleCommand(() => servoApi.getFullStatus(selectedAxis), 'Read Status')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read Full Status
              </button>
              <button
                onClick={() => handleCommand(() => servoApi.readStatusBundle(selectedAxis), 'Read Status Bundle')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read Status Bundle (0x48)
              </button>
              <button
                onClick={() => handleCommand(() => servoApi.readAllParams(selectedAxis), 'Read All Params')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read All Params (0x47)
              </button>
              <button
                onClick={() => handleCommand(() => servoApi.readIO(selectedAxis), 'Read I/O')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read I/O Bitmap
              </button>
              <button
                onClick={() => handleCommand(() => servoApi.readSpeed(selectedAxis), 'Read Speed')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read Speed (RPM)
              </button>
              <button
                onClick={() => handleCommand(() => servoApi.readAngleError(selectedAxis), 'Read Angle Error')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read Angle Error
              </button>
              <button
                onClick={() => handleCommand(() => servoApi.readEnPin(selectedAxis), 'Read EN Pin')}
                className="w-full px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Read EN Pin State
              </button>

              {/* IO Port Control (SERVO57D only has outputs) */}
              {config.io.outputs > 0 && (
                <>
                  <div className="border-t border-primary/20 pt-2 mt-2" />
                  <label className="block text-xs text-muted-foreground mb-1.5">Output Control (0x36)</label>

                  {/* OUT1 Control */}
                  {config.io.outputs >= 1 && (
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">OUT1:</label>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => {
                            setOut1State(null)
                            handleCommand(() => servoApi.writeOutputs(selectedAxis, null, out2State), 'Write OUT1=Hold')
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            out1State === null
                              ? 'bg-primary/30 border-primary/50'
                              : 'bg-black/40 border-primary/30 hover:bg-primary/20'
                          }`}
                        >
                          Hold
                        </button>
                        <button
                          onClick={() => {
                            setOut1State(0)
                            handleCommand(() => servoApi.writeOutputs(selectedAxis, 0, out2State), 'Write OUT1=0')
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            out1State === 0
                              ? 'bg-red-500/30 border-red-500/50'
                              : 'bg-black/40 border-primary/30 hover:bg-red-500/20'
                          }`}
                        >
                          Low
                        </button>
                        <button
                          onClick={() => {
                            setOut1State(1)
                            handleCommand(() => servoApi.writeOutputs(selectedAxis, 1, out2State), 'Write OUT1=1')
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            out1State === 1
                              ? 'bg-green-500/30 border-green-500/50'
                              : 'bg-black/40 border-primary/30 hover:bg-green-500/20'
                          }`}
                        >
                          High
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OUT2 Control */}
                  {config.io.outputs >= 2 && (
                    <div className="space-y-1 mt-2">
                      <label className="block text-xs text-muted-foreground">OUT2:</label>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => {
                            setOut2State(null)
                            handleCommand(() => servoApi.writeOutputs(selectedAxis, out1State, null), 'Write OUT2=Hold')
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            out2State === null
                              ? 'bg-primary/30 border-primary/50'
                              : 'bg-black/40 border-primary/30 hover:bg-primary/20'
                          }`}
                        >
                          Hold
                        </button>
                        <button
                          onClick={() => {
                            setOut2State(0)
                            handleCommand(() => servoApi.writeOutputs(selectedAxis, out1State, 0), 'Write OUT2=0')
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            out2State === 0
                              ? 'bg-red-500/30 border-red-500/50'
                              : 'bg-black/40 border-primary/30 hover:bg-red-500/20'
                          }`}
                        >
                          Low
                        </button>
                        <button
                          onClick={() => {
                            setOut2State(1)
                            handleCommand(() => servoApi.writeOutputs(selectedAxis, out1State, 1), 'Write OUT2=1')
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            out2State === 1
                              ? 'bg-green-500/30 border-green-500/50'
                              : 'bg-black/40 border-primary/30 hover:bg-green-500/20'
                          }`}
                        >
                          High
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ControlSection>
        </div>
      </div>

      {/* Full-width sections */}
      <div className="space-y-4">
        {/* Raw UART Console */}
        <ControlSection title="Raw UART Console" icon={<Terminal className="w-4 h-4" />}>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">
              Send raw FA frame commands (CRC auto-calculated). Example: <code className="bg-black/40 px-1 py-0.5 rounded">FA 01 47</code>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={rawHexInput}
                onChange={(e) => setRawHexInput(e.target.value)}
                placeholder="FA 01 F1 00 ..."
                className="flex-1 bg-black/60 border border-primary/30 rounded px-3 py-1.5 font-mono text-xs"
              />
              <button
                onClick={() => handleCommand(() => servoApi.sendRaw(selectedAxis, rawHexInput), 'Raw UART')}
                className="px-6 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-xs transition-colors"
              >
                Send
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Response Format</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRawTranslated(false)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    !showRawTranslated ? 'bg-primary/30 border-primary/50' : 'bg-black/40 border-primary/30'
                  }`}
                >
                  Raw Hex
                </button>
                <button
                  onClick={() => setShowRawTranslated(true)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    showRawTranslated ? 'bg-primary/30 border-primary/50' : 'bg-black/40 border-primary/30'
                  }`}
                >
                  Translated
                </button>
              </div>
            </div>
          </div>
        </ControlSection>

        {/* Command Response Panel */}
        <ControlSection title="Command Response Log">
          <div className="bg-black/60 border border-primary/20 rounded p-2 max-h-64 overflow-y-auto">
            {consoleOutput.length === 0 ? (
              <div className="text-xs text-muted-foreground italic text-center py-4">No commands sent yet</div>
            ) : (
              <div className="space-y-2">
                {consoleOutput.map((output, idx) => {
                  // Use timestamp from output if available, otherwise current time
                  const timestampStr = output.timestamp
                    ? new Date(output.timestamp).toLocaleString()
                    : new Date().toLocaleTimeString()
                  const isRawCommand = output.command === 'raw_uart'

                  return (
                    <div key={idx} className="text-xs border border-primary/20 rounded p-2 bg-black/20 font-mono">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-primary font-semibold">
                          [{output.axis}] {output.command || 'Command'}
                        </span>
                        <span className={`text-xs ${output.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                          {output.status}
                        </span>
                      </div>

                      {/* Raw UART Special Formatting */}
                      {isRawCommand && output.request && (output.request as any).hex_sent ? (
                        <div className="space-y-2 mt-2">
                          {/* Sent Frame */}
                          <div className="border-t border-primary/10 pt-2">
                            <div className="text-yellow-400 font-semibold mb-1">[{timestampStr}] Hex Sent:</div>
                            <div className="text-green-400 mb-1">{(output.request as any).hex_sent}</div>
                            {(output.request as any).parsed && (
                              <div className="text-muted-foreground text-[10px] ml-2">
                                {'{'} Header: {(output.request as any).parsed.header},
                                Address: {(output.request as any).parsed.address},
                                Function: {(output.request as any).parsed.function_name},
                                {(output.request as any).parsed.data !== 'None' && `Data: ${(output.request as any).parsed.data}, `}
                                CRC: {(output.request as any).parsed.crc} {'}'}
                              </div>
                            )}
                          </div>

                          {/* Received Frame */}
                          {output.response && (output.response as any).hex_received && (
                            <div className="border-t border-primary/10 pt-2">
                              <div className="text-yellow-400 font-semibold mb-1">[{timestampStr}] Hex Received:</div>
                              <div className="text-cyan-400 mb-1">{(output.response as any).hex_received}</div>
                              {(output.response as any).parsed && !(output.response as any).parsed.error && (
                                <div className="text-muted-foreground text-[10px] ml-2">
                                  {'{'} Header: {(output.response as any).parsed.header},
                                  Address: {(output.response as any).parsed.address},
                                  Function: {(output.response as any).parsed.function_name}
                                  {(output.response as any).parsed.data && typeof (output.response as any).parsed.data === 'object' && (
                                    <>, Data: {JSON.stringify((output.response as any).parsed.data)}</>
                                  )}
                                  {(output.response as any).parsed.crc && <>, CRC: {(output.response as any).parsed.crc}</>}
                                  {(output.response as any).parsed.crc_valid !== undefined && (
                                    <> ({(output.response as any).parsed.crc_valid ? '✓ Valid' : '✗ Invalid'})</>
                                  )}
                                  {' }'}
                                </div>
                              )}
                              {(output.response as any).parsed?.error && (
                                <div className="text-red-400 text-[10px] ml-2">
                                  Error: {(output.response as any).parsed.error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Normal Command Formatting */
                        <>
                          {/* Show hex frames if available (config commands) */}
                          {output.request && (output.request as any).hex_sent ? (
                            <div className="space-y-2 mt-2">
                              {/* Sent Frame */}
                              <div className="border-t border-primary/10 pt-2">
                                <div className="text-yellow-400 font-semibold mb-1">[{timestampStr}] Sent:</div>
                                <div className="text-green-400 mb-1">{(output.request as any).hex_sent}</div>
                                <div className="text-muted-foreground text-[10px]">
                                  {JSON.stringify(output.request, null, 2)}
                                </div>
                              </div>

                              {/* Received Frame with Translation */}
                              {output.response && (output.response as any).hex_received && (
                                <div className="border-t border-primary/10 pt-2">
                                  <div className="text-yellow-400 font-semibold mb-1">[{timestampStr}] Received:</div>
                                  <div className="text-cyan-400 mb-1">{(output.response as any).hex_received}</div>

                                  {/* Show formatted translation */}
                                  <div className="mt-2 pt-2 border-t border-primary/10">
                                    <div className="text-cyan-400 whitespace-pre-wrap text-xs">
                                      {formatResponseForDisplay(output)}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Use formatted output with translations */
                            <div className="border-t border-primary/10 pt-2 mt-2">
                              <div className="text-yellow-400 font-semibold mb-2">[{timestampStr}]</div>
                              <div className={`whitespace-pre-wrap ${output.status === 'error' ? 'text-red-400' : 'text-cyan-400'}`}>
                                {formatResponseForDisplay(output)}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ControlSection>
      </div>

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-background border border-primary/50 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2 text-warning">Unsaved Changes Detected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You have unsaved parameter changes for <span className="font-semibold text-primary">{selectedAxis.toUpperCase()}</span> servo.
              What would you like to do?
            </p>

            <div className="space-y-2">
              <button
                onClick={handleApplyPendingChanges}
                className="w-full px-4 py-2 bg-success/20 hover:bg-success/30 border border-success/50 rounded text-sm font-semibold transition-colors"
              >
                ✓ Apply Changes & Switch to {pendingAxisChange?.toUpperCase()}
              </button>

              <button
                onClick={handleDiscardChanges}
                className="w-full px-4 py-2 bg-error/20 hover:bg-error/30 border border-error/50 rounded text-sm font-semibold transition-colors"
              >
                ✗ Discard Changes & Switch to {pendingAxisChange?.toUpperCase()}
              </button>

              <button
                onClick={handleCancelAxisChange}
                className="w-full px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-sm transition-colors"
              >
                Cancel (Stay on {selectedAxis.toUpperCase()})
              </button>
            </div>

            <div className="mt-4 p-3 bg-primary/5 rounded text-xs">
              <div className="font-semibold mb-1">Pending Changes:</div>
              <div className="space-y-0.5 text-muted-foreground">
                {workCurrent !== savedParams.workCurrent && <div>• Work Current: {savedParams.workCurrent} → {workCurrent} mA</div>}
                {holdCurrent !== savedParams.holdCurrent && <div>• Hold Current: {savedParams.holdCurrent} → {holdCurrent}%</div>}
                {mode !== savedParams.mode && <div>• Mode: {savedParams.mode} → {mode}</div>}
                {microstep !== savedParams.microstep && <div>• Microstep: {savedParams.microstep} → {microstep}</div>}
                {enActive !== savedParams.enActive && <div>• EN Active: {savedParams.enActive} → {enActive}</div>}
                {direction !== savedParams.direction && <div>• Direction: {savedParams.direction} → {direction}</div>}
                {kp !== savedParams.kp && kp !== '' && <div>• Kp: {savedParams.kp || 'unset'} → {kp}</div>}
                {ki !== savedParams.ki && ki !== '' && <div>• Ki: {savedParams.ki || 'unset'} → {ki}</div>}
                {kd !== savedParams.kd && kd !== '' && <div>• Kd: {savedParams.kd || 'unset'} → {kd}</div>}
                {startAccel !== savedParams.startAccel && startAccel !== '' && <div>• Start Accel: {savedParams.startAccel || 'unset'} → {startAccel}</div>}
                {stopAccel !== savedParams.stopAccel && stopAccel !== '' && <div>• Stop Accel: {savedParams.stopAccel || 'unset'} → {stopAccel}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PID/ACC/Torque Danger Confirmation Modal */}
      {showPIDDangerModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-background border-2 border-red-500/70 rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 border-2 border-red-500/50 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-400">DANGER: Hardware Damage Risk</h3>
                <p className="text-xs text-muted-foreground">MKS SERVO Motherboard Protection</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-300 font-semibold mb-2">
                ⚠ Official MKS Warning:
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                "Improper setting of PID, Acceleration, and Torque parameters <span className="font-bold text-red-400">may damage the motherboard</span>.
                Please set it carefully and don't modify if you are not sure."
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div className="text-xs text-yellow-400 font-semibold mb-1">Before Proceeding:</div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Ensure you understand what these parameters do</li>
                <li>Consider using MKS defaults if unsure</li>
                <li>Test with low values first on a non-critical axis</li>
                <li>Keep backup of working configurations</li>
              </ul>
            </div>

            <div className="space-y-2">
              <button
                onClick={handlePIDDangerConfirm}
                className="w-full px-4 py-3 bg-red-500/30 hover:bg-red-500/40 border-2 border-red-500/60 rounded text-sm font-bold transition-colors text-red-300"
              >
                ⚠ I UNDERSTAND THE RISKS - APPLY CHANGES
              </button>

              <button
                onClick={handlePIDDangerCancel}
                className="w-full px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded text-sm transition-colors"
              >
                Cancel (Recommended if Unsure)
              </button>
            </div>

            <div className="mt-4 text-xs text-center text-muted-foreground">
              This warning is displayed for your protection based on official MKS documentation
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ServosPage() {
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold mb-2">Servo Console</h1>
        <p className="text-sm text-muted-foreground">
          Interactive MKS SERVO42D/57D control, diagnostics, and raw UART console (v1.0.6 firmware)
        </p>
      </div>

      {/* Status cards - compact horizontal layout */}
      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(SERVO_CONFIG) as ServoAxis[]).map(axis => (
          <StatusCard key={axis} axis={axis} config={SERVO_CONFIG[axis]} />
        ))}
      </div>

      {/* Interactive Console */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Interactive Servo Console</h2>
        <ServoConsole />
      </div>
    </div>
  )
}
