import React from 'react'
import { Routes, Route } from 'react-router-dom'

import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Configuration } from '@/pages/Configuration'
import { AntennaView } from '@/pages/AntennaView'
import { Modules } from '@/pages/Modules'
import { Logs } from '@/pages/Logs'
import { CLI } from '@/pages/CLI'
import { ServosPage } from '@/pages/ServosPage'
import { useWebSocket } from '@/hooks/useWebSocket'

function App() {
  // Initialize WebSocket connections
  useWebSocket()

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/config" element={<Configuration />} />
        <Route path="/antenna" element={<AntennaView />} />
        <Route path="/modules/*" element={<Modules />} />
        <Route path="/servos" element={<ServosPage />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/cli" element={<CLI />} />
      </Routes>
    </Layout>
  )
}

export default App