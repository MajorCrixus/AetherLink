import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal as TerminalIcon, HelpCircle, List } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { cliApi, CommandInfo } from '@/services/cliApi'

export function CLI() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const commandHistoryRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)
  const currentLineRef = useRef<string>('')
  const [availableCommands, setAvailableCommands] = useState<CommandInfo[]>([])
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    // Load available commands
    cliApi.getCommands().then(response => {
      setAvailableCommands(response.commands)
    }).catch(err => {
      console.error('Failed to load commands:', err)
    })
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#00ff00',
        cursor: '#00ff00',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#808080',
        brightRed: '#ff8080',
        brightGreen: '#80ff80',
        brightYellow: '#ffff80',
        brightBlue: '#8080ff',
        brightMagenta: '#ff80ff',
        brightCyan: '#80ffff',
        brightWhite: '#ffffff'
      },
      rows: 30
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Welcome message
    term.writeln('\x1b[1;32m╔═══════════════════════════════════════════════════════╗\x1b[0m')
    term.writeln('\x1b[1;32m║      AetherLink SATCOM Control CLI v1.0.0             ║\x1b[0m')
    term.writeln('\x1b[1;32m╚═══════════════════════════════════════════════════════╝\x1b[0m')
    term.writeln('')
    term.writeln('\x1b[1;33mWelcome to the AetherLink embedded CLI.\x1b[0m')
    term.writeln('\x1b[1;33mType "help" to see available commands.\x1b[0m')
    term.writeln('')
    term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')

    let currentLine = ''

    // Handle keyboard input
    term.onData((data) => {
      const code = data.charCodeAt(0)

      // Handle Enter
      if (code === 13) {
        term.writeln('')
        const command = currentLine.trim()

        if (command) {
          // Add to history
          commandHistoryRef.current.push(command)
          historyIndexRef.current = commandHistoryRef.current.length

          // Execute command
          executeCommand(term, command)
        } else {
          term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')
        }

        currentLine = ''
        currentLineRef.current = ''
      }
      // Handle Backspace
      else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          currentLineRef.current = currentLine
          term.write('\b \b')
        }
      }
      // Handle Ctrl+C
      else if (code === 3) {
        term.writeln('^C')
        currentLine = ''
        currentLineRef.current = ''
        term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')
      }
      // Handle Up Arrow (previous command)
      else if (data === '\x1b[A') {
        if (commandHistoryRef.current.length > 0 && historyIndexRef.current > 0) {
          historyIndexRef.current--
          // Clear current line
          term.write('\r\x1b[K')
          term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')
          // Write history command
          const historyCmd = commandHistoryRef.current[historyIndexRef.current]
          term.write(historyCmd)
          currentLine = historyCmd
          currentLineRef.current = historyCmd
        }
      }
      // Handle Down Arrow (next command)
      else if (data === '\x1b[B') {
        if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
          historyIndexRef.current++
          // Clear current line
          term.write('\r\x1b[K')
          term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')
          // Write history command
          const historyCmd = commandHistoryRef.current[historyIndexRef.current]
          term.write(historyCmd)
          currentLine = historyCmd
          currentLineRef.current = historyCmd
        } else if (historyIndexRef.current === commandHistoryRef.current.length - 1) {
          historyIndexRef.current = commandHistoryRef.current.length
          // Clear current line
          term.write('\r\x1b[K')
          term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')
          currentLine = ''
          currentLineRef.current = ''
        }
      }
      // Handle printable characters
      else if (code >= 32 && code < 127) {
        currentLine += data
        currentLineRef.current = currentLine
        term.write(data)
      }
    })

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  const executeCommand = async (term: Terminal, command: string) => {
    try {
      const response = await cliApi.execute(command)

      // Display stdout
      if (response.stdout) {
        const lines = response.stdout.split('\n')
        lines.forEach(line => {
          if (line) term.writeln('\x1b[1;37m' + line + '\x1b[0m')
        })
      }

      // Display stderr
      if (response.stderr) {
        const lines = response.stderr.split('\n')
        lines.forEach(line => {
          if (line) term.writeln('\x1b[1;31m' + line + '\x1b[0m')
        })
      }

      // Display exit code if non-zero
      if (response.code !== 0) {
        term.writeln(`\x1b[1;31m[Exit code: ${response.code}]\x1b[0m`)
      }
    } catch (error) {
      term.writeln(`\x1b[1;31mError: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`)
    }

    // New prompt
    term.write('\x1b[1;36maetherlink@rpi\x1b[0m:\x1b[1;34m~\x1b[0m$ ')
  }

  return (
    <div className="h-full p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <TerminalIcon className="w-8 h-8" />
                Command Line Interface
              </h1>
              <p className="text-muted-foreground">Execute whitelisted commands and scripts on the Raspberry Pi</p>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <List className="w-5 h-5" />
              {showHelp ? 'Hide' : 'Show'} Commands
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: showHelp ? '1fr 300px' : '1fr' }}>
          {/* Terminal */}
          <motion.div
            layout
            className="panel"
          >
            <div className="panel-content p-4">
              <div
                ref={terminalRef}
                className="rounded-lg overflow-hidden"
                style={{ height: '600px' }}
              />
            </div>
          </motion.div>

          {/* Commands Help Panel */}
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="panel"
            >
              <div className="panel-header">
                <HelpCircle className="w-5 h-5" />
                <span>Available Commands</span>
              </div>
              <div className="panel-content p-4">
                <div className="space-y-3 text-sm">
                  {availableCommands.map((cmd) => (
                    <div key={cmd.name} className="border-b border-secondary pb-2">
                      <div className="font-mono font-semibold text-primary">{cmd.name}</div>
                      <div className="text-muted-foreground text-xs mt-1">{cmd.description}</div>
                    </div>
                  ))}
                  {availableCommands.length === 0 && (
                    <div className="text-muted-foreground text-center py-4">
                      Loading commands...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20"
        >
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-400 font-semibold mb-1">Security Notice</p>
              <p className="text-muted-foreground">
                Only whitelisted commands are permitted for security. Command injection attempts will be blocked.
                Use <span className="font-mono text-primary">help</span> to see all available commands.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
