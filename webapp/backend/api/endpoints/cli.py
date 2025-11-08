"""
Embedded CLI endpoints with command whitelisting
"""

import shlex
from typing import Dict, Any, List
from fastapi import APIRouter
from pydantic import BaseModel

from ...models.telemetry import CLIResponse

router = APIRouter()

class CLIRequest(BaseModel):
    command: str

# Whitelisted commands and their handlers
ALLOWED_COMMANDS = {
    "help": "Show available commands",
    "status": "Show system status",
    "version": "Show version information",
    "limits": "Show axis limits and current positions",
    "position": "Show current positions",
    "home": "Run homing sequence",
    "stop": "Emergency stop",
    "calibrate": "Start calibration",
    "demo": "Control demo mode",
    "config": "Show configuration"
}

def validate_command(cmd: str, args: List[str]) -> bool:
    """Validate that command is whitelisted and safe"""
    if cmd not in ALLOWED_COMMANDS:
        return False

    # Additional safety checks
    for arg in args:
        # Prevent command injection
        if any(char in arg for char in [';', '&', '|', '`', '$', '(', ')']):
            return False

    return True

def execute_command(cmd: str, args: List[str]) -> CLIResponse:
    """Execute a whitelisted command"""

    if cmd == "help":
        output = "Available commands:\n"
        for command, description in ALLOWED_COMMANDS.items():
            output += f"  {command:<12} - {description}\n"
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "status":
        output = """System Status:
  Hardware Mode: Demo
  GPS: 3D Fix (8 satellites)
  IMU: Active (35.0°C)
  Servos: All OK
  Limits: All Clear
  CPU: 25% Memory: 45%
"""
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "version":
        output = """AetherLink SATCOM Control System
Version: 1.0.0
Build: 2024-01-01
Hardware: Raspberry Pi 4B
"""
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "limits":
        output = """Axis Limits and Positions:
  Azimuth:    -300.0° to +300.0° (current: 45.0°, target: 45.0°)
  Elevation:   -59.0° to  +59.0° (current: 30.0°, target: 30.0°)
  Cross-level: -10.0° to  +10.0° (current:  0.0°, target:  0.0°)
"""
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "position":
        output = """Current Positions:
  AZ: 45.0° (target: 45.0°, error: 0.0°)
  EL: 30.0° (target: 30.0°, error: 0.0°)
  CL:  0.0° (target:  0.0°, error: 0.0°)
"""
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "home":
        if args and args[0] in ["az", "el", "cl"]:
            axis = args[0].upper()
            output = f"Starting homing sequence for {axis} axis...\n"
            output += f"{axis} homing completed successfully.\n"
            return CLIResponse(stdout=output, stderr="", code=0)
        else:
            output = "Starting homing sequence for all axes...\n"
            output += "AZ homing completed successfully.\n"
            output += "EL homing completed successfully.\n"
            output += "CL homing completed successfully.\n"
            return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "stop":
        if args and args[0] in ["az", "el", "cl"]:
            axis = args[0].upper()
            output = f"Emergency stop sent to {axis} axis.\n"
        else:
            output = "Emergency stop sent to all axes.\n"
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "calibrate":
        if args and args[0] in ["az", "el", "cl", "imu", "gps"]:
            component = args[0].upper()
            output = f"Starting calibration for {component}...\n"
            output += f"{component} calibration completed successfully.\n"
        else:
            return CLIResponse(
                stdout="",
                stderr="Error: Please specify component to calibrate (az, el, cl, imu, gps)\n",
                code=1
            )
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "demo":
        if args:
            if args[0] == "on":
                profile = args[1] if len(args) > 1 else "lab"
                output = f"Demo mode enabled with profile: {profile}\n"
            elif args[0] == "off":
                output = "Demo mode disabled. Switched to hardware mode.\n"
            elif args[0] == "status":
                output = "Demo mode: Enabled (profile: lab)\n"
            else:
                return CLIResponse(
                    stdout="",
                    stderr="Error: Use 'demo on [profile]', 'demo off', or 'demo status'\n",
                    code=1
                )
        else:
            output = "Demo mode: Enabled (profile: lab)\n"
        return CLIResponse(stdout=output, stderr="", code=0)

    elif cmd == "config":
        if args and args[0] == "show":
            output = """Current Configuration:
  Demo Mode: Enabled (lab profile)
  Telemetry Rate: 10.0 Hz
  Safety Limits: Enabled
  Servo Addresses: AZ=1, EL=2, CL=3
  GPS Port: /dev/ttyAMA0
  IMU Port: /dev/imu
  RS485 Port: /dev/rs485
"""
        else:
            output = "Use 'config show' to display current configuration.\n"
        return CLIResponse(stdout=output, stderr="", code=0)

    else:
        return CLIResponse(
            stdout="",
            stderr=f"Error: Unknown command '{cmd}'\n",
            code=1
        )

@router.post("/")
async def execute_cli_command(request: CLIRequest) -> CLIResponse:
    """Execute a CLI command with security validation"""

    try:
        # Parse command line safely
        parts = shlex.split(request.command.strip())
        if not parts:
            return CLIResponse(stdout="", stderr="Error: Empty command\n", code=1)

        cmd = parts[0].lower()
        args = parts[1:] if len(parts) > 1 else []

        # Validate command is allowed
        if not validate_command(cmd, args):
            return CLIResponse(
                stdout="",
                stderr=f"Error: Command '{cmd}' not allowed or contains unsafe characters\n",
                code=1
            )

        # Execute command
        return execute_command(cmd, args)

    except Exception as e:
        return CLIResponse(
            stdout="",
            stderr=f"Error: Failed to parse command: {str(e)}\n",
            code=1
        )

@router.get("/commands")
async def list_commands() -> Dict[str, Any]:
    """Get list of available CLI commands"""
    return {
        "commands": [
            {
                "name": cmd,
                "description": desc
            }
            for cmd, desc in ALLOWED_COMMANDS.items()
        ]
    }