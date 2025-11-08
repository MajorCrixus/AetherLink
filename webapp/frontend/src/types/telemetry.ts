/**
 * Telemetry type definitions
 * Matches the backend data contracts exactly
 */

export type AngleDeg = number // -360..+360
export type DegreesPerSec = number

export interface GPSFix {
  mode: 'NO_FIX' | '2D' | '3D'
  hdop?: number
  pdop?: number
  lat?: number
  lon?: number
  alt_m?: number
  speed_mps?: number
  course_deg?: number
  sats?: number
  ts: string // ISO-8601 UTC
}

export interface IMU {
  roll_deg: number
  pitch_deg: number
  yaw_deg: number
  gyro_x?: number // Angular velocity around X axis (°/s)
  gyro_y?: number // Angular velocity around Y axis (°/s)
  gyro_z?: number // Angular velocity around Z axis (°/s)
  accel_x?: number // Acceleration along X axis (g)
  accel_y?: number // Acceleration along Y axis (g)
  accel_z?: number // Acceleration along Z axis (g)
  temp_c?: number
  // Orientation data (from WT901C tilt-compensated heading)
  heading_mag_deg?: number // Magnetic heading 0-360° (with offset applied)
  heading_true_deg?: number // True heading 0-360° (mag + declination)
  cross_level_deg?: number // Roll about boresight
  elevation_deg?: number // Pitch about right axis
  declination_deg?: number
  heading_offset_deg?: number
  ts: string
}

export interface AxisState {
  target_deg: AngleDeg
  actual_deg: AngleDeg
  error_deg: AngleDeg
  rate_dps?: DegreesPerSec
  mode?: 'IDLE' | 'HOLD' | 'TRACK' | 'CALIB'
  current_ma?: number
  temp_c?: number
  ts: string
}

export interface ServoState {
  axis: 'AZ' | 'EL' | 'CL' // Azimuth, Elevation, Cross-level
  mode: 'IDLE' | 'HOLD' | 'TRACK' | 'CALIB'
  current_ma?: number
  temp_c?: number
  error_code?: string
  ts: string
}

export interface LimitState {
  in1: boolean
  in2?: boolean
  ts: string
}

export interface SystemState {
  cpu: number // CPU usage percentage
  gpu: number // GPU usage percentage
  mem: number // Memory usage percentage
  disk: number // Disk usage percentage
  temps: Record<string, number | undefined> // Temperature readings
  mode?: 'IDLE' | 'HOLD' | 'TRACK' | 'CALIB'
  motion_active?: boolean
  tracking_target?: string
  limits_ok?: boolean
  estop_active?: boolean
  ts: string
}

export interface SatelliteSummary {
  norad_id: number
  name: string
  orbit: 'LEO' | 'MEO' | 'HEO' | 'GEO'
  next_pass?: {
    aos: string
    los: string
    max_elevation_deg: number
  }
  el_now_deg?: number
  band?: string[]
}

export interface PowerData {
  voltage_v: number
  current_a: number
}

export interface EnvironmentalData {
  temp_c: number
  humidity?: number
  pressure?: number
}

export interface TelemetryData {
  gps: GPSFix
  imu: IMU
  axes: Record<string, AxisState> // 'AZ', 'EL', 'CL'
  servos: Record<string, ServoState>
  limits: Record<string, LimitState>
  system: SystemState
  power?: PowerData
  environmental?: EnvironmentalData
  selected_satellite?: SatelliteSummary
}

export interface SatelliteData {
  list: SatelliteSummary[]
  filters: Record<string, any>
  last_updated: string
}

export interface LogMessage {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'ALERT'
  source: string
  message: string
  ts: string
}

export interface EventMessage {
  type: string
  severity: 'INFO' | 'WARN' | 'ERROR' | 'ALERT'
  payload: Record<string, any>
  ts: string
}

export interface SimulationState {
  enabled: boolean
  profile?: string
}

// Health/connectivity states (INAV-style)
export type HealthStatusType = 'OK' | 'WARN' | 'ERROR' | 'OFF' | 'INIT' | 'SIM'

export interface HealthState {
  status: HealthStatusType
  message?: string
  last_update: string
}

export interface HealthStatus {
  link: HealthState // FE ↔ BE WebSocket
  gps: HealthState
  imu: HealthState
  servos: HealthState
  limits: HealthState
  tle: HealthState
  time: HealthState
  system: HealthState
  sim: HealthState // Demo mode active
}

// WebSocket message types
export interface WebSocketMessage {
  channel: string
  data: any
  timestamp: string
}

// Configuration types
export interface AxisConfig {
  min_deg: number
  max_deg: number
  zero_offset: number
  max_rate_dps: number
}

export interface ServoConfig {
  addr: number
  baud: number
  mode: string
}

export interface SystemConfig {
  version: number
  units: Record<string, string>
  network: Record<string, any>
  demo: Record<string, any>
  axes: Record<string, AxisConfig>
  servos: Record<string, ServoConfig>
  limits: Record<string, any>
  ephemeris: Record<string, any>
  api: Record<string, any>
  logging: Record<string, any>
}

// API request/response types
export interface MoveCommand {
  target_deg: number
  speed_dps?: number
}

export interface ModeCommand {
  mode: 'IDLE' | 'HOLD' | 'TRACK' | 'CALIB'
}

export interface CLICommand {
  cmd: string
  args: string[]
}

export interface CLIResponse {
  stdout: string
  stderr: string
  code: number
}

export interface DemoModeConfig {
  enabled: boolean
  profile?: string
}