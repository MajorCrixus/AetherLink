/**
 * Satellite Catalog API Client
 *
 * Connects to the satcat-backend service running on port 9001
 * to fetch satellite data from Space-Track.org and SatNOGS
 */

import type {
  SatelliteSummary,
  SatelliteDetail,
  SatelliteFilters,
  SatelliteStats,
} from '../types/satellite';

// Re-export types for convenience
export type { SatelliteSummary, SatelliteDetail, SatelliteFilters, SatelliteStats };

// API base URL - satcat-backend service
const SATCAT_API_BASE = 'http://192.168.68.135:9001/api';

/**
 * Fetch satellite catalog with optional filters
 */
export async function fetchSatellites(
  filters: SatelliteFilters = {}
): Promise<SatelliteSummary[]> {
  const params = new URLSearchParams();

  if (filters.orbit) params.append('orbit', filters.orbit);
  if (filters.band) params.append('band', filters.band);
  if (filters.purpose) params.append('purpose', filters.purpose);
  if (filters.owner) params.append('owner', filters.owner);
  if (filters.limit) params.append('limit', filters.limit.toString());

  const url = `${SATCAT_API_BASE}/satellites${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch satellites: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch detailed information for a specific satellite
 */
export async function fetchSatelliteDetail(
  noradId: number
): Promise<SatelliteDetail> {
  const url = `${SATCAT_API_BASE}/satellites/${noradId}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Satellite ${noradId} not found`);
    }
    throw new Error(`Failed to fetch satellite detail: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Request antenna acquisition for a satellite
 *
 * This calls the backend servo API to calculate azimuth/elevation
 * from the satellite's TLE and current GPS coordinates, then
 * commands the servos to point at the satellite.
 */
export async function acquireSatellite(
  noradId: number
): Promise<{ status: string; message: string }> {
  // Call the backend servo API (port 9000), not satcat-backend
  const url = `http://192.168.68.135:9000/api/servos/acquire-satellite`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ norad_id: noradId }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Satellite ${noradId} not found`);
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.detail || 'Bad request');
    }
    throw new Error(`Failed to acquire satellite: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch database statistics
 */
export async function fetchSatelliteStats(): Promise<SatelliteStats> {
  const url = `${SATCAT_API_BASE}/stats`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check for the satcat-backend service
 */
export async function checkSatcatHealth(): Promise<{
  status: string;
  service: string;
  timestamp: string;
  database: string;
}> {
  const url = `${SATCAT_API_BASE}/health`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
