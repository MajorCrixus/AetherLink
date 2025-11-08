/**
 * Mini logs widget for the dashboard
 */

import React from 'react'
import { FileText, AlertTriangle, Info, AlertCircle } from 'lucide-react'

import { useLogsData } from '@/stores/telemetryStore'
import { formatTimestamp } from '@/lib/utils'

export function LogsWidget() {
  const logs = useLogsData()
  const recentLogs = logs.slice(0, 5) // Show last 5 logs

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
      case 'ALERT':
        return <AlertCircle className="w-3 h-3 text-health-error" />
      case 'WARN':
        return <AlertTriangle className="w-3 h-3 text-health-warn" />
      case 'INFO':
        return <Info className="w-3 h-3 text-health-ok" />
      default:
        return <FileText className="w-3 h-3 text-muted-foreground" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
      case 'ALERT':
        return 'text-health-error'
      case 'WARN':
        return 'text-health-warn'
      case 'INFO':
        return 'text-health-ok'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="hud-widget h-full w-full flex flex-col">
      <div className="hud-widget-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="font-semibold">Recent Logs</span>
          <div className="ml-auto text-xs text-muted-foreground">
            {logs.length} total
          </div>
        </div>
      </div>

      <div className="hud-widget-content flex-1 overflow-y-auto overflow-x-hidden">
        {recentLogs.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No recent logs</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {recentLogs.map((log, index) => (
              <div
                key={`${log.ts}-${index}`}
                className="flex items-start gap-2 text-xs p-2 bg-secondary/20 rounded border border-secondary/30"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getLevelIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${getLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-muted-foreground">
                      {log.source}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {formatTimestamp(log.ts)}
                    </span>
                  </div>
                  <div className="text-foreground truncate">
                    {log.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {logs.length > 5 && (
          <div className="border-t border-primary/20 pt-2 mt-3">
            <button className="btn btn-ghost w-full text-xs">
              View All Logs ({logs.length - 5} more)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}