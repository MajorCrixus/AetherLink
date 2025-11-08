import React from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

export function ServosModule() {
  return (
    <div className="h-full p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Servos Module</h1>
              <p className="text-muted-foreground">MKS Servo57D Motor Controllers</p>
            </div>
          </div>
        </motion.div>
        <div className="panel">
          <div className="panel-content text-center py-12">
            <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Servo Configuration</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  )
}