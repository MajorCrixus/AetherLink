/**
 * Space-Track.org API Client
 *
 * Official API docs: https://www.space-track.org/documentation#/api
 *
 * Features:
 * - Cookie-based authentication
 * - Rate-limited requests (respects terms of use)
 * - Delta queries (fetch only new/changed data since last run)
 * - Support for SATCAT and TLE queries
 *
 * Usage:
 *   const client = new SpaceTrackClient();
 *   await client.login();
 *   const satellites = await client.querySatcat({ launched_since: '2024-01-01' });
 *   const tles = await client.queryLatestTle({ norad_ids: [25544, 27607] });
 */

import { spaceTrackClient } from '../utils/rateLimit.js';

const BASE_URL = 'https://www.space-track.org';

/**
 * SATCAT (Satellite Catalog) entry
 */
export interface SatcatEntry {
  NORAD_CAT_ID: string;
  OBJECT_NAME: string;
  INTLDES: string;          // International designator (e.g., '1998-067A')
  COUNTRY: string;           // Owner/operator country
  LAUNCH: string;            // Launch date (YYYY-MM-DD)
  SITE: string;              // Launch site
  DECAY: string | null;      // Decay/deorbit date (if applicable)
  PERIOD: string;            // Orbital period (minutes)
  INCLINATION: string;       // Orbital inclination (degrees)
  APOGEE: string;            // Apogee altitude (km)
  PERIGEE: string;           // Perigee altitude (km)
  OBJECT_TYPE: string;       // 'PAYLOAD', 'ROCKET BODY', 'DEBRIS', etc.
  RCS_SIZE: string;          // Radar cross-section size
  LAUNCH_YEAR: string;
  LAUNCH_NUM: string;
  LAUNCH_PIECE: string;
  CURRENT: string;           // 'Y' or 'N' - is this the current record?
  OBJECT_ID: string;
  COMMENT: string | null;
}

/**
 * TLE (Two-Line Element Set) entry
 */
export interface TleEntry {
  NORAD_CAT_ID: string;
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;             // TLE epoch (YYYY-MM-DD HH:MM:SS.ssssss)
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  FILE: string;
  TLE_LINE0: string;         // Line 0 (name)
  TLE_LINE1: string;         // Line 1 of TLE
  TLE_LINE2: string;         // Line 2 of TLE
  ORDINAL: string;
  CREATION_DATE: string;
}

/**
 * Query parameters for SATCAT
 */
export interface SatcatQueryParams {
  norad_ids?: number[];
  launched_since?: string;   // YYYY-MM-DD format
  launched_until?: string;   // YYYY-MM-DD format
  current_only?: boolean;    // Only return current catalog entries (default: true)
  object_types?: string[];   // ['PAYLOAD', 'ROCKET BODY', 'DEBRIS']
  countries?: string[];      // ['US', 'RUSSIA', 'CHINA', etc.]
  limit?: number;            // Max results (default: 1000)
}

/**
 * Query parameters for TLE
 */
export interface TleQueryParams {
  norad_ids?: number[];
  epoch_since?: string;      // YYYY-MM-DD format - get TLEs with epoch >= this date
  limit?: number;            // Max results (default: 1000)
}

/**
 * GP (General Perturbations) entry - RECOMMENDED by Space-Track
 * This is the modern replacement for tle_latest class
 */
export interface GPEntry {
  NORAD_CAT_ID: string;
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;             // Epoch timestamp
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  TLE_LINE1: string | null;  // Can be null for classified objects
  TLE_LINE2: string | null;  // Can be null for classified objects
  CREATION_DATE: string;
  ORIGINATOR: string;
  SEMIMAJOR_AXIS: string;
  PERIOD: string;
  APOGEE: string;
  PERIGEE: string;
  OBJECT_TYPE: string;
  RCS_SIZE: string;
  COUNTRY_CODE: string;
  LAUNCH_DATE: string;
  SITE: string;
  DECAY_DATE: string | null; // null = still on-orbit
}

/**
 * Query parameters for GP class
 */
export interface GPQueryParams {
  norad_ids?: number[];
  on_orbit_only?: boolean;   // Filter to on-orbit satellites only (decay_date is null)
  epoch_since?: string;      // e.g., '>now-3' for last 3 days
  limit?: number;            // Max results (default: 1000)
}

/**
 * Space-Track.org API Client
 */
export class SpaceTrackClient {
  private cookies: string | null = null;
  private loginTime: number = 0;
  private readonly SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Authenticate with Space-Track.org
   *
   * Credentials are read from environment variables:
   * - SPACETRACK_USERNAME
   * - SPACETRACK_PASSWORD
   */
  async login(): Promise<void> {
    const username = process.env.SPACETRACK_USERNAME;
    const password = process.env.SPACETRACK_PASSWORD;

    if (!username || !password) {
      throw new Error('SPACETRACK_USERNAME and SPACETRACK_PASSWORD must be set in environment');
    }

    console.log(`[SpaceTrack] Logging in as ${username}...`);

    // Space-Track uses form-encoded POST for login
    const formData = new URLSearchParams();
    formData.append('identity', username);
    formData.append('password', password);

    const response = await spaceTrackClient.fetch(`${BASE_URL}/ajaxauth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Space-Track login failed: ${response.status} ${response.statusText}`);
    }

    // Extract cookies from Set-Cookie headers
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Space-Track login did not return session cookies');
    }

    this.cookies = setCookie;
    this.loginTime = Date.now();

    console.log('[SpaceTrack] Login successful');
  }

  /**
   * Ensure we have a valid session (login if needed)
   */
  private async ensureLoggedIn(): Promise<void> {
    const now = Date.now();
    const sessionAge = now - this.loginTime;

    if (!this.cookies || sessionAge > this.SESSION_DURATION_MS) {
      console.log('[SpaceTrack] Session expired or not logged in. Logging in...');
      await this.login();
    }
  }

  /**
   * Query the SATCAT (Satellite Catalog)
   *
   * Docs: https://www.space-track.org/documentation#/api
   * Endpoint: /basicspacedata/query/class/satcat
   *
   * @param params - Query parameters
   * @returns Array of SATCAT entries
   */
  async querySatcat(params: SatcatQueryParams = {}): Promise<SatcatEntry[]> {
    await this.ensureLoggedIn();

    // Build query using Space-Track's predicate syntax
    // Proven query: DECAY_DATE/null-val/OBJECT_TYPE/PAYLOAD
    const predicates: string[] = [];

    // Filter to on-orbit satellites only (no decayed objects)
    predicates.push('DECAY_DATE/null-val');

    if (params.norad_ids && params.norad_ids.length > 0) {
      predicates.push(`NORAD_CAT_ID/${params.norad_ids.join(',')}`);
    }

    if (params.object_types && params.object_types.length > 0) {
      predicates.push(`OBJECT_TYPE/${params.object_types.join('|')}`);
    }

    if (params.countries && params.countries.length > 0) {
      predicates.push(`COUNTRY/${params.countries.join('|')}`);
    }

    // Build URL - only add limit if explicitly provided
    const predicateStr = predicates.length > 0 ? '/' + predicates.join('/') : '';
    const limitStr = params.limit ? `/limit/${params.limit}` : '';
    const url = `${BASE_URL}/basicspacedata/query/class/satcat${predicateStr}/orderby/NORAD_CAT_ID${limitStr}/format/json`;

    console.log(`[SpaceTrack] Querying SATCAT with ${predicates.length} predicates${params.limit ? ` (limit ${params.limit})` : ' (no limit)'}`);

    const response = await spaceTrackClient.fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.cookies || '',
      },
    });

    if (!response.ok) {
      throw new Error(`SATCAT query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as SatcatEntry[];
    console.log(`[SpaceTrack] SATCAT query returned ${data.length} entries`);

    return data;
  }

  /**
   * Query the latest TLEs (Two-Line Element Sets)
   *
   * Docs: https://www.space-track.org/documentation#/api
   * Endpoint: /basicspacedata/query/class/tle_latest
   *
   * @param params - Query parameters
   * @returns Array of TLE entries
   */
  async queryLatestTle(params: TleQueryParams = {}): Promise<TleEntry[]> {
    await this.ensureLoggedIn();

    // Build query string
    const predicates: string[] = [];

    if (params.norad_ids && params.norad_ids.length > 0) {
      predicates.push(`NORAD_CAT_ID/${params.norad_ids.join(',')}`);
    }

    if (params.epoch_since) {
      predicates.push(`EPOCH/>=${params.epoch_since}`);
    }

    // Always use tle_latest (most recent TLE per satellite)
    // Ordinal 1 = most recent
    predicates.push('ORDINAL/1');

    // Build URL - only add limit if explicitly provided
    const predicateStr = predicates.length > 0 ? '/' + predicates.join('/') : '';
    const limitStr = params.limit ? `/limit/${params.limit}` : '';
    const url = `${BASE_URL}/basicspacedata/query/class/tle_latest${predicateStr}/orderby/EPOCH desc${limitStr}/format/json`;

    console.log(`[SpaceTrack] Querying TLE_LATEST with ${predicates.length} predicates${params.limit ? ` (limit ${params.limit})` : ' (no limit)'}`);

    const response = await spaceTrackClient.fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.cookies || '',
      },
    });

    if (!response.ok) {
      throw new Error(`TLE query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as TleEntry[];
    console.log(`[SpaceTrack] TLE query returned ${data.length} entries`);

    return data;
  }

  /**
   * Query GP (General Perturbations) class - RECOMMENDED by Space-Track
   *
   * This is the modern, compliant way to get orbital elements.
   * Replaces the deprecated tle_latest class.
   *
   * Docs: https://www.space-track.org/documentation#api-basicSpaceDataGp
   * Endpoint: /basicspacedata/query/class/gp
   *
   * @param params - Query parameters
   * @returns Array of GP entries
   */
  async queryGP(params: GPQueryParams = {}): Promise<GPEntry[]> {
    await this.ensureLoggedIn();

    // Build query string
    const predicates: string[] = [];

    // Filter by NORAD IDs (comma-delimited for efficiency)
    if (params.norad_ids && params.norad_ids.length > 0) {
      predicates.push(`NORAD_CAT_ID/${params.norad_ids.join(',')}`);
    }

    // Filter to on-orbit objects only (decay_date is null)
    if (params.on_orbit_only !== false) { // Default to true
      predicates.push('DECAY_DATE/null-val');
    }

    // Filter by epoch (e.g., '>now-3' for last 3 days)
    if (params.epoch_since) {
      predicates.push(`EPOCH/${params.epoch_since}`);
    } else {
      // Default: recent data (last 30 days)
      predicates.push('EPOCH/>now-30');
    }

    // Build URL - only add limit if explicitly provided
    const predicateStr = predicates.length > 0 ? '/' + predicates.join('/') : '';
    const limitStr = params.limit ? `/limit/${params.limit}` : '';
    const url = `${BASE_URL}/basicspacedata/query/class/gp${predicateStr}/orderby/NORAD_CAT_ID,EPOCH desc${limitStr}/format/json`;

    console.log(`[SpaceTrack] Querying GP with ${predicates.length} predicates${params.limit ? ` (limit ${params.limit})` : ' (no limit)'}`);

    const response = await spaceTrackClient.fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.cookies || '',
      },
    });

    if (!response.ok) {
      throw new Error(`GP query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GPEntry[];
    console.log(`[SpaceTrack] GP query returned ${data.length} entries`);

    return data;
  }

  /**
   * Get TLEs for specific satellites (convenience method)
   *
   * @param noradIds - Array of NORAD catalog IDs
   * @returns Array of TLE entries
   */
  async getTlesForSatellites(noradIds: number[]): Promise<TleEntry[]> {
    if (noradIds.length === 0) {
      return [];
    }

    return this.queryLatestTle({ norad_ids: noradIds });
  }

  /**
   * Logout (clear session)
   */
  logout(): void {
    this.cookies = null;
    this.loginTime = 0;
    console.log('[SpaceTrack] Logged out');
  }
}

/**
 * Singleton instance
 */
export const spaceTrack = new SpaceTrackClient();
