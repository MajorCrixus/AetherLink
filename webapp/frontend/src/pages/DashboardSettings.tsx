/**
 * Dashboard Settings Page
 *
 * Comprehensive configuration interface for satellite visualization
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, Filter, Eye, MousePointer, Radio, Globe, Zap, Star, RotateCcw } from 'lucide-react'
import {
  useDashboardSettingsStore,
  SETTINGS_PRESETS,
} from '@/stores/dashboardSettingsStore'

type SettingsTab = 'filters' | 'visualization' | 'interaction' | 'ground-station' | 'display' | 'performance'

export function DashboardSettings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SettingsTab>('filters')

  const settings = useDashboardSettingsStore()

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'filters', label: 'Filters', icon: <Filter className="w-4 h-4" /> },
    { id: 'visualization', label: 'Visualization', icon: <Eye className="w-4 h-4" /> },
    { id: 'interaction', label: 'Interaction', icon: <MousePointer className="w-4 h-4" /> },
    { id: 'ground-station', label: 'Ground Station', icon: <Radio className="w-4 h-4" /> },
    { id: 'display', label: 'Display', icon: <Globe className="w-4 h-4" /> },
    { id: 'performance', label: 'Performance', icon: <Zap className="w-4 h-4" /> },
  ]

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  Dashboard Settings
                </h1>
                <p className="text-sm text-muted-foreground">
                  Configure satellite visualization and dashboard behavior
                </p>
              </div>
            </div>

            <button
              onClick={() => settings.resetToDefaults()}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar Tabs */}
        <div className="w-64 border-r border-border bg-card p-4 space-y-2 overflow-y-auto">
          {/* Presets Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Quick Presets
            </h3>
            <div className="space-y-1">
              {Object.keys(SETTINGS_PRESETS).map((presetName) => (
                <button
                  key={presetName}
                  onClick={() => settings.applyPreset(presetName)}
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    settings.activePreset === presetName
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  {presetName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Tabs */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Settings</h3>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {tab.icon}
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl">
            {activeTab === 'filters' && <FiltersTab />}
            {activeTab === 'visualization' && <VisualizationTab />}
            {activeTab === 'interaction' && <InteractionTab />}
            {activeTab === 'ground-station' && <GroundStationTab />}
            {activeTab === 'display' && <DisplayTab />}
            {activeTab === 'performance' && <PerformanceTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Tab Components
// ============================================================================

function FiltersTab() {
  const { filters, updateFilters } = useDashboardSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Satellite Filters</h2>
        <p className="text-sm text-muted-foreground">
          Control which satellites are loaded and displayed
        </p>
      </div>

      {/* Satellite Limit */}
      <SettingCard title="Satellite Limit" description="Maximum number of satellites to load (affects performance)">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{(filters.limit || 2000).toLocaleString()} satellites</span>
            <input
              type="number"
              value={filters.limit || 2000}
              onChange={(e) => updateFilters({ limit: parseInt(e.target.value) })}
              min="10"
              max="50000"
              step="100"
              className="w-24 px-3 py-1 bg-background border border-input rounded-md text-sm"
            />
          </div>
          <input
            type="range"
            min="100"
            max="10000"
            step="100"
            value={filters.limit || 2000}
            onChange={(e) => updateFilters({ limit: parseInt(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-yellow-500">⚠ Higher values may impact performance</p>
        </div>
      </SettingCard>

      {/* Orbit Class */}
      <SettingCard title="Orbit Classification" description="Filter by orbital altitude">
        <MultiSelect
          options={['LEO', 'MEO', 'GEO', 'HEO', 'Elliptical']}
          selected={filters.orbitClasses || []}
          onChange={(values) => updateFilters({ orbitClasses: values.length > 0 ? values : undefined })}
        />
      </SettingCard>

      {/* Frequency Band */}
      <SettingCard title="Frequency Band" description="Filter by communication frequency band">
        <MultiSelect
          options={['UHF', 'VHF', 'S-band', 'X-band', 'Ka-band', 'Ku-band', 'L-band', 'C-band']}
          selected={filters.frequencyBands || []}
          onChange={(values) => updateFilters({ frequencyBands: values.length > 0 ? values : undefined })}
        />
      </SettingCard>

      {/* Purpose */}
      <SettingCard title="Purpose / Type" description="Filter by satellite mission type">
        <MultiSelect
          options={[
            'Communications',
            'Earth Observation',
            'Navigation',
            'Science',
            'Technology',
            'Military',
            'Amateur',
            'Space Station',
          ]}
          selected={filters.purposes || []}
          onChange={(values) => updateFilters({ purposes: values.length > 0 ? values : undefined })}
        />
      </SettingCard>

      {/* Status */}
      <SettingCard title="Operational Status" description="Filter by current satellite status">
        <MultiSelect
          options={['Active', 'Inactive', 'Decayed', 'Unknown']}
          selected={filters.statuses || []}
          onChange={(values) => updateFilters({ statuses: values.length > 0 ? values : undefined })}
        />
      </SettingCard>
    </div>
  )
}

function VisualizationTab() {
  const { visualization, updateVisualization } = useDashboardSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Visualization Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure how satellites are displayed on the globe
        </p>
      </div>

      {/* Visualization Mode */}
      <SettingCard title="Visualization Mode" description="Choose rendering method">
        <select
          value={visualization.mode}
          onChange={(e) => updateVisualization({ mode: e.target.value as any })}
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="massive">Massive Set (Efficient)</option>
          <option value="orbit">Orbit Generation (Detailed)</option>
          <option value="los">Line-of-Sight (Ground Station)</option>
        </select>
      </SettingCard>

      {/* Orbit Paths */}
      <SettingCard title="Orbit Paths" description="Display satellite orbital paths">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={visualization.showOrbits}
              onChange={(e) => updateVisualization({ showOrbits: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Show orbit paths</span>
          </label>

          {visualization.showOrbits && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={visualization.orbitDuration}
                  onChange={(e) => updateVisualization({ orbitDuration: parseInt(e.target.value) })}
                  min="30"
                  max="1440"
                  step="10"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Color Scheme</label>
                <select
                  value={visualization.orbitColorScheme}
                  onChange={(e) => updateVisualization({ orbitColorScheme: e.target.value as any })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                >
                  <option value="orbit-class">By Orbit Class</option>
                  <option value="owner">By Owner</option>
                  <option value="purpose">By Purpose</option>
                  <option value="single">Single Color</option>
                </select>
              </div>
            </>
          )}
        </div>
      </SettingCard>

      {/* Satellite Points */}
      <SettingCard title="Satellite Points" description="Configure satellite markers">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Point Size (pixels)</label>
            <input
              type="range"
              min="2"
              max="20"
              value={visualization.pointSize}
              onChange={(e) => updateVisualization({ pointSize: parseInt(e.target.value) })}
              className="w-full"
            />
            <span className="text-xs text-muted-foreground">{visualization.pointSize}px</span>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Color Scheme</label>
            <select
              value={visualization.colorScheme}
              onChange={(e) => updateVisualization({ colorScheme: e.target.value as any })}
              className="w-full px-3 py-2 bg-background border border-input rounded-md"
            >
              <option value="orbit-class">By Orbit Class</option>
              <option value="owner">By Owner</option>
              <option value="purpose">By Purpose</option>
              <option value="status">By Status</option>
              <option value="single">Single Color</option>
            </select>
          </div>
        </div>
      </SettingCard>

      {/* Labels */}
      <SettingCard title="Labels" description="Satellite label display settings">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Display Mode</label>
            <select
              value={visualization.labelMode}
              onChange={(e) => updateVisualization({ labelMode: e.target.value as any })}
              className="w-full px-3 py-2 bg-background border border-input rounded-md"
            >
              <option value="always">Always Show</option>
              <option value="hover">On Hover</option>
              <option value="select">On Select</option>
              <option value="never">Never Show</option>
            </select>
          </div>

          {visualization.labelMode !== 'never' && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Label Content</label>
                <select
                  value={visualization.labelContent}
                  onChange={(e) => updateVisualization({ labelContent: e.target.value as any })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                >
                  <option value="name">Satellite Name</option>
                  <option value="norad">NORAD ID</option>
                  <option value="owner">Owner</option>
                  <option value="name-norad">Name + NORAD ID</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Font Size (pixels)</label>
                <input
                  type="range"
                  min="8"
                  max="16"
                  value={visualization.labelFontSize}
                  onChange={(e) => updateVisualization({ labelFontSize: parseInt(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">{visualization.labelFontSize}px</span>
              </div>
            </>
          )}
        </div>
      </SettingCard>
    </div>
  )
}

function InteractionTab() {
  const { interaction, updateInteraction } = useDashboardSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Interaction Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure mouse and click behavior
        </p>
      </div>

      <SettingCard title="Click Behavior" description="Action when clicking a satellite">
        <select
          value={interaction.onClick}
          onChange={(e) => updateInteraction({ onClick: e.target.value as any })}
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="info-panel">Show Info Panel</option>
          <option value="fly-to">Fly To Satellite</option>
          <option value="highlight">Highlight</option>
          <option value="track">Track Satellite</option>
          <option value="details-page">Open Details Page</option>
        </select>
      </SettingCard>

      <SettingCard title="Hover Behavior" description="Action when hovering over a satellite">
        <select
          value={interaction.onHover}
          onChange={(e) => updateInteraction({ onHover: e.target.value as any })}
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="tooltip">Show Tooltip</option>
          <option value="highlight">Highlight</option>
          <option value="access-line">Show Access Line</option>
          <option value="none">None</option>
        </select>
      </SettingCard>

      <SettingCard title="Double-Click Behavior" description="Action when double-clicking a satellite">
        <select
          value={interaction.onDoubleClick}
          onChange={(e) => updateInteraction({ onDoubleClick: e.target.value as any })}
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="fly-to">Fly To Satellite</option>
          <option value="track">Track Satellite</option>
          <option value="details-page">Open Details Page</option>
          <option value="none">None</option>
        </select>
      </SettingCard>

      <SettingCard title="Auto-Tracking" description="Automatically track selected satellites">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={interaction.enableAutoTrack}
            onChange={(e) => updateInteraction({ enableAutoTrack: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm">Enable automatic tracking</span>
        </label>
      </SettingCard>
    </div>
  )
}

function GroundStationTab() {
  const { groundStation, updateGroundStation } = useDashboardSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Ground Station Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure ground station display and visibility calculations
        </p>
      </div>

      <SettingCard title="Ground Station Marker" description="Display ground station location">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={groundStation.showMarker}
              onChange={(e) => updateGroundStation({ showMarker: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Show marker</span>
          </label>

          {groundStation.showMarker && (
            <div>
              <label className="text-sm font-medium block mb-1">Marker Size (pixels)</label>
              <input
                type="range"
                min="4"
                max="24"
                value={groundStation.markerSize}
                onChange={(e) => updateGroundStation({ markerSize: parseInt(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{groundStation.markerSize}px</span>
            </div>
          )}
        </div>
      </SettingCard>

      <SettingCard title="Visibility Cone" description="Show ground station horizon/visibility cone">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={groundStation.showVisibilityCone}
              onChange={(e) => updateGroundStation({ showVisibilityCone: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Show visibility cone</span>
          </label>

          {groundStation.showVisibilityCone && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Minimum Elevation (degrees)</label>
                <input
                  type="number"
                  value={groundStation.minElevation}
                  onChange={(e) => updateGroundStation({ minElevation: parseInt(e.target.value) })}
                  min="0"
                  max="45"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Opacity</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={groundStation.coneOpacity}
                  onChange={(e) => updateGroundStation({ coneOpacity: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">{(groundStation.coneOpacity * 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      </SettingCard>

      <SettingCard title="Access Lines" description="Lines connecting ground station to visible satellites">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={groundStation.showAccessLines}
              onChange={(e) => updateGroundStation({ showAccessLines: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Show access lines</span>
          </label>

          {groundStation.showAccessLines && (
            <div>
              <label className="text-sm font-medium block mb-1">Line Width (pixels)</label>
              <input
                type="range"
                min="1"
                max="5"
                value={groundStation.accessLineWidth}
                onChange={(e) => updateGroundStation({ accessLineWidth: parseInt(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{groundStation.accessLineWidth}px</span>
            </div>
          )}
        </div>
      </SettingCard>
    </div>
  )
}

function DisplayTab() {
  const { display, updateDisplay } = useDashboardSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Display Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure globe appearance and visual effects
        </p>
      </div>

      <SettingCard title="Terrain Quality" description="Globe terrain detail level">
        <select
          value={display.terrainQuality}
          onChange={(e) => updateDisplay({ terrainQuality: e.target.value as any })}
          className="w-full px-3 py-2 bg-background border border-input rounded-md"
        >
          <option value="low">Low (Faster)</option>
          <option value="medium">Medium</option>
          <option value="high">High (Slower)</option>
        </select>
      </SettingCard>

      <SettingCard title="Visual Effects" description="Globe visual enhancements">
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={display.showAtmosphere}
              onChange={(e) => updateDisplay({ showAtmosphere: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Show atmosphere</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={display.enableLighting}
              onChange={(e) => updateDisplay({ enableLighting: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Enable lighting (sun position)</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={display.showStarField}
              onChange={(e) => updateDisplay({ showStarField: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Show star field background</span>
          </label>
        </div>
      </SettingCard>

      <SettingCard title="Time Simulation" description="Control simulation time">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Time Mode</label>
            <select
              value={display.timeMode}
              onChange={(e) => updateDisplay({ timeMode: e.target.value as any })}
              className="w-full px-3 py-2 bg-background border border-input rounded-md"
            >
              <option value="real-time">Real-Time</option>
              <option value="paused">Paused</option>
              <option value="custom">Custom Speed</option>
            </select>
          </div>

          {display.timeMode === 'custom' && (
            <div>
              <label className="text-sm font-medium block mb-1">Speed Multiplier</label>
              <input
                type="number"
                value={display.timeSpeed}
                onChange={(e) => updateDisplay({ timeSpeed: parseFloat(e.target.value) })}
                min="0.1"
                max="100"
                step="0.5"
                className="w-full px-3 py-2 bg-background border border-input rounded-md"
              />
              <p className="text-xs text-muted-foreground mt-1">1 = real-time, 2 = 2x faster, 0.5 = half speed</p>
            </div>
          )}
        </div>
      </SettingCard>
    </div>
  )
}

function PerformanceTab() {
  const { performance, updatePerformance } = useDashboardSettingsStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Performance Settings</h2>
        <p className="text-sm text-muted-foreground">
          Optimize rendering and calculation performance
        </p>
      </div>

      <SettingCard title="Update Rate" description="How often satellite positions are recalculated">
        <div className="space-y-2">
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={performance.satelliteUpdateRate}
            onChange={(e) => updatePerformance({ satelliteUpdateRate: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.1 Hz (Slow)</span>
            <span className="font-medium text-foreground">{performance.satelliteUpdateRate} Hz</span>
            <span>5 Hz (Fast)</span>
          </div>
          <p className="text-xs text-muted-foreground">Lower values reduce CPU usage</p>
        </div>
      </SettingCard>

      <SettingCard title="Propagation" description="Real-time orbital calculations">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={performance.enableRealTimePropagation}
            onChange={(e) => updatePerformance({ enableRealTimePropagation: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm">Enable real-time propagation (SGP4)</span>
        </label>
        <p className="text-xs text-muted-foreground mt-2">
          Disable for static snapshot; enable for live simulation
        </p>
      </SettingCard>

      <SettingCard title="Batch Rendering" description="Group satellite rendering for better performance">
        <div className="space-y-2">
          <label className="text-sm font-medium block">Threshold (number of satellites)</label>
          <input
            type="number"
            value={performance.batchRenderingThreshold}
            onChange={(e) => updatePerformance({ batchRenderingThreshold: parseInt(e.target.value) })}
            min="10"
            max="1000"
            step="10"
            className="w-full px-3 py-2 bg-background border border-input rounded-md"
          />
          <p className="text-xs text-muted-foreground">
            When satellite count exceeds this, use batch rendering
          </p>
        </div>
      </SettingCard>
    </div>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

interface SettingCardProps {
  title: string
  description: string
  children: React.ReactNode
}

function SettingCard({ title, description, children }: SettingCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

function MultiSelect({ options, selected, onChange }: MultiSelectProps) {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <label
          key={option}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer transition-colors ${
            selected.includes(option)
              ? 'border-primary bg-primary/10'
              : 'border-input hover:bg-accent'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => toggleOption(option)}
            className="w-4 h-4"
          />
          <span className="text-sm">{option}</span>
        </label>
      ))}
    </div>
  )
}
