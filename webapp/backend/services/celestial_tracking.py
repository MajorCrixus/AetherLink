"""
Celestial Body Tracking Service

Calculates azimuth and elevation for celestial bodies (Moon, Sun, planets)
using ephemeris data from Skyfield library (JPL DE ephemeris files).

Unlike satellites that use TLEs, celestial bodies use highly accurate
ephemeris calculations for position determination.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from skyfield.api import load, wgs84

logger = logging.getLogger(__name__)


class CelestialTracker:
    """
    Celestial body position calculator using JPL ephemeris data

    Supports: Moon, Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
    """

    def __init__(self):
        """
        Initialize celestial tracker with JPL ephemeris data

        Downloads DE421 ephemeris file (~17 MB) on first use.
        Cached in ~/.skyfield/ directory for subsequent uses.
        """
        self.ts = load.timescale()

        # Load JPL ephemeris (DE421 covers 1900-2050)
        logger.info("Loading JPL DE421 ephemeris for celestial body tracking...")
        self.planets = load('de421.bsp')
        logger.info("Ephemeris loaded successfully")

        # Map common names to ephemeris object names
        self.body_map = {
            'moon': 'moon',
            'sun': 'sun',
            'mercury': 'mercury',
            'venus': 'venus',
            'mars': 'mars',
            'jupiter': 'jupiter barycenter',
            'saturn': 'saturn barycenter',
            'uranus': 'uranus barycenter',
            'neptune': 'neptune barycenter',
            'pluto': 'pluto barycenter',
        }

    def get_body_position(
        self,
        body_name: str,
        observer_lat: float,
        observer_lon: float,
        observer_alt_m: float = 0.0,
        time: Optional[datetime] = None,
    ) -> Dict[str, float]:
        """
        Calculate celestial body azimuth and elevation from observer location

        Args:
            body_name: Name of celestial body (e.g., 'Moon', 'Sun', 'Mars')
            observer_lat: Observer latitude (degrees, -90 to 90)
            observer_lon: Observer longitude (degrees, -180 to 180)
            observer_alt_m: Observer altitude (meters above sea level)
            time: Observation time (UTC), defaults to now

        Returns:
            Dictionary with:
                - azimuth_deg: Azimuth angle in degrees (0-360, N=0, E=90)
                - elevation_deg: Elevation angle in degrees (-90 to 90)
                - distance_km: Distance to body in kilometers
                - right_ascension_deg: Right ascension in degrees
                - declination_deg: Declination in degrees

        Raises:
            ValueError: If body_name is not recognized
        """
        if time is None:
            time = datetime.now(timezone.utc)

        # Normalize body name
        body_key = body_name.lower().strip()
        if body_key not in self.body_map:
            valid_bodies = ', '.join(self.body_map.keys())
            raise ValueError(
                f"Unknown celestial body '{body_name}'. "
                f"Valid bodies: {valid_bodies}"
            )

        # Create observer location
        earth = self.planets['earth']
        observer = earth + wgs84.latlon(observer_lat, observer_lon, observer_alt_m)

        # Get celestial body
        body = self.planets[self.body_map[body_key]]

        # Convert time to Skyfield Time object
        t = self.ts.from_datetime(time)

        # Calculate body position relative to observer
        astrometric = observer.at(t).observe(body)
        apparent = astrometric.apparent()

        # Get azimuth, altitude (elevation), distance
        alt, az, distance = apparent.altaz()

        # Get right ascension and declination
        ra, dec, _ = apparent.radec()

        return {
            "azimuth_deg": az.degrees,
            "elevation_deg": alt.degrees,
            "distance_km": distance.km,
            "right_ascension_deg": ra._degrees,
            "declination_deg": dec.degrees,
        }

    def is_visible(
        self,
        body_name: str,
        observer_lat: float,
        observer_lon: float,
        observer_alt_m: float = 0.0,
        min_elevation_deg: float = 0.0,
        time: Optional[datetime] = None,
    ) -> bool:
        """
        Check if celestial body is visible (above horizon) from observer location

        Args:
            body_name: Name of celestial body
            observer_lat: Observer latitude (degrees)
            observer_lon: Observer longitude (degrees)
            observer_alt_m: Observer altitude (meters)
            min_elevation_deg: Minimum elevation for visibility (default 0.0)
            time: Observation time (UTC), defaults to now

        Returns:
            True if body is visible, False otherwise
        """
        pos = self.get_body_position(
            body_name, observer_lat, observer_lon, observer_alt_m, time
        )
        return pos["elevation_deg"] >= min_elevation_deg

    def get_moon_phase(self, time: Optional[datetime] = None) -> Dict[str, float]:
        """
        Calculate Moon phase information

        Args:
            time: Observation time (UTC), defaults to now

        Returns:
            Dictionary with:
                - phase_angle_deg: Phase angle (0=new, 180=full)
                - illumination_percent: Percent of Moon illuminated (0-100)
                - phase_name: Descriptive phase name
        """
        if time is None:
            time = datetime.now(timezone.utc)

        t = self.ts.from_datetime(time)

        # Calculate phase angle (Sun-Moon-Earth angle)
        earth = self.planets['earth']
        moon = self.planets['moon']
        sun = self.planets['sun']

        # Get Moon and Sun positions as seen from Earth
        moon_pos = earth.at(t).observe(moon)
        sun_pos = earth.at(t).observe(sun)

        # Calculate phase angle
        phase_angle = moon_pos.separation_from(sun_pos)

        # Calculate illumination percentage
        # cos(phase) = (1 + cos(phase_angle)) / 2
        illumination = (1 + phase_angle.radians) / 2 * 100

        # Determine phase name
        angle_deg = phase_angle.degrees
        if angle_deg < 22.5:
            phase_name = "New Moon"
        elif angle_deg < 67.5:
            phase_name = "Waxing Crescent"
        elif angle_deg < 112.5:
            phase_name = "First Quarter"
        elif angle_deg < 157.5:
            phase_name = "Waxing Gibbous"
        elif angle_deg < 202.5:
            phase_name = "Full Moon"
        elif angle_deg < 247.5:
            phase_name = "Waning Gibbous"
        elif angle_deg < 292.5:
            phase_name = "Last Quarter"
        else:
            phase_name = "Waning Crescent"

        return {
            "phase_angle_deg": angle_deg,
            "illumination_percent": illumination,
            "phase_name": phase_name,
        }


# Global instance
tracker = CelestialTracker()


def calculate_celestial_body_position(
    body_name: str,
    observer_lat: float,
    observer_lon: float,
    observer_alt_m: float = 0.0,
) -> Tuple[float, float]:
    """
    Calculate celestial body azimuth and elevation (convenience function)

    Args:
        body_name: Name of celestial body (Moon, Sun, Mars, etc.)
        observer_lat: Observer latitude (degrees)
        observer_lon: Observer longitude (degrees)
        observer_alt_m: Observer altitude (meters)

    Returns:
        (azimuth_deg, elevation_deg) tuple
    """
    pos = tracker.get_body_position(
        body_name, observer_lat, observer_lon, observer_alt_m
    )
    return pos["azimuth_deg"], pos["elevation_deg"]


def get_moon_position(
    observer_lat: float,
    observer_lon: float,
    observer_alt_m: float = 0.0,
) -> Tuple[float, float]:
    """
    Calculate Moon azimuth and elevation (convenience function)

    Args:
        observer_lat: Observer latitude (degrees)
        observer_lon: Observer longitude (degrees)
        observer_alt_m: Observer altitude (meters)

    Returns:
        (azimuth_deg, elevation_deg) tuple
    """
    return calculate_celestial_body_position(
        "Moon", observer_lat, observer_lon, observer_alt_m
    )
