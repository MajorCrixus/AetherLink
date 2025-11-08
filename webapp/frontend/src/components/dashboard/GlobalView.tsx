// src/components/dashboard/GlobalView.tsx
// AetherLink: Globe + antenna + (optional) demo satellites with on-screen controls
// - No extra deps beyond three/@react-three/fiber/@react-three/drei
// - Adds UI controls and ensures the canvas is interactive & visible

import React, { useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Billboard, Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useTelemetryData, useSatelliteData } from '@/stores/telemetryStore'
import { TimeControl } from './TimeControl'
import { calculateSunPosition } from '@/utils/solarPosition'

/* ------------------------------ Types & consts ---------------------------- */
type Telemetry = {
  gps?: { lat?: number | null; lon?: number | null; alt?: number | null } // meters
}
type SatInput = {
  norad_id: number | string
  name: string
  orbit?: 'LEO' | 'MEO' | 'HEO' | 'GEO' | string
}

const EARTH_RADIUS_KM = 6371
const KM_TO_SCENE = 1 / EARTH_RADIUS_KM
const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI
const ELEV_MASK_DEG = 5 // beam turns green when elev > mask

/* ------------------------ Minimal WGS-84 helpers (no deps) ---------------- */
const WGS84_A = 6378.137 // km
const WGS84_E2 = 6.69437999014e-3
function geodeticToEcef(latDeg: number, lonDeg: number, altMeters = 0) {
  const lat = latDeg * DEG2RAD
  const lon = lonDeg * DEG2RAD
  const h = (altMeters || 0) / 1000
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon), cosLon = Math.cos(lon)
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat)
  const x = (N + h) * cosLat * cosLon
  const y = (N + h) * cosLat * sinLon
  const z = (N * (1 - WGS84_E2) + h) * sinLat
  return { x, y, z } // km
}
function ecfToLookAngles(
  obsLatDeg: number,
  obsLonDeg: number,
  obsAltM: number,
  satEcf: { x: number; y: number; z: number }
) {
  const obs = geodeticToEcef(obsLatDeg, obsLonDeg, obsAltM)
  const rx = satEcf.x - obs.x, ry = satEcf.y - obs.y, rz = satEcf.z - obs.z
  const lat = obsLatDeg * DEG2RAD, lon = obsLonDeg * DEG2RAD
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon), cosLon = Math.cos(lon)
  const e = -sinLon * rx + cosLon * ry
  const n = -sinLat * cosLon * rx - sinLat * sinLon * ry + cosLat * rz
  const u =  cosLat * cosLon * rx + cosLat * sinLon * ry + sinLat * rz
  const range = Math.sqrt(e*e + n*n + u*u)
  const elev = Math.asin(u / range) * RAD2DEG
  const az = (Math.atan2(e, n) * RAD2DEG + 360) % 360
  return { azimuthDeg: az, elevationDeg: elev, rangeKm: range }
}

/* --------------------------- Demo satellite dataset ----------------------- */
const DEMO_SATS: SatInput[] = [
  { norad_id: 25544, name: 'ISS (demo)',     orbit: 'LEO' },
  { norad_id: 20580, name: 'NOAA-18 (demo)', orbit: 'LEO' },
  { norad_id: 24876, name: 'GPS IIR-2',      orbit: 'MEO' },
  { norad_id: 41866, name: 'GOES-16',        orbit: 'GEO' },
]

/* ---------------------------------- Earth --------------------------------- */
function Earth({
  textures,
}: {
  textures?: { color?: string; normal?: string; specular?: string; night?: string; clouds?: string }
}) {
  const paths = useMemo(
    () => [textures?.color, textures?.normal, textures?.specular, textures?.night, textures?.clouds]
      .filter(Boolean) as string[],
    [textures]
  )
  const maps = useTexture(paths) as (THREE.Texture | undefined)[]
  maps.forEach(t => { if (t) t.colorSpace = THREE.SRGBColorSpace })
  const [colorMap, normalMap, specMap, nightMap, cloudsMap] = maps

  return (
    <group /* Earth-fixed frame (sats move relative to it) */>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 128, 64]} />
        {colorMap ? (
          <meshStandardMaterial
            map={colorMap}
            normalMap={normalMap}
            metalnessMap={specMap}
            metalness={specMap ? 0.1 : 0.02}
            roughness={0.9}
            emissiveMap={nightMap}
            emissiveIntensity={nightMap ? 1.2 : 0}
            emissive={nightMap ? new THREE.Color('#ffffff') : new THREE.Color('#000000')}
          />
        ) : (
          <meshStandardMaterial color={0x2a4a6a} roughness={0.9} metalness={0.02} />
        )}
      </mesh>

      {cloudsMap && (
        <mesh scale={1.015}>
          <sphereGeometry args={[1, 128, 64]} />
          <meshStandardMaterial
            map={cloudsMap}
            transparent
            opacity={0.6}
            depthWrite={false}
            roughness={1.0}
            metalness={0}
          />
        </mesh>
      )}
    </group>
  )
}

/* ------------------------------ Antenna marker ---------------------------- */
function AntennaMarker({ pos }: { pos: THREE.Vector3 | null }) {
  if (!pos) return null
  return (
    <group position={pos.toArray()}>
      <mesh castShadow>
        <coneGeometry args={[0.02, 0.08, 12]} />
        <meshBasicMaterial color={0x00ff00} toneMapped={false} />
      </mesh>
      <Billboard follow>
        <Text fontSize={0.05} color="#34d399" outlineWidth={0.003} outlineColor="black">
          ANTENNA
        </Text>
      </Billboard>
    </group>
  )
}

/* -------------------------------- Beam cone -------------------------------- */
function BeamCone({
  origin, direction, length = 0.9, halfAngleDeg = 2.0, active = true,
}: {
  origin: THREE.Vector3
  direction: THREE.Vector3 // normalized
  length?: number
  halfAngleDeg?: number
  active?: boolean
}) {
  const half = halfAngleDeg * DEG2RAD
  const radius = Math.tan(half) * length
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return q
  }, [direction])
  const pos = useMemo(() => origin.clone().add(direction.clone().multiplyScalar(length * 0.5)), [origin, direction, length])

  return (
    <mesh position={pos} quaternion={quat}>
      <coneGeometry args={[radius, length, 24, 1, true]} />
      <meshBasicMaterial color={active ? '#22c55e' : '#ef4444'} transparent opacity={0.25} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

/* ------------------------------ Satellite marker -------------------------- */
function SatelliteMarker({
  sat, gsLat, gsLon, gsAltM, gsPosScene, showLabel,
}: {
  sat: SatInput
  gsLat: number | null
  gsLon: number | null
  gsAltM: number
  gsPosScene: THREE.Vector3 | null
  showLabel: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const labelRef = useRef<any>(null)

  const baseColor =
    ({ LEO: 0xff6b6b, MEO: 0x4ecdc4, HEO: 0x45b7d1, GEO: 0x96ceb4 } as Record<string, number>)[
      sat.orbit || ''
    ] ?? 0xffffff

  const orbit = useMemo(() => {
    const baseR =
      ({ LEO: 1.25, MEO: 2.0, GEO: 2.8, HEO: 3.2 } as Record<string, number>)[sat.orbit || ''] ?? 2.0
    const seed = typeof sat.norad_id === 'number' ? sat.norad_id : Number.parseInt(String(sat.norad_id), 10) || 0
    const phase = ((seed % 360) * Math.PI) / 180
    const incl = sat.orbit === 'GEO' ? 0 : ((seed % 60) - 30) * DEG2RAD // ±30°
    return { rKm: EARTH_RADIUS_KM * baseR, phase, incl }
  }, [sat.orbit, sat.norad_id])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime
    const w = 0.0015
    const ang = w * t + orbit.phase
    const r = orbit.rKm

    // simple circular belt with inclination
    const x0 = r * Math.cos(ang)
    const y0 = r * Math.sin(ang)
    const z0 = 0
    const ci = Math.cos(orbit.incl), si = Math.sin(orbit.incl)
    const x = x0
    const y = y0 * ci - z0 * si
    const z = y0 * si + z0 * ci

    // ECEF (x,y,z km) -> scene (x,z,y) scaled
    const px = x * KM_TO_SCENE, py = z * KM_TO_SCENE, pz = y * KM_TO_SCENE
    groupRef.current.position.set(px, py, pz)

    // LOS/elevation
    let visible = false
    let elev: number | undefined
    if (gsLat != null && gsLon != null) {
      const look = ecfToLookAngles(gsLat, gsLon, gsAltM, { x, y, z })
      elev = look.elevationDeg
      visible = elev > ELEV_MASK_DEG
    }

    // color by visibility
    const mat = (groupRef.current.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    mat.color.setHex(visible ? 0x22c55e : baseColor)

    // label
    if (labelRef.current && showLabel) {
      labelRef.current.text = `${sat.name}${elev != null ? ` • ${elev.toFixed(0)}°` : ''}`
      labelRef.current.material.color = new THREE.Color(visible ? '#22c55e' : '#ffffff')
    }

    // beam cone
    if (gsPosScene) {
      if (groupRef.current.children.length < 2) groupRef.current.add(new THREE.Object3D())
      const beamGroup = groupRef.current.children[1] as THREE.Object3D
      while (beamGroup.children.length) beamGroup.remove(beamGroup.children[0])
      const dir = new THREE.Vector3(px, py, pz).clone().sub(gsPosScene).normalize()
      const Beam = (
        <BeamCone key="beam" origin={gsPosScene} direction={dir} length={0.9} halfAngleDeg={2} active={visible} />
      ) as unknown as THREE.Object3D
      // @ts-ignore add React element via reconciler
      beamGroup.add(Beam)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <boxGeometry args={[0.02, 0.02, 0.02]} />
        <meshBasicMaterial color={baseColor} toneMapped={false} />
      </mesh>
      {showLabel && (
        <Billboard follow>
          <Text ref={labelRef} fontSize={0.04} color="#ffffff" outlineWidth={0.003} outlineColor="black" maxWidth={0.7}>
            {sat.name}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

/* ------------------------------ Satellites layer -------------------------- */
function SatelliteLayer({
  enabled, gsLat, gsLon, gsAltM, gsPosScene, showLabels,
}: {
  enabled: boolean
  gsLat: number | null
  gsLon: number | null
  gsAltM: number
  gsPosScene: THREE.Vector3 | null
  showLabels: boolean
}) {
  // Read your store for future parity (ignored for demo content)
  const _storeList = (useSatelliteData() as { list?: SatInput[] } | undefined)?.list ?? []
  const list = enabled ? DEMO_SATS : []
  if (!enabled || list.length === 0) return null
  return (
    <>
      {list.map((s) => (
        <SatelliteMarker
          key={s.norad_id}
          sat={s}
          gsLat={gsLat}
          gsLon={gsLon}
          gsAltM={gsAltM}
          gsPosScene={gsPosScene}
          showLabel={showLabels}
        />
      ))}
    </>
  )
}

/* --------------------------------- Root view ------------------------------ */
export type ViewMode = 'blue-marble' | 'realistic' | 'day-night' | 'full'

export function GlobalView() {
  const telemetry = useTelemetryData()

  // UI state
  const [satEnabled, setSatEnabled] = useState<'none' | 'demo'>('demo')
  const [autoRotate, setAutoRotate] = useState(false)
  const [enablePan, setEnablePan] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [currentTime, setCurrentTime] = useState(new Date())

  // refs for controls reset
  const controlsRef = useRef<any>(null)

  // GS geodetic & scene position
  const gsLat = telemetry?.gps?.lat ?? null
  const gsLon = telemetry?.gps?.lon ?? null
  const gsAltM = telemetry?.gps?.alt_m ?? 0
  const gsPosScene = useMemo(() => {
    if (gsLat == null || gsLon == null) return null
    const ecf = geodeticToEcef(gsLat, gsLon, gsAltM)
    return new THREE.Vector3(ecf.x * KM_TO_SCENE, ecf.z * KM_TO_SCENE, ecf.y * KM_TO_SCENE)
  }, [gsLat, gsLon, gsAltM])

  // Texture configuration based on view mode
  const earthTextures = useMemo(() => {
    switch (viewMode) {
      case 'blue-marble':
        return {}
      case 'realistic':
        return { color: '/tex/earth_day_2k.jpg' }
      case 'day-night':
        return {
          color: '/tex/earth_day_2k.jpg',
          night: '/tex/earth_night_2k.jpg',
        }
      case 'full':
        return {
          color: '/tex/earth_day_2k.jpg',
          night: '/tex/earth_night_2k.jpg',
          clouds: '/tex/earth_clouds_2k.jpg',
        }
      default:
        return {}
    }
  }, [viewMode])

  // Calculate sun position based on current time and GPS location
  const sunPosition = useMemo(() => {
    // Use actual GPS coordinates if available, otherwise use equator
    const lat = gsLat ?? 0
    const lon = gsLon ?? 0

    const solarPos = calculateSunPosition(currentTime, lat, lon)

    // Return position for Three.js (x, y, z)
    return [solarPos.x, solarPos.y, solarPos.z] as [number, number, number]
  }, [currentTime, gsLat, gsLon])

  // Time control callback
  const handleTimeChange = useCallback((newTime: Date) => {
    setCurrentTime(newTime)
  }, [])

  return (
    <div className="relative w-full min-h-[600px] h-full">
      {/* Canvas */}
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 55 }}
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace }}
        style={{ touchAction: 'none' }} // enable pointer gestures on mobile
      >
        {/* background & env */}
        <color attach="background" args={['#001b3a']} />
        <Environment preset="night" />
        <Stars radius={200} depth={60} count={2000} factor={4} fade />

        {/* lights - simulating sun */}
        <ambientLight intensity={0.15} />
        <hemisphereLight intensity={0.08} groundColor="#0b1020" />
        {/* Sun positioned based on user-controlled angle */}
        <directionalLight position={sunPosition} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.001} shadow-normalBias={0.02} />

        {/* earth with dynamic textures based on view mode */}
        <Earth textures={earthTextures} />

        {/* antenna + satellites */}
        <AntennaMarker pos={gsPosScene} />
        <SatelliteLayer
          enabled={satEnabled === 'demo'}
          gsLat={gsLat}
          gsLon={gsLon}
          gsAltM={gsAltM ?? 0}
          gsPosScene={gsPosScene}
          showLabels={showLabels}
        />

        {/* controls */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={enablePan}
          enableZoom
          enableRotate
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
          minDistance={1.6}
          maxDistance={6}
          dampingFactor={0.08}
          enableDamping
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* UI overlay */}
      <div className="pointer-events-none absolute inset-0">
        {/* control panel */}
        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col gap-2 bg-black/60 text-white rounded-xl p-3 backdrop-blur-sm max-w-[280px]">
          <div className="text-sm font-semibold tracking-wide">Global View</div>

          {/* View Mode Selection */}
          <div className="flex flex-col gap-1">
            <span className="text-xs opacity-80">View Mode</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                className={`px-2 py-1 rounded text-xs ${viewMode === 'blue-marble' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
                onClick={() => setViewMode('blue-marble')}
                title="Simple blue sphere"
              >
                Blue Marble
              </button>
              <button
                className={`px-2 py-1 rounded text-xs ${viewMode === 'realistic' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
                onClick={() => setViewMode('realistic')}
                title="Day texture only"
              >
                Realistic
              </button>
              <button
                className={`px-2 py-1 rounded text-xs ${viewMode === 'day-night' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
                onClick={() => setViewMode('day-night')}
                title="Day and night city lights"
              >
                Day/Night
              </button>
              <button
                className={`px-2 py-1 rounded text-xs ${viewMode === 'full' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
                onClick={() => setViewMode('full')}
                title="Full detail with clouds"
              >
                Full Detail
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs opacity-80">Satellites</span>
            <div className="flex gap-1">
              <button
                className={`px-2 py-1 rounded text-xs ${satEnabled === 'none' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
                onClick={() => setSatEnabled('none')}
              >
                None
              </button>
              <button
                className={`px-2 py-1 rounded text-xs ${satEnabled === 'demo' ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
                onClick={() => setSatEnabled('demo')}
              >
                Demo
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs opacity-80">Auto-rotate</span>
            <button
              className={`px-2 py-1 rounded text-xs ${autoRotate ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
              onClick={() => setAutoRotate(v => !v)}
            >
              {autoRotate ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs opacity-80">Pan</span>
            <button
              className={`px-2 py-1 rounded text-xs ${enablePan ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
              onClick={() => setEnablePan(v => !v)}
            >
              {enablePan ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs opacity-80">Labels</span>
            <button
              className={`px-2 py-1 rounded text-xs ${showLabels ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
              onClick={() => setShowLabels(v => !v)}
            >
              {showLabels ? 'On' : 'Off'}
            </button>
          </div>

          <button
            className="pointer-events-auto mt-1 px-3 py-1.5 rounded text-xs bg-white/10 hover:bg-white/20 transition"
            onClick={() => controlsRef.current?.reset?.()}
          >
            Reset View
          </button>
        </div>

        {/* Time Control - Cesium style */}
        <div className="pointer-events-auto absolute bottom-3 left-1/2 transform -translate-x-1/2">
          <TimeControl onTimeChange={handleTimeChange} />
        </div>

        {/* interaction hint */}
        <div className="pointer-events-none absolute left-3 top-3 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
          Drag = rotate • Right-drag = pan • Wheel/pinch = zoom
        </div>
      </div>
    </div>
  )
}
