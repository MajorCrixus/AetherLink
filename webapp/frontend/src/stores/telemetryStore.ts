/**
 * Zustand store for telemetry data and application state
 */

import { create } from 'zustand'
import type {
  TelemetryData,
  HealthStatus,
  SatelliteData,
  LogMessage,
  EventMessage,
  SimulationState,
  WebSocketMessage
} from '@/types/telemetry'

interface TelemetryStore {
  // Connection state
  connected: boolean
  connectionError: string | null
  lastUpdate: string | null

  // Telemetry data
  telemetry: TelemetryData | null
  health: HealthStatus | null
  satellites: SatelliteData | null

  // Logs and events
  logs: LogMessage[]
  events: EventMessage[]

  // Simulation state
  simulation: SimulationState | null

  // UI state
  selectedSatellite: number | null
  dashboardLayout: string
  sidebarCollapsed: boolean

  // Actions
  setConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  updateTelemetry: (data: TelemetryData) => void
  updateHealth: (data: HealthStatus) => void
  updateSatellites: (data: SatelliteData) => void
  addLog: (log: LogMessage) => void
  addEvent: (event: EventMessage) => void
  updateSimulation: (sim: SimulationState) => void
  selectSatellite: (id: number | null) => void
  setDashboardLayout: (layout: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // WebSocket message handler
  handleWebSocketMessage: (message: WebSocketMessage) => void
}

export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  // Initial state
  connected: false,
  connectionError: null,
  lastUpdate: null,

  telemetry: null,
  health: null,
  satellites: null,

  logs: [],
  events: [],

  simulation: null,

  selectedSatellite: null,
  dashboardLayout: 'default',
  sidebarCollapsed: false,

  // Actions
  setConnected: (connected) =>
    set({ connected, connectionError: connected ? null : get().connectionError }),

  setConnectionError: (error) =>
    set({ connectionError: error }),

  updateTelemetry: (data) =>
    set({
      telemetry: data,
      lastUpdate: new Date().toISOString(),
      connected: true,
      connectionError: null
    }),

  updateHealth: (data) =>
    set({ health: data }),

  updateSatellites: (data) =>
    set({ satellites: data }),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 1000) // Keep last 1000 logs
    })),

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 100) // Keep last 100 events
    })),

  updateSimulation: (sim) =>
    set({ simulation: sim }),

  selectSatellite: (id) =>
    set({ selectedSatellite: id }),

  setDashboardLayout: (layout) =>
    set({ dashboardLayout: layout }),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  // WebSocket message handler
  handleWebSocketMessage: (message) => {
    const { channel, data } = message

    switch (channel) {
      case 'telemetry':
        get().updateTelemetry(data)
        break

      case 'health':
        get().updateHealth(data)
        break

      case 'satellites':
        get().updateSatellites(data)
        break

      case 'logs':
        get().addLog(data)
        break

      case 'events':
        get().addEvent(data)
        break

      case 'sim':
        get().updateSimulation(data)
        break

      default:
        console.warn('Unknown WebSocket channel:', channel)
    }
  }
}))

// Selector hooks for better performance
export const useConnectionState = () => useTelemetryStore((state) => ({
  connected: state.connected,
  error: state.connectionError,
  lastUpdate: state.lastUpdate
}))

export const useTelemetryData = () => useTelemetryStore((state) => state.telemetry)
export const useHealthStatus = () => useTelemetryStore((state) => state.health)
export const useSatelliteData = () => useTelemetryStore((state) => state.satellites)
export const useLogsData = () => useTelemetryStore((state) => state.logs)
export const useEventsData = () => useTelemetryStore((state) => state.events)
export const useSimulationState = () => useTelemetryStore((state) => state.simulation)

// Granular selectors for specific subsystems (better performance)
export const useIMUData = () => useTelemetryStore((state) => state.telemetry?.imu)
export const useGPSData = () => useTelemetryStore((state) => state.telemetry?.gps)
export const useAxesData = () => useTelemetryStore((state) => state.telemetry?.axes)
export const useServosData = () => useTelemetryStore((state) => state.telemetry?.servos)

export const useUIState = () => useTelemetryStore((state) => ({
  selectedSatellite: state.selectedSatellite,
  dashboardLayout: state.dashboardLayout,
  sidebarCollapsed: state.sidebarCollapsed,
  selectSatellite: state.selectSatellite,
  setDashboardLayout: state.setDashboardLayout,
  setSidebarCollapsed: state.setSidebarCollapsed
}))