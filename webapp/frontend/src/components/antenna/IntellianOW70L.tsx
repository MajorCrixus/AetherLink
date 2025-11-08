/**
 * Realistic 3D model of Intellian OW70L marine SATCOM antenna
 * Based on the actual OW70L design (without radome or electronics)
 *
 * Components modeled:
 * - Pedestal base
 * - Azimuth frame/platform
 * - Elevation frame (yoke)
 * - Cross-level frame
 * - 70cm parabolic dish
 */

import React, { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTelemetryData } from '@/stores/telemetryStore'

// Pedestal base - sturdy circular base platform
function PedestalBase() {
  return (
    <group>
      {/* Base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 32]} />
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Central pedestal column */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.4, 16]} />
        <meshStandardMaterial
          color="#2a2a2a"
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>

      {/* Mounting ring */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.3, 0.28, 0.08, 32]} />
        <meshStandardMaterial
          color="#3a3a3a"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

// Azimuth rotating platform - large ring that rotates for azimuth
function AzimuthFrame({ rotation }: { rotation: number }) {
  return (
    <group rotation={[0, rotation * (Math.PI / 180), 0]} position={[0, 0.49, 0]}>
      {/* Main rotating platform */}
      <mesh castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.12, 32]} />
        <meshStandardMaterial
          color="#4a5a6a"
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>

      {/* Azimuth direction indicator */}
      <mesh position={[0.3, 0.08, 0]} castShadow>
        <boxGeometry args={[0.12, 0.04, 0.04]} />
        <meshStandardMaterial
          color="#ff6b6b"
          emissive="#ff6b6b"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Support posts for elevation frame */}
      <mesh position={[0.15, 0.25, 0]} castShadow>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial
          color="#3a4a5a"
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[-0.15, 0.25, 0]} castShadow>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial
          color="#3a4a5a"
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}

// Elevation yoke - U-shaped frame that tilts for elevation
function ElevationFrame({
  azRotation,
  elRotation,
  clRotation
}: {
  azRotation: number
  elRotation: number
  clRotation: number
}) {
  return (
    <group rotation={[0, azRotation * (Math.PI / 180), 0]} position={[0, 0.54, 0]}>
      {/* Elevation pivot mechanism */}
      <group position={[0, 0.4, 0]}>
        {/* Left yoke arm */}
        <mesh position={[0.18, 0, 0]} rotation={[0, 0, -elRotation * (Math.PI / 180)]} castShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial
            color="#5a6a7a"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>

        {/* Right yoke arm */}
        <mesh position={[-0.18, 0, 0]} rotation={[0, 0, -elRotation * (Math.PI / 180)]} castShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial
            color="#5a6a7a"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>

        {/* Cross-level and dish assembly */}
        <group rotation={[0, 0, -elRotation * (Math.PI / 180)]}>
          <group position={[0, 0.25, 0]} rotation={[clRotation * (Math.PI / 180), 0, 0]}>
            {/* Cross-level mechanism housing */}
            <mesh castShadow>
              <boxGeometry args={[0.25, 0.08, 0.15]} />
              <meshStandardMaterial
                color="#4a5a6a"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>

            {/* Dish mounting bracket */}
            <mesh position={[0, 0, 0.12]} castShadow>
              <boxGeometry args={[0.15, 0.06, 0.1]} />
              <meshStandardMaterial
                color="#3a4a5a"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>

            {/* Parabolic dish - 70cm OW70L dish */}
            <Dish />
          </group>
        </group>
      </group>
    </group>
  )
}

// 70cm parabolic reflector dish
function Dish() {
  // Create parabolic dish geometry
  const dishGeometry = React.useMemo(() => {
    const radius = 0.35 // 70cm diameter / 2
    const depth = 0.12  // Dish depth (f/D ratio ~0.6)
    const segments = 48

    const geometry = new THREE.SphereGeometry(
      radius,
      segments,
      segments / 2,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.4 // Parabolic curve
    )

    // Adjust vertices to create proper parabolic shape
    const positions = geometry.attributes.position.array as Float32Array
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const y = positions[i + 1]
      const z = positions[i + 2]

      // Calculate distance from center
      const r = Math.sqrt(x * x + z * z)

      // Parabolic formula: y = -(r^2)/(4*f) where f is focal length
      const f = radius / 2.5
      positions[i + 1] = -(r * r) / (4 * f)
    }

    geometry.computeVertexNormals()
    return geometry
  }, [])

  return (
    <group position={[0, 0.05, 0.28]} rotation={[-Math.PI * 0.15, 0, 0]}>
      {/* Main reflector dish */}
      <mesh geometry={dishGeometry} castShadow>
        <meshStandardMaterial
          color="#e8e8e8"
          metalness={0.95}
          roughness={0.08}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Dish rim reinforcement */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.015, 16, 48]} />
        <meshStandardMaterial
          color="#c0c0c0"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      {/* Feed support struts (3 struts) */}
      {[0, 120, 240].map((angle, i) => {
        const rad = angle * (Math.PI / 180)
        return (
          <mesh
            key={i}
            position={[Math.sin(rad) * 0.18, -0.08, Math.cos(rad) * 0.18]}
            rotation={[Math.atan2(0.08, 0.18), -rad, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.008, 0.008, 0.2, 8]} />
            <meshStandardMaterial
              color="#a0a0a0"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        )
      })}

      {/* Feed horn (simplified - actual OEM feed removed as requested) */}
      <mesh position={[0, -0.08, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.08, 16]} />
        <meshStandardMaterial
          color="#606060"
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}

// Main Intellian OW70L assembly
export function IntellianOW70L() {
  const telemetry = useTelemetryData()
  const groupRef = useRef<THREE.Group>(null)

  const azimuth = telemetry?.axes?.AZ?.actual_deg || 0
  const elevation = telemetry?.axes?.EL?.actual_deg || 0
  const crossLevel = telemetry?.axes?.CL?.actual_deg || 0

  return (
    <group ref={groupRef}>
      <PedestalBase />
      <AzimuthFrame rotation={azimuth} />
      <ElevationFrame
        azRotation={azimuth}
        elRotation={elevation}
        clRotation={crossLevel}
      />
    </group>
  )
}
