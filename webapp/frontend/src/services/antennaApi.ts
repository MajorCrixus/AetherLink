/**
 * Antenna control API service
 */

const API_BASE = '/api/servos'

export interface ServoMoveRequest {
  target_deg: number
  speed_rpm?: number
}

export interface ServoModeRequest {
  mode: 'IDLE' | 'HOLD' | 'TRACK' | 'CALIB'
}

export interface ServoStatus {
  axis: string
  mode: string
  current_deg: number
  target_deg: number
  error_deg: number
  current_ma: number
  temp_c: number
  status: string
}

export interface ServoMoveResponse {
  status: string
  axis: string
  target_deg: number
  speed_rpm: number
  message: string
}

export const antennaApi = {
  /**
   * Move servo to target position
   */
  async move(axis: 'az' | 'el' | 'cl', target_deg: number, speed_rpm: number = 20): Promise<ServoMoveResponse> {
    const response = await fetch(`${API_BASE}/${axis}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_deg, speed_rpm })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to move servo')
    }

    return response.json()
  },

  /**
   * Set servo operating mode
   */
  async setMode(axis: 'az' | 'el' | 'cl', mode: ServoModeRequest['mode']): Promise<any> {
    const response = await fetch(`${API_BASE}/${axis}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to set mode')
    }

    return response.json()
  },

  /**
   * Emergency stop specific servo
   */
  async stop(axis: 'az' | 'el' | 'cl'): Promise<any> {
    const response = await fetch(`${API_BASE}/${axis}/stop`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to stop servo')
    }

    return response.json()
  },

  /**
   * Emergency stop all servos
   */
  async stopAll(): Promise<any> {
    const response = await fetch(`${API_BASE}/stop-all`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to stop all servos')
    }

    return response.json()
  },

  /**
   * Get servo status
   */
  async getStatus(axis: 'az' | 'el' | 'cl'): Promise<ServoStatus> {
    const response = await fetch(`${API_BASE}/${axis}/status`)

    if (!response.ok) {
      throw new Error('Failed to get servo status')
    }

    return response.json()
  },

  /**
   * Run homing routine
   */
  async home(axis: 'az' | 'el' | 'cl'): Promise<any> {
    const response = await fetch(`${API_BASE}/${axis}/home`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to start homing')
    }

    return response.json()
  },

  /**
   * Move to predefined position
   */
  async moveToPreset(preset: 'stow' | 'zenith' | 'north' | 'south' | 'east' | 'west'): Promise<any> {
    const positions = {
      stow: { az: 0, el: -50, cl: 0 },
      zenith: { az: 0, el: 59, cl: 0 },
      north: { az: 0, el: 30, cl: 0 },
      south: { az: 180, el: 30, cl: 0 },
      east: { az: 90, el: 30, cl: 0 },
      west: { az: -90, el: 30, cl: 0 }
    }

    const pos = positions[preset]
    if (!pos) {
      throw new Error(`Unknown preset: ${preset}`)
    }

    // Move all axes in parallel
    await Promise.all([
      this.move('az', pos.az),
      this.move('el', pos.el),
      this.move('cl', pos.cl)
    ])

    return { status: 'success', preset, position: pos }
  },

  /**
   * Track satellite by ID
   */
  async trackSatellite(satelliteId: number): Promise<any> {
    // This would integrate with satellite tracking backend
    // For now, just switch to TRACK mode
    await Promise.all([
      this.setMode('az', 'TRACK'),
      this.setMode('el', 'TRACK'),
      this.setMode('cl', 'TRACK')
    ])

    return { status: 'success', tracking: satelliteId }
  }
}
