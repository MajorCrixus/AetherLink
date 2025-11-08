/**
 * Modules page with sub-routing for hardware components
 */

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { ModulesList } from '@/components/modules/ModulesList'
import { GPSModule } from '@/components/modules/GPSModule'
import { IMUModule } from '@/components/modules/IMUModule'
import { ServosModule } from '@/components/modules/ServosModule'
import { EphemerisModule } from '@/components/modules/EphemerisModule'
import { SDRModule } from '@/components/modules/SDRModule'
import { DatabaseModule } from '@/components/modules/DatabaseModule'

export function Modules() {
  return (
    <Routes>
      <Route path="/" element={<ModulesList />} />
      <Route path="/gps" element={<GPSModule />} />
      <Route path="/imu" element={<IMUModule />} />
      <Route path="/servos" element={<ServosModule />} />
      <Route path="/ephemeris" element={<EphemerisModule />} />
      <Route path="/sdr" element={<SDRModule />} />
      <Route path="/database" element={<DatabaseModule />} />
      <Route path="*" element={<Navigate to="/modules" replace />} />
    </Routes>
  )
}