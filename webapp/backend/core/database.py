"""
Database configuration and models
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

from .config import settings

# Database setup
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# Models
class SystemConfig(Base):
    """System configuration storage"""
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class LogEntry(Base):
    """System logs"""
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    level = Column(String(20), nullable=False, index=True)
    source = Column(String(50), nullable=False, index=True)
    message = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)

class TelemetrySnapshot(Base):
    """Periodic telemetry snapshots for historical data"""
    __tablename__ = "telemetry_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)

    # GPS data
    gps_lat = Column(Float, nullable=True)
    gps_lon = Column(Float, nullable=True)
    gps_alt_m = Column(Float, nullable=True)
    gps_fix = Column(Integer, nullable=True)
    gps_sats = Column(Integer, nullable=True)
    gps_hdop = Column(Float, nullable=True)

    # IMU data
    imu_roll_deg = Column(Float, nullable=True)
    imu_pitch_deg = Column(Float, nullable=True)
    imu_yaw_deg = Column(Float, nullable=True)
    imu_temp_c = Column(Float, nullable=True)

    # Servo positions
    az_target_deg = Column(Float, nullable=True)
    az_actual_deg = Column(Float, nullable=True)
    el_target_deg = Column(Float, nullable=True)
    el_actual_deg = Column(Float, nullable=True)
    cl_target_deg = Column(Float, nullable=True)
    cl_actual_deg = Column(Float, nullable=True)

    # System status
    demo_mode = Column(Boolean, default=False)

class SatellitePass(Base):
    """Predicted satellite passes"""
    __tablename__ = "satellite_passes"

    id = Column(Integer, primary_key=True, index=True)
    norad_id = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    aos_time = Column(DateTime, nullable=False, index=True)
    los_time = Column(DateTime, nullable=False)
    max_elevation_deg = Column(Float, nullable=False)
    max_elevation_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())

class ServoCommandHistory(Base):
    """Servo command history for console logging"""
    __tablename__ = "servo_command_history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True, nullable=False)
    axis = Column(String(10), nullable=False, index=True)
    command = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    request = Column(JSON, nullable=True)
    response = Column(JSON, nullable=True)
    message = Column(Text, nullable=True)

# Database initialization
async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncSession:
    """Get database session"""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

# Configuration helpers
async def get_config(key: str, default=None):
    """Get configuration value"""
    async with async_session_maker() as session:
        result = await session.get(SystemConfig, key)
        return result.value if result else default

async def set_config(key: str, value):
    """Set configuration value"""
    async with async_session_maker() as session:
        config = await session.get(SystemConfig, key)
        if config:
            config.value = value
            config.updated_at = datetime.utcnow()
        else:
            config = SystemConfig(key=key, value=value)
            session.add(config)
        await session.commit()

# Logging helpers
async def log_entry(level: str, source: str, message: str, data: Optional[dict] = None):
    """Add log entry to database"""
    async with async_session_maker() as session:
        entry = LogEntry(
            level=level,
            source=source,
            message=message,
            data=data
        )
        session.add(entry)
        await session.commit()

# Servo command history helpers
async def save_servo_command(axis: str, command: str, status: str, request: Optional[dict] = None, response: Optional[dict] = None, message: Optional[str] = None):
    """Save servo command to history"""
    from sqlalchemy import select, delete

    async with async_session_maker() as session:
        # Add new command
        entry = ServoCommandHistory(
            axis=axis,
            command=command,
            status=status,
            request=request,
            response=response,
            message=message
        )
        session.add(entry)

        # Keep only last 20 commands
        count_stmt = select(func.count()).select_from(ServoCommandHistory)
        result = await session.execute(count_stmt)
        count = result.scalar()

        if count >= 20:
            # Delete oldest entries beyond 20
            delete_stmt = delete(ServoCommandHistory).where(
                ServoCommandHistory.id.in_(
                    select(ServoCommandHistory.id)
                    .order_by(ServoCommandHistory.timestamp.asc())
                    .limit(count - 19)
                )
            )
            await session.execute(delete_stmt)

        await session.commit()

async def get_servo_command_history(limit: int = 20):
    """Get recent servo command history"""
    from sqlalchemy import select

    async with async_session_maker() as session:
        stmt = (
            select(ServoCommandHistory)
            .order_by(ServoCommandHistory.timestamp.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        entries = result.scalars().all()

        # Convert to dict format
        return [
            {
                "id": entry.id,
                "timestamp": entry.timestamp.isoformat(),
                "axis": entry.axis,
                "command": entry.command,
                "status": entry.status,
                "request": entry.request,
                "response": entry.response,
                "message": entry.message
            }
            for entry in entries
        ]