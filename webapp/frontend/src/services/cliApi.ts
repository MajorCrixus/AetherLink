/**
 * CLI API service for executing commands on the RPi
 */

const API_BASE = '/api/cli'

export interface CLIRequest {
  command: string
}

export interface CLIResponse {
  stdout: string
  stderr: string
  code: number
}

export interface CommandInfo {
  name: string
  description: string
}

export interface CommandListResponse {
  commands: CommandInfo[]
}

export const cliApi = {
  /**
   * Execute a CLI command
   */
  async execute(command: string): Promise<CLIResponse> {
    const response = await fetch(`${API_BASE}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to execute command')
    }

    return response.json()
  },

  /**
   * Get list of available commands
   */
  async getCommands(): Promise<CommandListResponse> {
    const response = await fetch(`${API_BASE}/commands`)

    if (!response.ok) {
      throw new Error('Failed to get command list')
    }

    return response.json()
  }
}
