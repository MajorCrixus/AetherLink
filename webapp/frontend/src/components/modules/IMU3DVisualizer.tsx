/**
 * 3D IMU orientation visualizer
 * Shows real-time roll, pitch, and yaw from the WT901C sensor
 */

import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTelemetryData } from '@/stores/telemetryStore'

// IMU sensor board representation
function IMUSensorBoard({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  const groupRef = useRef<THREE.Group>(null)

  // Convert degrees to radians and apply rotation
  const rollRad = roll * (Math.PI / 180)
  const pitchRad = pitch * (Math.PI / 180)
  const yawRad = yaw * (Math.PI / 180)

  return (
    <group ref={groupRef} rotation={[pitchRad, yawRad, rollRad]}>
      {/* Main PCB board */}
      <mesh>
        <boxGeometry args={[1, 0.05, 0.6]} />
        <meshStandardMaterial color="#1a472a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Components on board */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.3]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Axis indicators */}
      {/* Forward arrow (X-axis - Roll) */}
      <group position={[0.6, 0.03, 0]}>
        <mesh>
          <coneGeometry args={[0.05, 0.15, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0.15, 0, 0]}
          fontSize={0.1}
          color="#ff0000"
          anchorX="left"
          anchorY="middle"
        >
          FORWARD
        </Text>
      </group>

      {/* Up arrow (Y-axis - Pitch) */}
      <group position={[0, 0.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh>
          <coneGeometry args={[0.05, 0.15, 8]} />
          <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0.15, 0, 0]}
          fontSize={0.1}
          color="#00ff00"
          anchorX="left"
          anchorY="middle"
          rotation={[0, 0, Math.PI / 2]}
        >
          UP
        </Text>
      </group>

      {/* Right arrow (Z-axis - Yaw) */}
      <group position={[0, 0.03, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <coneGeometry args={[0.05, 0.15, 8]} />
          <meshStandardMaterial color="#0000ff" emissive="#0000ff" emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0, 0.15, 0]}
          fontSize={0.1}
          color="#0000ff"
          anchorX="center"
          anchorY="bottom"
          rotation={[Math.PI / 2, 0, 0]}
        >
          RIGHT
        </Text>
      </group>
    </group>
  )
}

// Reference ground plane and axes
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

      {/* World coordinate axes */}
      <group position={[-2, 0, -2]}>
        {/* X axis */}
        <mesh position={[0.25, 0.01, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.02]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
        <Text position={[0.6, 0.01, 0]} fontSize={0.1} color="#ff0000">
          X
        </Text>

        {/* Y axis */}
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.02, 0.5, 0.02]} />
          <meshBasicMaterial color="#00ff00" />
        </mesh>
        <Text position={[0, 0.6, 0]} fontSize={0.1} color="#00ff00">
          Y
        </Text>

        {/* Z axis */}
        <mesh position={[0, 0.01, 0.25]}>
          <boxGeometry args={[0.02, 0.02, 0.5]} />
          <meshBasicMaterial color="#0000ff" />
        </mesh>
        <Text position={[0, 0.01, 0.6]} fontSize={0.1} color="#0000ff">
          Z
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
        camera={{ position: [2, 2, 2], fov: 50 }}
        gl={{
          antialias: false,  // Disable antialiasing for better performance
          powerPreference: 'low-power',  // Use low-power GPU mode
          preserveDrawingBuffer: true  // Prevent context loss
        }}
        dpr={1}  // Use device pixel ratio of 1 for performance
      >
        <Lighting />
        <ReferenceFrame />
        <IMUSensorBoard roll={roll} pitch={pitch} yaw={yaw} />

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
