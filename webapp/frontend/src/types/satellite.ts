/**
 * Satellite catalog type definitions
 * Matches the satcat-backend API contracts
 */

export interface TLE {
  line1: string;
  line2: string;
  epoch: string; // ISO-8601 UTC
  element_set_no?: number;
}

export interface SatelliteOrbit {
  class: 'LEO' | 'MEO' | 'GEO' | 'HEO' | 'UNKNOWN';
  period_minutes?: number;
  inclination_deg?: number;
  apogee_km?: number;
  perigee_km?: number;
}

export interface Transmitter {
  uuid: string;
  downlink_freq_mhz: number | null;
  downlink_band: string | null;
  uplink_freq_mhz: number | null;
  uplink_band: string | null;
  mode: string | null;
  direction: 'downlink' | 'uplink' | 'transceiver' | 'unknown';
  status: string;
  service: string | null;
}

export interface SatelliteSummary {
  id: string; // Format: sat-{norad_id}
  norad_id: number;
  name: string;
  owner: string | null;
  orbit_class: 'LEO' | 'MEO' | 'GEO' | 'HEO' | 'UNKNOWN' | null;
  launch_date: string | null; // ISO-8601
  object_type: string | null;
  bands: string[];
  purpose: string[];
  tle: TLE | null;
}

export interface SatelliteDetail {
  norad_id: number;
  name: string;
  intl_desig: string | null;
  owner: string | null;
  launch_date: string | null; // ISO-8601
  orbit: SatelliteOrbit;
  object_type: string | null;
  rcs_size: string | null;
  tle: TLE | null;
  transmitters: Transmitter[];
  tags: Record<string, string[]>;
  actions: Array<{
    label: string;
    type: 'ui' | 'task';
    endpoint?: string;
    description: string;
  }>;
}

export interface SatelliteFilters {
  orbit?: 'LEO' | 'MEO' | 'GEO' | 'HEO';
  band?: string;
  purpose?: string;
  owner?: string;
  limit?: number;
}

export interface SatelliteStats {
  satellites: number;
  tles: number;
  transmitters: number;
  tags: number;
}
