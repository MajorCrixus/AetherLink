/**
 * 3D IMU orientation visualizer
 * Shows real-time roll, pitch, and yaw from the WT901C sensor
 */

import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTelemetryData } from '@/stores/telemetryStore'

// Antenna dish with IMU representation
function AntennaDishWithIMU({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  const groupRef = useRef<THREE.Group>(null)

  // IMU mounting offset - the IMU is physically mounted at ~35° pitch on the dish back
  const MOUNTING_OFFSET_PITCH = 34.7 * (Math.PI / 180) // Convert to radians

  // Convert IMU readings to radians
  const rollRad = roll * (Math.PI / 180)
  const pitchRad = pitch * (Math.PI / 180)
  const yawRad = yaw * (Math.PI / 180)

  return (
    <group ref={groupRef} rotation={[pitchRad, yawRad, rollRad]}>
      {/* Parabolic satellite dish */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.15]}>
        <sphereGeometry args={[0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#e8e8e8"
          metalness={0.9}
          roughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Dish rim/edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.15]}>
        <torusGeometry args={[0.6, 0.015, 8, 32]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Feed assembly (LNB arm) */}
      <group position={[0, 0, 0]}>
        {/* Center support arm */}
        <mesh position={[0, 0, -0.3]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          <meshStandardMaterial color="#4a4a4a" metalness={0.7} roughness={0.4} />
        </mesh>

        {/* LNB feed horn at the focal point */}
        <mesh position={[0, 0, -0.6]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.06, 0.15, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* LNB housing */}
        <mesh position={[0, 0, -0.68]}>
          <boxGeometry args={[0.12, 0.08, 0.08]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>

      {/* IMU mounting plate on dish back */}
      <mesh position={[0, 0, 0.2]} rotation={[MOUNTING_OFFSET_PITCH, 0, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.1]} />
        <meshStandardMaterial color="#1a472a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Small IMU sensor representation */}
      <mesh position={[0, 0, 0.22]} rotation={[MOUNTING_OFFSET_PITCH, 0, 0]}>
        <boxGeometry args={[0.08, 0.015, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Pointing vector - shows where the dish is aimed */}
      <group position={[0, 0, -0.75]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
          <meshStandardMaterial
            color="#00ff00"
            emissive="#00ff00"
            emissiveIntensity={0.8}
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Arrowhead */}
        <mesh position={[0, 0, -0.3]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.025, 0.08, 8]} />
          <meshStandardMaterial
            color="#00ff00"
            emissive="#00ff00"
            emissiveIntensity={0.8}
          />
        </mesh>

        <Text
          position={[0, 0, -0.4]}
          fontSize={0.08}
          color="#00ff00"
          anchorX="center"
          anchorY="middle"
        >
          POINTING
        </Text>
      </group>

      {/* Axis indicators (from IMU perspective) */}
      {/* X-axis - Right (Red) */}
      <group position={[0.5, 0, 0.2]} rotation={[MOUNTING_OFFSET_PITCH, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.03, 0.12, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0.12, 0, 0]}
          fontSize={0.08}
          color="#ff0000"
          anchorX="left"
          anchorY="middle"
        >
          X
        </Text>
      </group>

      {/* Y-axis - Up (Green) */}
      <group position={[0, 0.25, 0.2]} rotation={[MOUNTING_OFFSET_PITCH, 0, 0]}>
        <mesh>
          <coneGeometry args={[0.03, 0.12, 8]} />
          <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0, 0.12, 0]}
          fontSize={0.08}
          color="#00ff00"
          anchorX="center"
          anchorY="bottom"
        >
          Y
        </Text>
      </group>

      {/* Z-axis - Pointing direction (Blue) */}
      <group position={[0, 0, -0.1]} rotation={[MOUNTING_OFFSET_PITCH, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.03, 0.12, 8]} />
          <meshStandardMaterial color="#0000ff" emissive="#0000ff" emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0, 0, -0.12]}
          fontSize={0.08}
          color="#0000ff"
          anchorX="center"
          anchorY="top"
          rotation={[Math.PI / 2, 0, 0]}
        >
          Z
        </Text>
      </group>
    </group>
  )
}

// Reference ground plane and axes with compass
function ReferenceFrame() {
  return (
    <>
      <Grid
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#9d9d9d"
        fadeDistance={15}
        fadeStrength={1}
      />

      {/* Compass rose on ground */}
      <group position={[0, 0.01, 0]}>
        {/* North (Z+) */}
        <Text position={[0, 0, 1.5]} fontSize={0.15} color="#ffffff" anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
          N
        </Text>
        <mesh position={[0, 0, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.05, 0.15, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* South (Z-) */}
        <Text position={[0, 0, -1.5]} fontSize={0.15} color="#888888" anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
          S
        </Text>

        {/* East (X+) */}
        <Text position={[1.5, 0, 0]} fontSize={0.15} color="#aaaaaa" anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
          E
        </Text>

        {/* West (X-) */}
        <Text position={[-1.5, 0, 0]} fontSize={0.15} color="#aaaaaa" anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
          W
        </Text>

        {/* Compass circle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.15, 64]} />
          <meshBasicMaterial color="#666666" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* World coordinate axes */}
      <group position={[-2, 0, -2]}>
        {/* X axis - East */}
        <mesh position={[0.25, 0.01, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.02]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
        <Text position={[0.6, 0.01, 0]} fontSize={0.1} color="#ff0000">
          X (East)
        </Text>

        {/* Y axis - Up */}
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.02, 0.5, 0.02]} />
          <meshBasicMaterial color="#00ff00" />
        </mesh>
        <Text position={[0, 0.6, 0]} fontSize={0.1} color="#00ff00">
          Y (Up)
        </Text>

        {/* Z axis - North */}
        <mesh position={[0, 0.01, 0.25]}>
          <boxGeometry args={[0.02, 0.02, 0.5]} />
          <meshBasicMaterial color="#0000ff" />
        </mesh>
        <Text position={[0, 0.01, 0.6]} fontSize={0.1} color="#0000ff">
          Z (North)
        </Text>
      </group>
    </>
  )
}

// Lighting
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />
    </>
  )
}

interface IMU3DVisualizerProps {
  roll?: number
  pitch?: number
  yaw?: number
}

export function IMU3DVisualizer({ roll: propRoll, pitch: propPitch, yaw: propYaw }: IMU3DVisualizerProps = {}) {
  const telemetry = useTelemetryData()

  // Use props if provided, otherwise fall back to telemetry data
  const roll = propRoll ?? telemetry?.imu?.roll_deg ?? 0
  const pitch = propPitch ?? telemetry?.imu?.pitch_deg ?? 0
  const yaw = propYaw ?? telemetry?.imu?.yaw_deg ?? 0

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [2.5, 2, 2.5], fov: 50 }}
        gl={{
          antialias: true,  // Enable for better dish appearance
          powerPreference: 'low-power',  // Use low-power GPU mode
          preserveDrawingBuffer: true  // Prevent context loss
        }}
        dpr={1}  // Use device pixel ratio of 1 for performance
      >
        <Lighting />
        <ReferenceFrame />
        <AntennaDishWithIMU roll={roll} pitch={pitch} yaw={yaw} />

        <OrbitControls
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={8}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* Angle readouts overlay */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm p-4 rounded-lg">
        <div className="space-y-2 font-mono text-sm">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-red-400 w-16">Roll:</span>
            <span className="text-white font-bold w-20 text-right">{roll.toFixed(2)}°</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-green-400 w-16">Pitch:</span>
            <span className="text-white font-bold w-20 text-right">{pitch.toFixed(2)}°</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-blue-400 w-16">Yaw:</span>
            <span className="text-white font-bold w-20 text-right">{yaw.toFixed(2)}°</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm p-3 rounded text-xs text-muted-foreground">
        <div className="space-y-1">
          <div>Drag: Rotate view</div>
          <div>Scroll: Zoom</div>
          <div>Right-click: Pan</div>
        </div>
      </div>
    </div>
  )
}
