import React from 'react'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'

export function Logs() {
  return (
    <div className="h-full p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Logs & Events</h1>
          <p className="text-muted-foreground">System logs and event monitoring</p>
        </motion.div>
        <div className="panel">
          <div className="panel-content text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Logs & Events</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  )
}