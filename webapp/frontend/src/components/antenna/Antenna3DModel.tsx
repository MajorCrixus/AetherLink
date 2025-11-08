/**
 * 3D Antenna visualization using Three.js
 */

import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useTelemetryData } from '@/stores/telemetryStore'
import { IntellianOW70L } from './IntellianOW70L'

// Antenna base
function AntennaBase() {
  return (
    <group>
      {/* Base platform */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.8, 0.9, 0.2, 32]} />
        <meshStandardMaterial color="#2a4a6a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Pedestal */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 0.8, 16]} />
        <meshStandardMaterial color="#1a3a5a" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Azimuth rotating platform
function AzimuthPlatform({ rotation }: { rotation: number }) {
  return (
    <group rotation={[0, rotation * (Math.PI / 180), 0]} position={[0, 0.9, 0]}>
      {/* Rotating platform */}
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.15, 32]} />
        <meshStandardMaterial color="#3a5a7a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Azimuth marker */}
      <mesh position={[0.4, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.05, 0.05]} />
        <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

// Elevation arm
function ElevationArm({ azRotation, elRotation, clRotation }: { azRotation: number; elRotation: number; clRotation: number }) {
  return (
    <group rotation={[0, azRotation * (Math.PI / 180), 0]} position={[0, 1.05, 0]}>
      {/* Elevation pivot */}
      <group rotation={[0, 0, -elRotation * (Math.PI / 180)]}>
        {/* Elevation arm */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.15, 0.6, 0.15]} />
          <meshStandardMaterial color="#4a6a8a" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Cross-level mechanism */}
        <group position={[0, 0.6, 0]} rotation={[clRotation * (Math.PI / 180), 0, 0]}>
          {/* Dish mount */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.2, 0.4, 0.1]} />
            <meshStandardMaterial color="#5a7a9a" metalness={0.6} roughness={0.4} />
          </mesh>

          {/* Antenna dish */}
          <mesh position={[0, 0.4, 0.3]} rotation={[-Math.PI / 6, 0, 0]}>
            <sphereGeometry args={[0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color="#e0e0e0"
              metalness={0.9}
              roughness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Feed horn */}
          <mesh position={[0, 0.4, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.05, 0.15, 8]} />
            <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* LNB */}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#4a4a4a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// Angle indicators
function AngleIndicators({ az, el, cl }: { az: number; el: number; cl: number }) {
  return (
    <group>
      {/* Azimuth circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.1, 1.15, 64]} />
        <meshBasicMaterial color="#4a9eff" transparent opacity={0.3} />
      </mesh>

      {/* Azimuth arrow */}
      <group rotation={[0, az * (Math.PI / 180), 0]}>
        <mesh position={[1.2, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.05, 0.1, 8]} />
          <meshBasicMaterial color="#4a9eff" />
        </mesh>
      </group>
    </group>
  )
}

// Main antenna model component - now uses Intellian OW70L
function AntennaModel() {
  const telemetry = useTelemetryData()
  const groupRef = useRef<THREE.Group>(null)

  const azimuth = telemetry?.axes?.AZ?.actual_deg || 0
  const elevation = telemetry?.axes?.EL?.actual_deg || 0
  const crossLevel = telemetry?.axes?.CL?.actual_deg || 0

  return (
    <group ref={groupRef}>
      <IntellianOW70L />
      <AngleIndicators az={azimuth} el={elevation} cl={crossLevel} />
    </group>
  )
}

// Ground grid and environment
function Environment() {
  return (
    <>
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#9d9d9d"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Ambient light */}
      <ambientLight intensity={0.4} />

      {/* Directional sun light */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Fill light */}
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      {/* Ground plane for shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </>
  )
}

// Coordinate axes helper
function CoordinateAxes() {
  return (
    <group position={[0, 0, 0]}>
      {/* X axis (Red) - East */}
      <mesh position={[0.5, 0, 0]}>
        <boxGeometry args={[1, 0.02, 0.02]} />
        <meshBasicMaterial color="red" />
      </mesh>

      {/* Y axis (Green) - Up */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.02, 1, 0.02]} />
        <meshBasicMaterial color="green" />
      </mesh>

      {/* Z axis (Blue) - North */}
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.02, 0.02, 1]} />
        <meshBasicMaterial color="blue" />
      </mesh>
    </group>
  )
}

// Main component
export function Antenna3DModel() {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [3, 2, 3], fov: 50 }}
        gl={{
          antialias: false,
          powerPreference: 'low-power',
          preserveDrawingBuffer: true
        }}
        dpr={1}
      >
        <Environment />
        <CoordinateAxes />
        <AntennaModel />

        <OrbitControls
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
          maxPolarAngle={Math.PI / 2}
          target={[0, 1, 0]}
        />
      </Canvas>
    </div>
  )
}
