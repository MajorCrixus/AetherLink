/**
 * Satellite Visualization Service
 *
 * Implements three Digital Arsenal visualization modes:
 * 1. Built-in Orbit Generation (SGP4 from TLEs)
 * 2. Line-of-Sight / Deck Access (visibility cones)
 * 3. Massive Entity Set (efficient batch rendering)
 */

import {
  Viewer as CesiumViewer,
  Entity,
  Cartesian3,
  Color,
  SampledPositionProperty,
  JulianDate,
  ClockRange,
  PolylineGlowMaterialProperty,
  PathGraphics,
  PointGraphics,
  LabelGraphics,
  HorizontalOrigin,
  VerticalOrigin,
  Transforms,
  defined,
  Math as CesiumMath,
  CallbackProperty,
  ConstantProperty,
  NearFarScalar,
} from 'cesium'

import * as satellite from 'satellite.js'
import type { SatelliteSummary } from '@/types/satellite'

export type VisualizationMode = 'orbit' | 'los' | 'massive'

export interface VisualizationConfig {
  mode: VisualizationMode
  groundStationLat?: number
  groundStationLon?: number
  groundStationAlt?: number
  showOrbits?: boolean
  showLabels?: boolean
  showAccessCones?: boolean
  orbitColor?: Color
  pointSize?: number
  simulationTime?: Date
}

export class SatelliteVisualizationService {
  private viewer: CesiumViewer
  private entities: Map<number, Entity> = new Map()
  private config: VisualizationConfig
  private satelliteRecords: Map<number, satellite.SatRec> = new Map()

  constructor(viewer: CesiumViewer, config: VisualizationConfig) {
    this.viewer = viewer
    this.config = config
  }

  /**
   * Update visualization configuration
   */
  updateConfig(config: Partial<VisualizationConfig>) {
    this.config = { ...this.config, ...config }
    // Re-render with new config
    this.clearAll()
  }

  /**
   * Add satellites based on current visualization mode
   */
  async addSatellites(satellites: SatelliteSummary[]) {
    if (!this.viewer || !this.viewer.entities) return

    switch (this.config.mode) {
      case 'orbit':
        await this.addWithOrbits(satellites)
        break
      case 'los':
        await this.addWithLineOfSight(satellites)
        break
      case 'massive':
        await this.addMassive(satellites)
        break
    }
  }

  /**
   * Propagate satellite position using SGP4 algorithm
   */
  private propagateSatellite(satRec: satellite.SatRec, time: Date): Cartesian3 | null {
    try {
      const positionAndVelocity = satellite.propagate(satRec, time)
      if (!positionAndVelocity || !positionAndVelocity.position || typeof positionAndVelocity.position === 'boolean') {
        return null
      }

      const position = positionAndVelocity.position as satellite.EciVec3<number>
      const gmst = satellite.gstime(time)
      const ecef = satellite.eciToEcf(position, gmst)

      // Convert km to meters for Cesium
      return new Cartesian3(ecef.x * 1000, ecef.y * 1000, ecef.z * 1000)
    } catch (e) {
      console.error('Error propagating satellite:', e)
      return null
    }
  }

  /**
   * Mode 1: Built-in Orbit Generation
   * Uses SGP4 propagator to compute orbits from TLEs
   */
  private async addWithOrbits(satellites: SatelliteSummary[]) {
    for (const sat of satellites) {
      if (!sat.tle || !sat.tle.line1 || !sat.tle.line2) {
        // No TLE available - show as static point at approximate altitude
        this.addStaticSatellite(sat)
        continue
      }

      try {
        // Parse TLE and create satellite record
        const satRec = satellite.twoline2satrec(sat.tle.line1, sat.tle.line2)
        this.satelliteRecords.set(sat.norad_id, satRec)

        const color = this.getOrbitColor(sat.orbit_class)

        // Create entity with dynamic position using CallbackProperty
        // Position updates automatically as Cesium's clock advances
        const entity = this.viewer.entities.add({
          id: `sat-${sat.norad_id}`,
          name: sat.name,
          position: new CallbackProperty(() => {
            const currentTime = JulianDate.toDate(this.viewer.clock.currentTime)
            const pos = this.propagateSatellite(satRec, currentTime)
            return pos || Cartesian3.ZERO
          }, false) as any,
          point: {
            pixelSize: 8,
            color: color,
            outlineColor: Color.WHITE,
            outlineWidth: 1,
            // Scale points based on camera distance to keep them visible when zoomed out
            scaleByDistance: new NearFarScalar(1.5e6, 2.0, 8.0e7, 0.5),
          },
          label: this.config.showLabels ? {
            text: sat.name,
            font: '10px monospace',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cartesian3(0, -12, 0),
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.BOTTOM,
          } : undefined,
          path: this.config.showOrbits ? {
            resolution: 120,
            material: new PolylineGlowMaterialProperty({
              glowPower: 0.1,
              color: color.withAlpha(0.5),
            }),
            width: 2,
            leadTime: 0,
            trailTime: 5400, // 90 minutes (one orbit)
          } : undefined,
          properties: {
            norad_id: sat.norad_id,
            orbit: sat.orbit_class,
            owner: sat.owner,
          },
          description: this.generateSatelliteDescription(sat, satRec),
        })

        this.entities.set(sat.norad_id, entity)
      } catch (error) {
        console.error(`Error creating SGP4 propagator for ${sat.name}:`, error)
        // Fallback to static satellite
        this.addStaticSatellite(sat)
      }
    }
  }

  /**
   * Mode 2: Line-of-Sight / Deck Access
   * Shows visibility cones from ground station to satellites
   */
  private async addWithLineOfSight(satellites: SatelliteSummary[]) {
    const { groundStationLat, groundStationLon, groundStationAlt } = this.config

    if (!defined(groundStationLat) || !defined(groundStationLon)) {
      console.warn('Ground station position required for LOS mode')
      return this.addMassive(satellites) // Fallback to massive mode
    }

    // Create ground station entity
    const gsPosition = Cartesian3.fromDegrees(
      groundStationLon!,
      groundStationLat!,
      groundStationAlt || 0
    )

    this.viewer.entities.add({
      id: 'ground-station',
      position: gsPosition,
      point: {
        pixelSize: 12,
        color: Color.LIME,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: 'GS',
        font: '12px monospace',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cartesian3(0, -20, 0),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
      },
    })

    // Add satellites with LOS indicators
    for (const sat of satellites) {
      let entity: Entity | undefined

      // Try to add with SGP4 propagation if TLE is available
      if (sat.tle && sat.tle.line1 && sat.tle.line2) {
        try {
          const satRec = satellite.twoline2satrec(sat.tle.line1, sat.tle.line2)
          this.satelliteRecords.set(sat.norad_id, satRec)

          const color = this.getOrbitColor(sat.orbit_class)

          entity = this.viewer.entities.add({
            id: `sat-${sat.norad_id}`,
            name: sat.name,
            position: new CallbackProperty(() => {
              const currentTime = JulianDate.toDate(this.viewer.clock.currentTime)
              const pos = this.propagateSatellite(satRec, currentTime)
              return pos || Cartesian3.ZERO
            }, false) as any,
            point: {
              pixelSize: 8,
              color: color,
              outlineColor: Color.WHITE,
              outlineWidth: 1,
              // Scale points based on camera distance to keep them visible when zoomed out
              scaleByDistance: new NearFarScalar(1.5e6, 2.0, 8.0e7, 0.5),
            },
            label: this.config.showLabels ? {
              text: sat.name,
              font: '10px monospace',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 2,
              pixelOffset: new Cartesian3(0, -12, 0),
              horizontalOrigin: HorizontalOrigin.CENTER,
              verticalOrigin: VerticalOrigin.BOTTOM,
            } : undefined,
            properties: {
              norad_id: sat.norad_id,
              orbit: sat.orbit_class,
              owner: sat.owner,
            },
            description: this.generateSatelliteDescription(sat, satRec),
          })

          this.entities.set(sat.norad_id, entity)

          // Add dynamic LOS line that updates with Cesium's clock
          const losEntity = this.viewer.entities.add({
            id: `los-${sat.norad_id}`,
            polyline: {
              positions: new CallbackProperty(() => {
                const currentTime = JulianDate.toDate(this.viewer.clock.currentTime)
                const satPos = this.propagateSatellite(satRec, currentTime)
                if (!satPos) return []

                const elevation = this.calculateElevation(gsPosition, satPos)
                // Only show line if satellite is above horizon
                return elevation > 0 ? [gsPosition, satPos] : []
              }, false) as any,
              width: 2,
              material: new PolylineGlowMaterialProperty({
                glowPower: 0.2,
                taperPower: 0.5,
                color: Color.CYAN.withAlpha(0.5),
              }),
            },
          })
        } catch (error) {
          console.error(`Error creating SGP4 propagator for ${sat.name}:`, error)
          entity = this.addStaticSatellite(sat)
        }
      } else {
        entity = this.addStaticSatellite(sat)
      }

      // For static satellites, add static LOS line
      if (entity && entity.position && !(entity.position instanceof CallbackProperty)) {
        const satPos = entity.position.getValue(JulianDate.now())
        if (satPos) {
          const elevation = this.calculateElevation(gsPosition, satPos)
          if (elevation > 0) {
            this.viewer.entities.add({
              id: `los-${sat.norad_id}`,
              polyline: {
                positions: [gsPosition, satPos],
                width: 2,
                material: new PolylineGlowMaterialProperty({
                  glowPower: 0.2,
                  taperPower: 0.5,
                  color: Color.CYAN.withAlpha(0.5),
                }),
              },
            })
          }
        }
      }
    }
  }

  /**
   * Mode 3: Massive Entity Set
   * Efficiently renders large numbers of satellites as points
   */
  private async addMassive(satellites: SatelliteSummary[]) {
    const showLabels = this.config.showLabels ?? false
    const pointSize = this.config.pointSize ?? 6

    for (const sat of satellites) {
      const color = this.getOrbitColor(sat.orbit_class)

      // Try to use SGP4 propagation if TLE is available
      if (sat.tle && sat.tle.line1 && sat.tle.line2) {
        try {
          const satRec = satellite.twoline2satrec(sat.tle.line1, sat.tle.line2)
          this.satelliteRecords.set(sat.norad_id, satRec)

          const entity = this.viewer.entities.add({
            id: `sat-${sat.norad_id}`,
            name: sat.name,
            position: new CallbackProperty(() => {
              const currentTime = JulianDate.toDate(this.viewer.clock.currentTime)
              const pos = this.propagateSatellite(satRec, currentTime)
              return pos || Cartesian3.ZERO
            }, false) as any,
            point: {
              pixelSize: pointSize,
              color: color,
              outlineColor: Color.WHITE,
              outlineWidth: 1,
              // Scale points based on camera distance to keep them visible when zoomed out
              scaleByDistance: new NearFarScalar(1.5e6, 2.0, 8.0e7, 0.5),
            },
            label: showLabels ? {
              text: sat.name,
              font: '10px monospace',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 2,
              pixelOffset: new Cartesian3(0, -12, 0),
              horizontalOrigin: HorizontalOrigin.CENTER,
              verticalOrigin: VerticalOrigin.BOTTOM,
              distanceDisplayCondition: undefined, // Always show if enabled
            } : undefined,
            properties: {
              norad_id: sat.norad_id,
              orbit: sat.orbit_class,
              owner: sat.owner,
            },
            description: this.generateSatelliteDescription(sat, satRec),
          })

          this.entities.set(sat.norad_id, entity)
          continue
        } catch (error) {
          console.error(`Error creating SGP4 propagator for ${sat.name}:`, error)
          // Fall through to static position
        }
      }

      // Fallback: Approximate position based on orbit class
      const position = this.getApproximatePosition(sat)

      const entity = this.viewer.entities.add({
        id: `sat-${sat.norad_id}`,
        name: sat.name,
        position: position,
        point: {
          pixelSize: pointSize,
          color: color,
          outlineColor: Color.WHITE,
          outlineWidth: 1,
          // Scale points based on camera distance to keep them visible when zoomed out
          scaleByDistance: new NearFarScalar(1.5e6, 2.0, 8.0e7, 0.5),
        },
        label: showLabels ? {
          text: sat.name,
          font: '10px monospace',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cartesian3(0, -12, 0),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          distanceDisplayCondition: undefined, // Always show if enabled
        } : undefined,
        properties: {
          norad_id: sat.norad_id,
          orbit: sat.orbit_class,
          owner: sat.owner,
        },
        description: this.generateSatelliteDescription(sat), // No satRec for fallback satellites
      })

      this.entities.set(sat.norad_id, entity)
    }
  }

  /**
   * Add a satellite as a static point (fallback when no TLE)
   */
  private addStaticSatellite(sat: SatelliteSummary): Entity | undefined {
    const color = this.getOrbitColor(sat.orbit_class)
    const position = this.getApproximatePosition(sat)

    const entity = this.viewer.entities.add({
      id: `sat-${sat.norad_id}`,
      name: sat.name,
      position: position,
      point: {
        pixelSize: 8,
        color: color,
        outlineColor: Color.WHITE,
        outlineWidth: 1,
      },
      label: this.config.showLabels ? {
        text: sat.name,
        font: '10px monospace',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cartesian3(0, -12, 0),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
      } : undefined,
      properties: {
        norad_id: sat.norad_id,
        orbit: sat.orbit_class,
        owner: sat.owner,
      },
      description: this.generateSatelliteDescription(sat), // No satRec for static satellites
    })

    this.entities.set(sat.norad_id, entity)
    return entity
  }

  /**
   * Get color based on orbit class
   */
  private getOrbitColor(orbitClass: string | null): Color {
    switch (orbitClass) {
      case 'LEO':
        return Color.RED.withAlpha(0.8)
      case 'MEO':
        return Color.BLUE.withAlpha(0.8)
      case 'GEO':
        return Color.GREEN.withAlpha(0.8)
      case 'HEO':
        return Color.PURPLE.withAlpha(0.8)
      default:
        return Color.GRAY.withAlpha(0.6)
    }
  }

  /**
   * Get approximate position for satellite based on orbit class
   * (Used when TLE is not available)
   */
  private getApproximatePosition(sat: SatelliteSummary): Cartesian3 {
    // Random longitude
    const lon = Math.random() * 360 - 180

    // Latitude based on orbit inclination (approximate)
    const maxLat = sat.orbit_class === 'LEO' ? 51.6 :
                   sat.orbit_class === 'GEO' ? 0 :
                   Math.random() * 90 - 45
    const lat = (Math.random() * 2 - 1) * maxLat

    // Altitude based on orbit class
    const altitude = this.getApproximateAltitude(sat.orbit_class)

    return Cartesian3.fromDegrees(lon, lat, altitude)
  }

  /**
   * Get approximate altitude for orbit class (in meters)
   */
  private getApproximateAltitude(orbitClass: string | null): number {
    switch (orbitClass) {
      case 'LEO':
        return 400000 + Math.random() * 1600000 // 400-2000 km
      case 'MEO':
        return 20000000 // ~20,000 km
      case 'GEO':
        return 35786000 // ~35,786 km
      case 'HEO':
        return 10000000 + Math.random() * 30000000 // 10,000-40,000 km
      default:
        return 1000000 // 1,000 km default
    }
  }

  /**
   * Calculate elevation angle from ground station to satellite
   * Simplified calculation - in production, use proper topocentric coordinate transformation
   */
  private calculateElevation(gsPos: Cartesian3, satPos: Cartesian3): number {
    // Direction vector from ground station to satellite
    const direction = Cartesian3.subtract(satPos, gsPos, new Cartesian3())
    const directionNorm = Cartesian3.normalize(direction, new Cartesian3())

    // Local up vector at ground station
    const up = Cartesian3.normalize(gsPos, new Cartesian3())

    // Angle between direction and up vector
    const dotProduct = Cartesian3.dot(directionNorm, up)
    const angle = Math.acos(dotProduct)

    // Convert to elevation (90° - angle from zenith)
    const elevation = CesiumMath.toDegrees(CesiumMath.PI_OVER_TWO - angle)

    return elevation
  }

  /**
   * Highlight a specific satellite
   */
  highlightSatellite(noradId: number) {
    const entity = this.entities.get(noradId)
    if (!entity || !entity.point) return

    // Increase size and add glow
    entity.point.pixelSize = new ConstantProperty(16)
    entity.point.color = new ConstantProperty(Color.YELLOW)
    entity.point.outlineWidth = new ConstantProperty(3)
  }

  /**
   * Clear highlight from satellite
   */
  unhighlightSatellite(noradId: number) {
    const entity = this.entities.get(noradId)
    if (!entity || !entity.point) return

    // Reset to normal
    const sat = this.getSatelliteData(entity)
    const color = this.getOrbitColor(sat?.orbit_class || null)

    entity.point.pixelSize = new ConstantProperty(8)
    entity.point.color = new ConstantProperty(color)
    entity.point.outlineWidth = new ConstantProperty(1)
  }

  /**
   * Fly camera to satellite
   */
  flyToSatellite(noradId: number) {
    if (!this.viewer || !this.viewer.entities) return

    const entity = this.entities.get(noradId)
    if (!entity) return

    this.viewer.flyTo(entity, {
      duration: 2,
      offset: {
        heading: 0,
        pitch: -0.5,
        range: 5000000, // 5000 km
      },
    })
  }

  /**
   * Get satellite data from entity
   */
  private getSatelliteData(entity: Entity): any {
    return {
      norad_id: entity.properties?.getValue(JulianDate.now()).norad_id,
      orbit_class: entity.properties?.getValue(JulianDate.now()).orbit,
      owner: entity.properties?.getValue(JulianDate.now()).owner,
    }
  }

  /**
   * Calculate next satellite passes over ground station
   * Returns up to 5 upcoming pass windows
   */
  private calculateNextPasses(satRec: satellite.SatRec, gsLat: number, gsLon: number, gsAlt: number = 0, count: number = 5): Array<{
    startTime: Date
    endTime: Date
    maxElevation: number
    duration: number
  }> {
    const passes: Array<{ startTime: Date; endTime: Date; maxElevation: number; duration: number }> = []
    const gsPosition = Cartesian3.fromDegrees(gsLon, gsLat, gsAlt)

    // Start from now, search forward in time
    const now = new Date()
    const searchDuration = 7 * 24 * 60 * 60 * 1000 // Search 7 days ahead
    const timeStep = 60 * 1000 // Check every minute

    let inPass = false
    let passStart: Date | null = null
    let maxElev = 0

    for (let t = now.getTime(); t < now.getTime() + searchDuration && passes.length < count; t += timeStep) {
      const time = new Date(t)
      const satPos = this.propagateSatellite(satRec, time)

      if (!satPos) continue

      const elevation = this.calculateElevation(gsPosition, satPos)

      if (elevation > 0 && !inPass) {
        // Pass starting
        inPass = true
        passStart = time
        maxElev = elevation
      } else if (elevation > 0 && inPass) {
        // Pass continuing
        maxElev = Math.max(maxElev, elevation)
      } else if (elevation <= 0 && inPass && passStart) {
        // Pass ending
        inPass = false
        const duration = (time.getTime() - passStart.getTime()) / 1000 / 60 // minutes

        // Only include passes above 10° elevation
        if (maxElev > 10) {
          passes.push({
            startTime: passStart,
            endTime: time,
            maxElevation: maxElev,
            duration: duration
          })
        }

        passStart = null
        maxElev = 0
      }
    }

    return passes
  }

  /**
   * Generate rich HTML description for satellite InfoBox
   */
  private generateSatelliteDescription(sat: SatelliteSummary, satRec?: satellite.SatRec): string {
    const { groundStationLat, groundStationLon, groundStationAlt } = this.config

    // Calculate passes if we have TLE and ground station
    let passesHTML = ''
    if (satRec && defined(groundStationLat) && defined(groundStationLon)) {
      const passes = this.calculateNextPasses(satRec, groundStationLat!, groundStationLon!, groundStationAlt || 0, 5)

      if (passes.length > 0) {
        passesHTML = `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
            <div style="color: #00ffff; font-weight: bold; margin-bottom: 8px; font-size: 11px;">NEXT PASSES</div>
            ${passes.map((pass, i) => `
              <div style="background: rgba(0,255,255,0.1); padding: 6px; margin-bottom: 4px; border-radius: 3px; font-size: 10px;">
                <div style="color: #ffffff; font-weight: bold;">${i + 1}. ${pass.startTime.toLocaleString()}</div>
                <div style="color: #aaaaaa; margin-top: 2px;">
                  <span style="color: #00ff00;">↑ ${pass.maxElevation.toFixed(1)}°</span> •
                  <span>${pass.duration.toFixed(0)} min</span> •
                  <span>Ends: ${pass.endTime.toLocaleTimeString()}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `
      } else {
        passesHTML = `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
            <div style="color: #ffaa00; font-size: 10px;">No passes >10° in next 7 days</div>
          </div>
        `
      }
    }

    // Format bands
    const bandsStr = sat.bands && sat.bands.length > 0 ? sat.bands.join(', ') : 'N/A'

    // Format purposes
    const purposesStr = sat.purpose && sat.purpose.length > 0 ? sat.purpose.join(', ') : 'N/A'

    // Build HTML description
    return `
      <div style="font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.4; color: #ffffff; background: #000000; padding: 8px; max-width: 340px;">
        <div style="color: #00ffff; font-weight: bold; font-size: 13px; margin-bottom: 8px; border-bottom: 2px solid #00ffff; padding-bottom: 4px;">
          ${sat.name}
        </div>

        <div style="display: grid; grid-template-columns: 85px 1fr; gap: 4px 8px; margin-bottom: 8px; font-size: 10px;">
          <div style="color: #00ffff;">NORAD ID:</div>
          <div>${sat.norad_id}</div>

          <div style="color: #00ffff;">Orbit Class:</div>
          <div style="color: ${this.getOrbitColorHex(sat.orbit_class)}; font-weight: bold;">${sat.orbit_class || 'UNKNOWN'}</div>

          <div style="color: #00ffff;">Owner:</div>
          <div>${sat.owner || 'Unknown'}</div>

          <div style="color: #00ffff;">Purpose:</div>
          <div style="font-size: 9px;">${purposesStr}</div>

          <div style="color: #00ffff;">Freq Bands:</div>
          <div style="color: #ffaa00; font-weight: bold;">${bandsStr}</div>
        </div>

        ${passesHTML}

        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 9px; color: #aaaaaa; font-style: italic;">
          💡 Open SATCAT widget for detailed transmitter frequencies
        </div>
      </div>
    `
  }

  /**
   * Get hex color for orbit class (for HTML)
   */
  private getOrbitColorHex(orbitClass: string | null): string {
    switch (orbitClass) {
      case 'LEO': return '#ff4444'
      case 'MEO': return '#4444ff'
      case 'GEO': return '#44ff44'
      case 'HEO': return '#ff44ff'
      default: return '#888888'
    }
  }

  /**
   * Clear all satellite entities
   */
  clearAll() {
    if (!this.viewer || !this.viewer.entities) return

    for (const [_, entity] of this.entities) {
      this.viewer.entities.remove(entity)
    }
    this.entities.clear()
    this.satelliteRecords.clear()

    // Remove LOS lines and ground station
    this.viewer.entities.removeById('ground-station')
    const losEntities = this.viewer.entities.values.filter(e =>
      e.id?.startsWith('los-')
    )
    losEntities.forEach(e => this.viewer.entities.remove(e))
  }

  /**
   * Dispose of service
   */
  dispose() {
    if (!this.viewer || !this.viewer.entities) return
    this.clearAll()
  }
}
