"""
SDR Manager Service

Manages HackRF One device for spectrum analysis and beacon monitoring.
Uses hackrf_sweep for signal strength measurements.
"""

import asyncio
import logging
import subprocess
import re
import tempfile
import os
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# HackRF One USB identifiers
# Bus 001 Device 013: ID 1d50:6089 OpenMoko, Inc. Great Scott Gadgets HackRF One SDR
HACKRF_VENDOR_ID = "1d50"
HACKRF_PRODUCT_ID = "6089"
HACKRF_DEVICE_NAME = "Great Scott Gadgets HackRF One"

# Frequency limits (MHz)
HACKRF_FREQ_MIN = 1.0
HACKRF_FREQ_MAX = 6000.0

# Gain limits
HACKRF_LNA_GAIN_MIN = 0
HACKRF_LNA_GAIN_MAX = 40
HACKRF_LNA_GAIN_STEP = 8

HACKRF_VGA_GAIN_MIN = 0
HACKRF_VGA_GAIN_MAX = 62
HACKRF_VGA_GAIN_STEP = 2

# RF Amp gain
HACKRF_AMP_GAIN = 14  # dB


class SDRManager:
    """
    HackRF device manager for signal monitoring
    """

    def __init__(self):
        self.monitoring = False
        self.monitor_process: Optional[subprocess.Popen] = None
        self.current_frequency: Optional[float] = None
        self.current_settings: Dict[str, Any] = {}

    async def get_device_info(self) -> Dict[str, Any]:
        """
        Get HackRF device information using hackrf_info

        Returns:
            Dictionary with device info or error status
        """
        try:
            result = subprocess.run(
                ['hackrf_info'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0:
                logger.warning("hackrf_info failed: %s", result.stderr)
                return {
                    'connected': False,
                    'error': 'HackRF not detected'
                }

            # Parse hackrf_info output
            info = self._parse_hackrf_info(result.stdout)
            info['connected'] = True
            return info

        except FileNotFoundError:
            logger.error("hackrf_info command not found - is hackrf package installed?")
            return {
                'connected': False,
                'error': 'hackrf tools not installed'
            }
        except subprocess.TimeoutExpired:
            logger.error("hackrf_info timed out")
            return {
                'connected': False,
                'error': 'Device detection timed out'
            }
        except Exception as e:
            logger.error("Error getting device info: %s", e)
            return {
                'connected': False,
                'error': str(e)
            }

    def _parse_hackrf_info(self, output: str) -> Dict[str, str]:
        """
        Parse hackrf_info output to extract device details

        Example output:
            Found HackRF
            Serial number: 0x000000000000000054706b85252d3233
            Board ID Number: 2 (HackRF One)
            Firmware Version: 2018.01.1 (API:1.02)
        """
        info = {}

        # Extract serial number
        serial_match = re.search(r'Serial number:\s*(.+)', output)
        if serial_match:
            serial = serial_match.group(1).strip()
            # Strip leading zeros from hex string (keep at least one zero)
            serial = serial.lstrip('0') or '0'
            info['serial'] = serial

        # Extract board ID
        board_match = re.search(r'Board ID Number:\s*\d+\s*\((.+?)\)', output)
        if board_match:
            info['board_id'] = board_match.group(1).strip()

        # Extract firmware version
        firmware_match = re.search(r'Firmware Version:\s*(.+?)(?:\s*\(|$)', output)
        if firmware_match:
            info['firmware'] = firmware_match.group(1).strip()

        return info

    async def start_monitoring(
        self,
        frequency: float,
        gain_lna: int = 16,
        gain_vga: int = 20,
        amp_enabled: bool = False,
        bandwidth: float = 1.0
    ) -> Dict[str, Any]:
        """
        Start signal monitoring at specified frequency

        Args:
            frequency: Center frequency in MHz
            gain_lna: LNA gain (0-40 dB, steps of 8)
            gain_vga: VGA gain (0-62 dB, steps of 2)
            amp_enabled: Enable RF amplifier (+14 dB)
            bandwidth: Sweep bandwidth in MHz (centered on frequency)

        Returns:
            Status dictionary
        """
        if self.monitoring:
            return {
                'status': 'error',
                'message': 'Already monitoring'
            }

        try:
            # Validate parameters
            if not (HACKRF_FREQ_MIN <= frequency <= HACKRF_FREQ_MAX):
                return {
                    'status': 'error',
                    'message': f'Frequency {frequency} MHz out of range ({HACKRF_FREQ_MIN}-{HACKRF_FREQ_MAX} MHz)'
                }

            if gain_lna < HACKRF_LNA_GAIN_MIN or gain_lna > HACKRF_LNA_GAIN_MAX:
                return {
                    'status': 'error',
                    'message': f'LNA gain {gain_lna} dB out of range ({HACKRF_LNA_GAIN_MIN}-{HACKRF_LNA_GAIN_MAX} dB)'
                }

            if gain_vga < HACKRF_VGA_GAIN_MIN or gain_vga > HACKRF_VGA_GAIN_MAX:
                return {
                    'status': 'error',
                    'message': f'VGA gain {gain_vga} dB out of range ({HACKRF_VGA_GAIN_MIN}-{HACKRF_VGA_GAIN_MAX} dB)'
                }

            # Check device availability
            device_info = await self.get_device_info()
            if not device_info.get('connected'):
                return {
                    'status': 'error',
                    'message': 'HackRF not connected'
                }

            # Store current settings
            self.current_frequency = frequency
            self.current_settings = {
                'frequency': frequency,
                'gain_lna': gain_lna,
                'gain_vga': gain_vga,
                'amp_enabled': amp_enabled,
                'bandwidth': bandwidth
            }

            self.monitoring = True
            logger.info(
                "Started monitoring at %.3f MHz (LNA: %d dB, VGA: %d dB, Amp: %s)",
                frequency, gain_lna, gain_vga, amp_enabled
            )

            return {
                'status': 'success',
                'message': f'Monitoring started at {frequency} MHz',
                'settings': self.current_settings
            }

        except Exception as e:
            logger.error("Error starting monitoring: %s", e)
            self.monitoring = False
            return {
                'status': 'error',
                'message': str(e)
            }

    async def get_signal_strength(self) -> Dict[str, Any]:
        """
        Get current signal strength at monitored frequency using hackrf_sweep

        Returns:
            Dictionary with signal strength data
        """
        if not self.monitoring or self.current_frequency is None:
            return {
                'status': 'error',
                'message': 'Not monitoring'
            }

        try:
            settings = self.current_settings
            frequency_mhz = settings['frequency']
            bandwidth_mhz = settings.get('bandwidth', 1.0)

            # Calculate sweep range (centered on target frequency)
            # hackrf_sweep requires integer MHz values, so expand to include target
            freq_start = int(frequency_mhz)
            freq_end = freq_start + 1  # Sweep 1 MHz range

            # Create temporary file for sweep output
            with tempfile.NamedTemporaryFile(mode='w+', suffix='.csv', delete=False) as tmp_file:
                tmp_filename = tmp_file.name

            try:
                # Build hackrf_sweep command
                # hackrf_sweep -f start:stop -l gain_lna -g gain_vga [-a amp] -1 -r output_file
                cmd = [
                    'hackrf_sweep',
                    '-f', f'{freq_start}:{freq_end}',
                    '-l', str(settings['gain_lna']),
                    '-g', str(settings['gain_vga']),
                    '-1',  # One shot mode
                    '-r', tmp_filename  # Output file
                ]

                if settings['amp_enabled']:
                    cmd.append('-a')
                    cmd.append('1')

                # Run hackrf_sweep for one sweep
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                if result.returncode != 0:
                    logger.warning("hackrf_sweep failed: %s", result.stderr)
                    return {
                        'status': 'error',
                        'message': 'Sweep failed',
                        'power_dbm': -100.0
                    }

                # Read sweep output from file
                with open(tmp_filename, 'r') as f:
                    sweep_output = f.read()

                # Parse sweep output
                power_dbm = self._parse_sweep_output(sweep_output, frequency_mhz)

            finally:
                # Clean up temp file
                if os.path.exists(tmp_filename):
                    os.unlink(tmp_filename)

            return {
                'status': 'success',
                'timestamp': datetime.utcnow().isoformat(),
                'frequency_mhz': frequency_mhz,
                'power_dbm': power_dbm,
                'settings': settings
            }

        except subprocess.TimeoutExpired:
            logger.warning("hackrf_sweep timed out")
            return {
                'status': 'error',
                'message': 'Sweep timeout',
                'power_dbm': -100.0
            }
        except Exception as e:
            logger.error("Error getting signal strength: %s", e)
            return {
                'status': 'error',
                'message': str(e),
                'power_dbm': -100.0
            }

    def _parse_sweep_output(self, output: str, target_freq: float) -> float:
        """
        Parse hackrf_sweep output to extract power at target frequency

        hackrf_sweep output format (CSV):
        date, time, hz_low, hz_high, hz_bin_width, num_samples, dB, dB, dB, ...

        Each line contains multiple dB readings across the frequency range.
        We need to find the bin closest to our target frequency and return its power.

        Args:
            output: Raw output from hackrf_sweep
            target_freq: Target frequency in MHz

        Returns:
            Power in dBm at target frequency
        """
        try:
            lines = output.strip().split('\n')

            # Find data lines (skip header/metadata)
            max_power = -100.0

            for line in lines:
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue

                parts = line.split(',')
                if len(parts) < 7:
                    continue

                try:
                    # Parse sweep metadata
                    hz_low = float(parts[2].strip())
                    hz_high = float(parts[3].strip())
                    hz_bin_width = float(parts[4].strip())
                    # num_samples = int(parts[5].strip())

                    # Convert target frequency to Hz
                    target_hz = target_freq * 1e6

                    # Check if target frequency is in this sweep
                    if hz_low <= target_hz <= hz_high:
                        # Calculate which bin index contains our target
                        bin_index = int((target_hz - hz_low) / hz_bin_width)

                        # Get power values (start at index 6)
                        power_values = parts[6:]

                        if 0 <= bin_index < len(power_values):
                            power_db = float(power_values[bin_index].strip())
                            max_power = max(max_power, power_db)

                except (ValueError, IndexError) as e:
                    logger.debug("Error parsing sweep line: %s", e)
                    continue

            return max_power

        except Exception as e:
            logger.error("Error parsing sweep output: %s", e)
            return -100.0

    async def stop_monitoring(self) -> Dict[str, Any]:
        """
        Stop signal monitoring

        Returns:
            Status dictionary
        """
        if not self.monitoring:
            return {
                'status': 'warning',
                'message': 'Not monitoring'
            }

        try:
            self.monitoring = False
            self.current_frequency = None
            self.current_settings = {}

            logger.info("Stopped monitoring")

            return {
                'status': 'success',
                'message': 'Monitoring stopped'
            }

        except Exception as e:
            logger.error("Error stopping monitoring: %s", e)
            return {
                'status': 'error',
                'message': str(e)
            }

    def is_monitoring(self) -> bool:
        """Check if currently monitoring"""
        return self.monitoring

    def get_current_settings(self) -> Dict[str, Any]:
        """Get current monitoring settings"""
        return self.current_settings.copy() if self.monitoring else {}


# Global instance
sdr_manager = SDRManager()
