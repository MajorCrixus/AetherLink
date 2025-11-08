/**
 * Zustand store for widget configuration and display preferences
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WidgetType = 'gps' | 'imu' | 'system' | 'axes' | 'servos' | 'satellite' | 'logs' | 'actions' | 'satcat' | 'satvis'

export interface WidgetConfig {
  visible: boolean
  showTimestamp: boolean
  compactMode: boolean
  // Widget-specific settings
  customSettings?: Record<string, any>
}

export interface WidgetConfigState {
  widgets: Record<WidgetType, WidgetConfig>

  // Actions
  toggleWidgetVisibility: (widgetId: WidgetType) => void
  toggleTimestamp: (widgetId: WidgetType) => void
  toggleCompactMode: (widgetId: WidgetType) => void
  setCustomSetting: (widgetId: WidgetType, key: string, value: any) => void
  resetWidget: (widgetId: WidgetType) => void
  resetAll: () => void
}

const DEFAULT_CONFIG: WidgetConfig = {
  visible: true,
  showTimestamp: true,
  compactMode: false,
  customSettings: {}
}

const DEFAULT_WIDGETS: Record<WidgetType, WidgetConfig> = {
  gps: { ...DEFAULT_CONFIG },
  imu: { ...DEFAULT_CONFIG },
  system: { ...DEFAULT_CONFIG },
  axes: { ...DEFAULT_CONFIG },
  servos: { ...DEFAULT_CONFIG },
  satellite: { ...DEFAULT_CONFIG },
  logs: { ...DEFAULT_CONFIG },
  actions: { ...DEFAULT_CONFIG, showTimestamp: false },
  satcat: { ...DEFAULT_CONFIG }, // Satellite Catalog
  satvis: { ...DEFAULT_CONFIG, showTimestamp: false } // Satellite Visualization Controls
}

const STORAGE_KEY = 'aetherlink-widget-config'

export const useWidgetConfigStore = create<WidgetConfigState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,

      toggleWidgetVisibility: (widgetId) =>
        set((state) => ({
          widgets: {
            ...state.widgets,
            [widgetId]: {
              ...state.widgets[widgetId],
              visible: !state.widgets[widgetId].visible
            }
          }
        })),

      toggleTimestamp: (widgetId) =>
        set((state) => ({
          widgets: {
            ...state.widgets,
            [widgetId]: {
              ...state.widgets[widgetId],
              showTimestamp: !state.widgets[widgetId].showTimestamp
            }
          }
        })),

      toggleCompactMode: (widgetId) =>
        set((state) => ({
          widgets: {
            ...state.widgets,
            [widgetId]: {
              ...state.widgets[widgetId],
              compactMode: !state.widgets[widgetId].compactMode
            }
          }
        })),

      setCustomSetting: (widgetId, key, value) =>
        set((state) => ({
          widgets: {
            ...state.widgets,
            [widgetId]: {
              ...state.widgets[widgetId],
              customSettings: {
                ...state.widgets[widgetId].customSettings,
                [key]: value
              }
            }
          }
        })),

      resetWidget: (widgetId) =>
        set((state) => ({
          widgets: {
            ...state.widgets,
            [widgetId]: { ...DEFAULT_CONFIG }
          }
        })),

      resetAll: () =>
        set({ widgets: DEFAULT_WIDGETS })
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // Merge strategy to handle new widgets being added in updates
      merge: (persistedState: any, currentState) => {
        return {
          ...currentState,
          widgets: {
            ...DEFAULT_WIDGETS,
            ...(persistedState?.widgets || {})
          }
        }
      }
    }
  )
)

// Selector hooks
export const useWidgetConfig = (widgetId: WidgetType) =>
  useWidgetConfigStore((state) => state.widgets[widgetId])

export const useWidgetVisible = (widgetId: WidgetType) =>
  useWidgetConfigStore((state) => state.widgets[widgetId].visible)
