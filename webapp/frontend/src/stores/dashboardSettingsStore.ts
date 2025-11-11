/**
 * Dashboard Settings Store
 *
 * Centralized configuration for satellite visualization and dashboard behavior.
 * All settings are persisted to localStorage.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VisualizationMode } from '@/services/satelliteVisualization'

// ============================================================================
// Types
// ============================================================================

export interface SatelliteFilters {
  // Orbit classifications
  orbitClasses?: string[]  // LEO, MEO, GEO, HEO, Elliptical

  // Frequency bands
  frequencyBands?: string[]  // UHF, VHF, S-band, X-band, Ka-band, Ku-band, L-band, C-band

  // Owner/Country
  owners?: string[]
  countries?: string[]

  // Purpose/Type
  purposes?: string[]  // Communications, Earth Observation, Navigation, Science, Technology, Military, Amateur

  // Launch date range
  launchDateStart?: string  // ISO date string
  launchDateEnd?: string

  // Status
  statuses?: string[]  // Active, Inactive, Decayed, Unknown

  // Size/Mass
  massMin?: number  // kg
  massMax?: number

  // Performance
  limit?: number  // Maximum satellites to load
}

export interface VisualizationSettings {
  // Mode
  mode: VisualizationMode

  // Orbit paths
  showOrbits: boolean
  orbitDuration: number  // minutes (lead/trail time)
  orbitColorScheme: 'orbit-class' | 'owner' | 'purpose' | 'single'
  orbitColor: string  // hex color (for single color mode)

  // Satellite points
  pointSize: number  // pixels
  colorScheme: 'orbit-class' | 'owner' | 'purpose' | 'status' | 'single'
  pointColor: string  // hex color (for single color mode)

  // Labels
  labelMode: 'always' | 'hover' | 'select' | 'never'
  labelContent: 'name' | 'norad' | 'owner' | 'name-norad'
  labelFontSize: number  // pixels
}

export interface InteractionSettings {
  // Click behavior
  onClick: 'info-panel' | 'fly-to' | 'highlight' | 'track' | 'details-page'

  // Hover behavior
  onHover: 'tooltip' | 'highlight' | 'access-line' | 'none'

  // Double-click behavior
  onDoubleClick: 'fly-to' | 'track' | 'details-page' | 'none'

  // Auto-tracking
  enableAutoTrack: boolean
}

export interface GroundStationSettings {
  // Display
  showMarker: boolean
  markerSize: number
  markerColor: string

  // Visibility cone
  showVisibilityCone: boolean
  coneOpacity: number  // 0-1
  coneColor: string
  minElevation: number  // degrees

  // Access lines
  showAccessLines: boolean
  accessLineColor: string
  accessLineWidth: number
}

export interface DisplaySettings {
  // Globe
  terrainQuality: 'low' | 'medium' | 'high'
  showAtmosphere: boolean

  // Lighting
  enableLighting: boolean

  // Time
  timeMode: 'real-time' | 'paused' | 'custom'
  timeSpeed: number  // multiplier (1 = real-time, 2 = 2x, etc.)

  // Camera
  defaultCameraAltitude: number  // meters

  // Background
  showStarField: boolean
}

export interface PerformanceSettings {
  // Update rates
  satelliteUpdateRate: number  // Hz (updates per second)

  // Propagation
  enableRealTimePropagation: boolean

  // Rendering
  batchRenderingThreshold: number  // number of satellites
}

export interface DashboardSettings {
  // Main categories
  filters: SatelliteFilters
  visualization: VisualizationSettings
  interaction: InteractionSettings
  groundStation: GroundStationSettings
  display: DisplaySettings
  performance: PerformanceSettings

  // Presets
  activePreset: string | null
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_FILTERS: SatelliteFilters = {
  limit: 2000,
}

const DEFAULT_VISUALIZATION: VisualizationSettings = {
  mode: 'massive',
  showOrbits: false,
  orbitDuration: 90,  // One full orbit for LEO
  orbitColorScheme: 'orbit-class',
  orbitColor: '#00FFFF',
  pointSize: 6,
  colorScheme: 'orbit-class',
  pointColor: '#00FFFF',
  labelMode: 'select',
  labelContent: 'name',
  labelFontSize: 10,
}

const DEFAULT_INTERACTION: InteractionSettings = {
  onClick: 'info-panel',
  onHover: 'highlight',
  onDoubleClick: 'fly-to',
  enableAutoTrack: false,
}

const DEFAULT_GROUND_STATION: GroundStationSettings = {
  showMarker: true,
  markerSize: 12,
  markerColor: '#00FF00',
  showVisibilityCone: false,
  coneOpacity: 0.2,
  coneColor: '#00FF00',
  minElevation: 10,
  showAccessLines: true,
  accessLineColor: '#00FFFF',
  accessLineWidth: 2,
}

const DEFAULT_DISPLAY: DisplaySettings = {
  terrainQuality: 'medium',
  showAtmosphere: true,
  enableLighting: true,
  timeMode: 'real-time',
  timeSpeed: 1,
  defaultCameraAltitude: 10000000,  // 10,000 km
  showStarField: true,
}

const DEFAULT_PERFORMANCE: PerformanceSettings = {
  satelliteUpdateRate: 1,  // 1 Hz
  enableRealTimePropagation: true,
  batchRenderingThreshold: 100,
}

const DEFAULT_SETTINGS: DashboardSettings = {
  filters: DEFAULT_FILTERS,
  visualization: DEFAULT_VISUALIZATION,
  interaction: DEFAULT_INTERACTION,
  groundStation: DEFAULT_GROUND_STATION,
  display: DEFAULT_DISPLAY,
  performance: DEFAULT_PERFORMANCE,
  activePreset: null,
}

// ============================================================================
// Presets
// ============================================================================

// Deep partial type for preset configurations
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export const SETTINGS_PRESETS: Record<string, DeepPartial<DashboardSettings>> = {
  'leo-comms': {
    filters: {
      orbitClasses: ['LEO'],
      purposes: ['Communications'],
      limit: 1000,
    },
    visualization: {
      mode: 'massive',
      showOrbits: false,
      labelMode: 'select',
    },
  },
  'gps-constellation': {
    filters: {
      orbitClasses: ['MEO'],
      purposes: ['Navigation'],
      limit: 100,
    },
    visualization: {
      mode: 'orbit',
      showOrbits: true,
      orbitDuration: 720,  // 12 hours
      labelMode: 'always',
    },
  },
  'iss-tracking': {
    filters: {
      purposes: ['Space Station'],
      limit: 10,
    },
    visualization: {
      mode: 'orbit',
      showOrbits: true,
      orbitDuration: 90,
      labelMode: 'always',
    },
    interaction: {
      onClick: 'track',
      enableAutoTrack: true,
    },
  },
  'earth-observation': {
    filters: {
      purposes: ['Earth Observation'],
      limit: 500,
    },
    visualization: {
      mode: 'los',
      showOrbits: false,
      labelMode: 'hover',
    },
    groundStation: {
      showVisibilityCone: true,
      showAccessLines: true,
    },
  },
  'starlink': {
    filters: {
      owners: ['SpaceX'],
      purposes: ['Communications'],
      limit: 5000,
    },
    visualization: {
      mode: 'massive',
      showOrbits: false,
      labelMode: 'never',
    },
  },
}

// ============================================================================
// Store
// ============================================================================

interface DashboardSettingsState extends DashboardSettings {
  // Actions
  updateFilters: (filters: Partial<SatelliteFilters>) => void
  updateVisualization: (viz: Partial<VisualizationSettings>) => void
  updateInteraction: (interaction: Partial<InteractionSettings>) => void
  updateGroundStation: (gs: Partial<GroundStationSettings>) => void
  updateDisplay: (display: Partial<DisplaySettings>) => void
  updatePerformance: (perf: Partial<PerformanceSettings>) => void

  // Preset management
  applyPreset: (presetName: string) => void
  resetToDefaults: () => void
}

const STORAGE_KEY = 'aetherlink-dashboard-settings'

export const useDashboardSettingsStore = create<DashboardSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      updateFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      updateVisualization: (viz) =>
        set((state) => ({
          visualization: { ...state.visualization, ...viz },
        })),

      updateInteraction: (interaction) =>
        set((state) => ({
          interaction: { ...state.interaction, ...interaction },
        })),

      updateGroundStation: (gs) =>
        set((state) => ({
          groundStation: { ...state.groundStation, ...gs },
        })),

      updateDisplay: (display) =>
        set((state) => ({
          display: { ...state.display, ...display },
        })),

      updatePerformance: (perf) =>
        set((state) => ({
          performance: { ...state.performance, ...perf },
        })),

      applyPreset: (presetName) => {
        const preset = SETTINGS_PRESETS[presetName]
        if (!preset) return

        set((state) => ({
          ...state,
          ...preset,
          filters: { ...state.filters, ...preset.filters },
          visualization: { ...state.visualization, ...preset.visualization },
          interaction: { ...state.interaction, ...preset.interaction },
          groundStation: { ...state.groundStation, ...preset.groundStation },
          display: { ...state.display, ...preset.display },
          performance: { ...state.performance, ...preset.performance },
          activePreset: presetName,
        }))
      },

      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
    }
  )
)

// Selector hooks for convenience
export const useSatelliteFilters = () =>
  useDashboardSettingsStore((state) => state.filters)

export const useVisualizationSettings = () =>
  useDashboardSettingsStore((state) => state.visualization)

export const useInteractionSettings = () =>
  useDashboardSettingsStore((state) => state.interaction)

export const useGroundStationSettings = () =>
  useDashboardSettingsStore((state) => state.groundStation)

export const useDisplaySettings = () =>
  useDashboardSettingsStore((state) => state.display)

export const usePerformanceSettings = () =>
  useDashboardSettingsStore((state) => state.performance)
