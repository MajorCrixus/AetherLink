"""
Satellite Tracking Service

Calculates azimuth and elevation for satellites using TLE data and observer location.
Uses Skyfield library for accurate orbital calculations.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from skyfield.api import load, EarthSatellite, wgs84
from skyfield.timelib import Time

logger = logging.getLogger(__name__)


class SatelliteTracker:
    """
    Satellite position calculator using TLE orbital elements
    """

    def __init__(self):
        self.ts = load.timescale()
        self._satellite_cache: Dict[int, EarthSatellite] = {}

    def load_satellite(
        self, norad_id: int, line1: str, line2: str, name: str = ""
    ) -> EarthSatellite:
        """
        Load a satellite from TLE lines

        Args:
            norad_id: NORAD catalog ID
            line1: TLE line 1
            line2: TLE line 2
            name: Satellite name (optional)

        Returns:
            EarthSatellite object
        """
        satellite = EarthSatellite(line1, line2, name or f"SAT-{norad_id}", self.ts)
        self._satellite_cache[norad_id] = satellite
        return satellite

    def get_satellite(self, norad_id: int) -> Optional[EarthSatellite]:
        """Get cached satellite by NORAD ID"""
        return self._satellite_cache.get(norad_id)

    def calculate_position(
        self,
        satellite: EarthSatellite,
        observer_lat: float,
        observer_lon: float,
        observer_alt_m: float = 0.0,
        time: Optional[datetime] = None,
    ) -> Dict[str, float]:
        """
        Calculate satellite azimuth and elevation from observer location

        Args:
            satellite: EarthSatellite object
            observer_lat: Observer latitude (degrees, -90 to 90)
            observer_lon: Observer longitude (degrees, -180 to 180)
            observer_alt_m: Observer altitude (meters above sea level)
            time: Observation time (UTC), defaults to now

        Returns:
            Dictionary with:
                - azimuth_deg: Azimuth angle in degrees (0-360, N=0, E=90)
                - elevation_deg: Elevation angle in degrees (-90 to 90)
                - distance_km: Distance to satellite in kilometers
                - altitude_km: Satellite altitude above Earth in kilometers
                - velocity_km_s: Satellite velocity in km/s
                - latitude_deg: Satellite sub-point latitude
                - longitude_deg: Satellite sub-point longitude
        """
        if time is None:
            time = datetime.now(timezone.utc)

        # Create observer location
        observer = wgs84.latlon(observer_lat, observer_lon, observer_alt_m)

        # Convert time to Skyfield Time object
        t = self.ts.from_datetime(time)

        # Calculate satellite position relative to observer
        difference = satellite - observer
        topocentric = difference.at(t)

        # Get azimuth, elevation, distance
        alt, az, distance = topocentric.altaz()

        # Get satellite geocentric position
        geocentric = satellite.at(t)
        subpoint = wgs84.subpoint(geocentric)

        # Get satellite velocity
        velocity = geocentric.velocity.km_per_s
        velocity_magnitude = (velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2) ** 0.5

        return {
            "azimuth_deg": az.degrees,
            "elevation_deg": alt.degrees,
            "distance_km": distance.km,
            "altitude_km": subpoint.elevation.km,
            "velocity_km_s": velocity_magnitude,
            "latitude_deg": subpoint.latitude.degrees,
            "longitude_deg": subpoint.longitude.degrees,
        }

    def calculate_position_from_tle(
        self,
        norad_id: int,
        line1: str,
        line2: str,
        observer_lat: float,
        observer_lon: float,
        observer_alt_m: float = 0.0,
        time: Optional[datetime] = None,
        name: str = "",
    ) -> Dict[str, float]:
        """
        Calculate satellite position from TLE lines (convenience method)

        Args:
            norad_id: NORAD catalog ID
            line1: TLE line 1
            line2: TLE line 2
            observer_lat: Observer latitude (degrees)
            observer_lon: Observer longitude (degrees)
            observer_alt_m: Observer altitude (meters)
            time: Observation time (UTC), defaults to now
            name: Satellite name (optional)

        Returns:
            Position dictionary (see calculate_position)
        """
        satellite = self.load_satellite(norad_id, line1, line2, name)
        return self.calculate_position(
            satellite, observer_lat, observer_lon, observer_alt_m, time
        )

    def is_visible(
        self,
        satellite: EarthSatellite,
        observer_lat: float,
        observer_lon: float,
        observer_alt_m: float = 0.0,
        min_elevation_deg: float = 0.0,
        time: Optional[datetime] = None,
    ) -> bool:
        """
        Check if satellite is visible (above horizon) from observer location

        Args:
            satellite: EarthSatellite object
            observer_lat: Observer latitude (degrees)
            observer_lon: Observer longitude (degrees)
            observer_alt_m: Observer altitude (meters)
            min_elevation_deg: Minimum elevation for visibility (default 0.0)
            time: Observation time (UTC), defaults to now

        Returns:
            True if satellite is visible, False otherwise
        """
        pos = self.calculate_position(
            satellite, observer_lat, observer_lon, observer_alt_m, time
        )
        return pos["elevation_deg"] >= min_elevation_deg

    def get_next_pass_time(
        self,
        satellite: EarthSatellite,
        observer_lat: float,
        observer_lon: float,
        observer_alt_m: float = 0.0,
        start_time: Optional[datetime] = None,
        days_ahead: int = 7,
    ) -> Optional[Dict[str, datetime]]:
        """
        Find next satellite pass over observer location

        Args:
            satellite: EarthSatellite object
            observer_lat: Observer latitude (degrees)
            observer_lon: Observer longitude (degrees)
            observer_alt_m: Observer altitude (meters)
            start_time: Start search time (UTC), defaults to now
            days_ahead: Number of days to search ahead

        Returns:
            Dictionary with:
                - rise_time: Pass rise time (UTC)
                - culminate_time: Pass culmination time (UTC)
                - set_time: Pass set time (UTC)
                - max_elevation_deg: Maximum elevation during pass
            Or None if no pass found
        """
        if start_time is None:
            start_time = datetime.now(timezone.utc)

        observer = wgs84.latlon(observer_lat, observer_lon, observer_alt_m)
        t0 = self.ts.from_datetime(start_time)
        t1 = self.ts.from_datetime(
            datetime.fromtimestamp(
                start_time.timestamp() + days_ahead * 86400, tz=timezone.utc
            )
        )

        # Find events: 0 = rise, 1 = culminate, 2 = set
        t, events = satellite.find_events(observer, t0, t1, altitude_degrees=0.0)

        if len(events) < 3:
            return None

        # Find first complete pass (rise -> culminate -> set)
        for i in range(len(events) - 2):
            if events[i] == 0 and events[i + 1] == 1 and events[i + 2] == 2:
                rise_time = t[i].utc_datetime()
                culminate_time = t[i + 1].utc_datetime()
                set_time = t[i + 2].utc_datetime()

                # Calculate max elevation at culmination
                difference = satellite - observer
                topocentric = difference.at(t[i + 1])
                alt, _, _ = topocentric.altaz()

                return {
                    "rise_time": rise_time,
                    "culminate_time": culminate_time,
                    "set_time": set_time,
                    "max_elevation_deg": alt.degrees,
                }

        return None


# Global instance
tracker = SatelliteTracker()


def calculate_azimuth_elevation(
    norad_id: int,
    tle_line1: str,
    tle_line2: str,
    observer_lat: float,
    observer_lon: float,
    observer_alt_m: float = 0.0,
    satellite_name: str = "",
) -> Tuple[float, float]:
    """
    Calculate satellite azimuth and elevation (convenience function)

    Args:
        norad_id: NORAD catalog ID
        tle_line1: TLE line 1
        tle_line2: TLE line 2
        observer_lat: Observer latitude (degrees)
        observer_lon: Observer longitude (degrees)
        observer_alt_m: Observer altitude (meters)
        satellite_name: Satellite name (optional)

    Returns:
        (azimuth_deg, elevation_deg) tuple
    """
    pos = tracker.calculate_position_from_tle(
        norad_id,
        tle_line1,
        tle_line2,
        observer_lat,
        observer_lon,
        observer_alt_m,
        name=satellite_name,
    )
    return pos["azimuth_deg"], pos["elevation_deg"]
