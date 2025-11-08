/**
 * Servo API service
 */

// Use window.location.hostname so it works from any device on the network
const API_BASE = `http://${window.location.hostname}:9000/api`

export interface ServoStatus {
  address: number
  online: boolean
  status_code?: number
  status_text?: string
  current_deg?: number
  target_deg?: number
  error_deg?: number
  speed_rpm?: number
  current_ma?: number
  temp_c?: number
  encoder_value?: number
  protect_flag?: number
  io?: {
    IN1: boolean
    IN2: boolean
    OUT1: boolean
    OUT2: boolean
  }
  errors?: string[]
  raw_status?: string
  message?: string
}

export interface CommandResponse {
  status: string
  axis: string
  command?: string
  request?: any
  response?: any
  message?: string
  mode?: string
  data?: ServoStatus
  timestamp?: string
}

export const servoApi = {
  // Get full status for console display
  async getFullStatus(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/full-status`)
    if (!response.ok) throw new Error('Failed to get servo status')
    return response.json()
  },

  // Motion commands
  async moveAbsolute(axis: string, targetDeg: number, speedPct: number = 10): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/move-absolute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_deg: targetDeg, speed_pct: speedPct })
    })
    if (!response.ok) throw new Error('Failed to move absolute')
    return response.json()
  },

  async moveRelative(axis: string, deltaDeg: number, speedPct: number = 10): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/move-relative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta_deg: deltaDeg, speed_pct: speedPct })
    })
    if (!response.ok) throw new Error('Failed to move relative')
    return response.json()
  },

  async stop(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/stop`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to stop')
    return response.json()
  },

  async jog(axis: string, direction: 'cw' | 'ccw', speedPct: number = 10, acceleration: number = 100): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/jog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, speed_pct: speedPct, acceleration })
    })
    if (!response.ok) throw new Error('Failed to jog')
    return response.json()
  },

  async setSpeed(axis: string, speedPct: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed_pct: speedPct })
    })
    if (!response.ok) throw new Error('Failed to set speed')
    return response.json()
  },

  // Homing commands
  async home(
    axis: string,
    method: 'limit' | 'stall' = 'limit',
    params?: {
      direction?: 'cw' | 'ccw',
      speed_rpm?: number,
      trigger?: 'low' | 'high',
      end_limit?: boolean,
      current_ma?: number,
      backoff_deg?: number
    }
  ): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/home`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        direction: params?.direction || 'cw',
        speed_rpm: params?.speed_rpm || 200,
        trigger: params?.trigger || 'low',
        end_limit: params?.end_limit !== undefined ? params.end_limit : true,
        current_ma: params?.current_ma || 400,
        backoff_deg: params?.backoff_deg || 180.0
      })
    })
    if (!response.ok) throw new Error('Failed to home')
    return response.json()
  },

  async setZero(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-zero`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to set zero')
    return response.json()
  },

  // Protection
  async setProtect(axis: string, enabled: boolean): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    })
    if (!response.ok) throw new Error('Failed to set protect')
    return response.json()
  },

  // IO
  async readIO(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/io`)
    if (!response.ok) throw new Error('Failed to read IO')
    return response.json()
  },

  // Raw command
  async sendRaw(axis: string, hexData: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hex_data: hexData })
    })
    if (!response.ok) throw new Error('Failed to send raw command')
    return response.json()
  },

  // Advanced commands
  async releaseLockedRotor(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/release-locked-rotor`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to release locked-rotor')
    return response.json()
  },

  async restartDevice(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/restart`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to restart device')
    return response.json()
  },

  async factoryReset(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/factory-reset`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to reset to factory defaults')
    return response.json()
  },

  async readSpeed(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/read-speed`)
    if (!response.ok) throw new Error('Failed to read speed')
    return response.json()
  },

  async readAngleError(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/read-angle-error`)
    if (!response.ok) throw new Error('Failed to read angle error')
    return response.json()
  },

  async readEnPin(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/read-en-pin`)
    if (!response.ok) throw new Error('Failed to read EN pin')
    return response.json()
  },

  // Command history
  async getCommandHistory(limit: number = 20): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/history?limit=${limit}`)
    if (!response.ok) throw new Error('Failed to get command history')
    return response.json()
  },

  // ========== CONFIGURATION COMMANDS ==========

  async setMode(axis: string, mode: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    })
    if (!response.ok) throw new Error('Failed to set mode')
    return response.json()
  },

  async setWorkCurrent(axis: string, current_ma: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-work-current`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_ma })
    })
    if (!response.ok) throw new Error('Failed to set work current')
    return response.json()
  },

  async setHoldCurrent(axis: string, percent: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-hold-current`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent })
    })
    if (!response.ok) throw new Error('Failed to set hold current')
    return response.json()
  },

  async setMicrostep(axis: string, microstep: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-microstep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ microstep })
    })
    if (!response.ok) throw new Error('Failed to set microstep')
    return response.json()
  },

  async setEnActive(axis: string, en_mode: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-en-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ en_mode })
    })
    if (!response.ok) throw new Error('Failed to set EN active mode')
    return response.json()
  },

  async setDirection(axis: string, direction: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-direction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction })
    })
    if (!response.ok) throw new Error('Failed to set direction')
    return response.json()
  },

  async setAutosleep(axis: string, enable: boolean): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-autosleep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    })
    if (!response.ok) throw new Error('Failed to set autosleep')
    return response.json()
  },

  async setStallProtect(axis: string, enable: boolean): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-stall-protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    })
    if (!response.ok) throw new Error('Failed to set stall protect')
    return response.json()
  },

  async setMicrostepInterpolation(axis: string, enable: boolean): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-microstep-interpolation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    })
    if (!response.ok) throw new Error('Failed to set microstep interpolation')
    return response.json()
  },

  // ========== HOMING CONFIGURATION ==========

  async setNolimitHoming(axis: string, reverse_ticks: number, mode: number, current_ma: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-nolimit-homing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reverse_ticks, mode, current_ma })
    })
    if (!response.ok) throw new Error('Failed to set nolimit homing')
    return response.json()
  },

  async setLimitRemap(axis: string, enable: boolean): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-limit-remap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    })
    if (!response.ok) throw new Error('Failed to set limit remap')
    return response.json()
  },

  async setKeyLock(axis: string, lock: boolean): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-key-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock })
    })
    if (!response.ok) throw new Error('Failed to set key lock')
    return response.json()
  },

  // ========== IO CONTROL ==========

  async writeOutputs(axis: string, out1: number | null, out2: number | null): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/write-outputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ out1, out2 })
    })
    if (!response.ok) throw new Error('Failed to write outputs')
    return response.json()
  },

  // ========== PID TUNING ==========

  async setPID(axis: string, kp?: number, ki?: number, kd?: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-pid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kp, ki, kd })
    })
    if (!response.ok) throw new Error('Failed to set PID')
    return response.json()
  },

  async setAcceleration(axis: string, start_accel?: number, stop_accel?: number): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/set-acceleration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_accel, stop_accel })
    })
    if (!response.ok) throw new Error('Failed to set acceleration')
    return response.json()
  },

  // ========== ADVANCED ==========

  async readAllParams(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/read-all-params`)
    if (!response.ok) throw new Error('Failed to read all params')
    return response.json()
  },

  async readStatusBundle(axis: string): Promise<CommandResponse> {
    const response = await fetch(`${API_BASE}/servos/console/${axis}/read-status-bundle`)
    if (!response.ok) throw new Error('Failed to read status bundle')
    return response.json()
  },

  // ========== MOVEMENT MODE CONTROL ==========

  async setMovementMode(mode: 'position' | 'speed' | 'hybrid'): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/set-movement-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    })
    if (!response.ok) throw new Error('Failed to set movement mode')
    return response.json()
  },

  async getMovementMode(): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/movement-mode`)
    if (!response.ok) throw new Error('Failed to get movement mode')
    return response.json()
  },

  // ========== POSITION LOCKING ==========

  async lockPosition(axis: string): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/lock-position/${axis}`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error(`Failed to lock ${axis} position`)
    return response.json()
  },

  async unlockPosition(axis: string): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/unlock-position/${axis}`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error(`Failed to unlock ${axis} position`)
    return response.json()
  },

  async getLockStates(): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/lock-states`)
    if (!response.ok) throw new Error('Failed to get lock states')
    return response.json()
  },

  // ========== MOTION PARAMETERS ==========

  async setMotionParams(params: {
    settling_time_ms?: number
    working_current_ma?: number
    holding_current_ma?: number
    idle_current_ma?: number
    current_ramp_duration_ms?: number
  }): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/motion-params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    if (!response.ok) throw new Error('Failed to set motion parameters')
    return response.json()
  },

  async getMotionParams(): Promise<any> {
    const response = await fetch(`${API_BASE}/servos/console/motion-params`)
    if (!response.ok) throw new Error('Failed to get motion parameters')
    return response.json()
  }
}
