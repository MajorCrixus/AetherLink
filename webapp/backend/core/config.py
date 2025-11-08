"""
Application configuration management
"""

from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 9000
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./aetherlink.db"

    # Security
    SECRET_KEY: str = "aetherlink-dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS - Allow access from network
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://192.168.68.135:3000",  # RPi IP
        "http://192.168.68.135:3001",  # RPi IP (frontend dev server)
        "http://192.168.68.135:9000",  # Backend direct access
    ]

    # Telemetry
    TELEMETRY_RATE_HZ: float = 20.0  # Increased from 10.0 for better real-time responsiveness
    DEMO_MODE: bool = False  # Use real hardware

    # Hardware paths (fallback defaults)
    GPS_PORT: str = "/dev/gps"
    IMU_PORT: str = "/dev/imu"
    RS485_PORT: str = "/dev/rs485"

    # Servo addresses
    SERVO_AZ_ADDR: int = 1  # Azimuth
    SERVO_EL_ADDR: int = 2  # Elevation
    SERVO_CL_ADDR: int = 3  # Cross-level

    # Safety limits (degrees)
    AZ_MIN: float = -300.0
    AZ_MAX: float = 300.0
    EL_MIN: float = -59.0
    EL_MAX: float = 59.0
    CL_MIN: float = -10.0
    CL_MAX: float = 10.0

    # Motion limits
    MAX_SPEED_RPM: int = 45
    DEFAULT_ACCELERATION: int = 10

    # Motion control parameters (anti-oscillation)
    SETTLING_TIME_MS: int = 800  # Time to wait after movement before engaging position hold
    WORKING_CURRENT_MA: int = 1600  # Current during active movement
    HOLDING_CURRENT_MA: int = 800  # Current when holding position (lower = less oscillation)
    IDLE_CURRENT_MA: int = 400  # Current when not holding position
    CURRENT_RAMP_DURATION_MS: int = 250  # Duration to ramp current changes

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_TO_FILE: bool = True
    LOG_FILE: str = "aetherlink.log"

    # CLI whitelist
    CLI_ALLOWED_COMMANDS: List[str] = [
        "status", "help", "version", "limits", "position", "home", "stop", "calibrate"
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()