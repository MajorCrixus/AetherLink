/**
 * SatNOGS DB API Client
 *
 * Official API docs: https://docs.satnogs.org/projects/satnogs-db/en/latest/api.html
 * Live DB: https://db.satnogs.org/
 *
 * Features:
 * - Fetch transmitter data (frequencies, modes, bands)
 * - No authentication required (public API)
 * - Maps transmitters to NORAD IDs
 *
 * Usage:
 *   const client = new SatnogsClient();
 *   const transmitters = await client.fetchTransmitters();
 *   const updated = await client.fetchTransmitters({ updatedSince: '2024-01-01' });
 */

const BASE_URL = 'https://db.satnogs.org/api';

/**
 * SatNOGS transmitter entry
 */
export interface SatnogsTransmitter {
  uuid: string;
  description: string;
  alive: boolean;
  type: string;              // 'Transmitter' or 'Transceiver'
  uplink_low: number | null; // Hz
  uplink_high: number | null; // Hz
  uplink_drift: number | null;
  downlink_low: number | null; // Hz
  downlink_high: number | null; // Hz
  downlink_drift: number | null;
  mode: string | null;       // e.g., 'FM', 'CW', 'LORA', 'AFSK'
  mode_id: number | null;
  uplink_mode: string | null;
  invert: boolean;
  baud: number | null;
  norad_cat_id: number;      // NORAD catalog ID
  status: string;            // 'active', 'inactive', 'invalid'
  updated: string;           // ISO date string
  citation: string;
  service: string;           // 'Amateur', 'Commercial', 'Military', etc.
  coordination: string;
  coordination_url: string;
  // Raw fields for debugging
  [key: string]: any;
}

/**
 * Query parameters for transmitters
 */
export interface TransmitterQueryParams {
  updatedSince?: string;     // ISO date string (e.g., '2024-01-01T00:00:00Z')
  status?: 'active' | 'inactive' | 'invalid';
  norad_ids?: number[];
  limit?: number;
}

/**
 * Frequency band classifications (common ranges)
 */
export const FREQUENCY_BANDS = {
  VHF: { min: 30e6, max: 300e6, name: 'VHF' },
  UHF: { min: 300e6, max: 1e9, name: 'UHF' },
  L: { min: 1e9, max: 2e9, name: 'L' },
  S: { min: 2e9, max: 4e9, name: 'S' },
  C: { min: 4e9, max: 8e9, name: 'C' },
  X: { min: 8e9, max: 12e9, name: 'X' },
  Ku: { min: 12e9, max: 18e9, name: 'Ku' },
  K: { min: 18e9, max: 27e9, name: 'K' },
  Ka: { min: 27e9, max: 40e9, name: 'Ka' },
  V: { min: 40e9, max: 75e9, name: 'V' },
  W: { min: 75e9, max: 110e9, name: 'W' },
} as const;

/**
 * Classify frequency into band
 */
export function classifyFrequencyBand(freqHz: number): string {
  for (const [bandName, range] of Object.entries(FREQUENCY_BANDS)) {
    if (freqHz >= range.min && freqHz < range.max) {
      return range.name;
    }
  }
  return 'UNKNOWN';
}

/**
 * SatNOGS DB API Client
 */
export class SatnogsClient {
  /**
   * Fetch transmitters from SatNOGS DB
   *
   * API endpoint: /api/transmitters/
   *
   * @param params - Query parameters
   * @returns Array of transmitter entries
   */
  async fetchTransmitters(params: TransmitterQueryParams = {}): Promise<SatnogsTransmitter[]> {
    const url = new URL(`${BASE_URL}/transmitters/`);

    // Add query parameters
    if (params.status) {
      url.searchParams.append('status', params.status);
    }

    if (params.updatedSince) {
      // SatNOGS API uses 'updated__gte' for "updated greater than or equal"
      url.searchParams.append('updated__gte', params.updatedSince);
    }

    if (params.norad_ids && params.norad_ids.length > 0) {
      // SatNOGS accepts comma-separated NORAD IDs
      url.searchParams.append('satellite__norad_cat_id', params.norad_ids.join(','));
    }

    console.log(`[SatNOGS] Fetching transmitters from ${url.pathname}${url.search}`);

    const allTransmitters: SatnogsTransmitter[] = [];
    let page = 1;
    const limit = params.limit || Infinity;

    // SatNOGS API is paginated
    while (allTransmitters.length < limit) {
      url.searchParams.set('page', page.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AetherLink-SATCOM-Backend',
        },
      });

      if (!response.ok) {
        throw new Error(`SatNOGS API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle paginated response
      if (Array.isArray(data)) {
        // Simple array response (older API format)
        allTransmitters.push(...data);
        break;
      } else if (data.results && Array.isArray(data.results)) {
        // Paginated response (newer API format)
        allTransmitters.push(...data.results);

        if (!data.next || allTransmitters.length >= limit) {
          break;
        }

        page++;
      } else {
        throw new Error('Unexpected SatNOGS API response format');
      }

      // Be nice to SatNOGS API - add small delay between pages
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[SatNOGS] Fetched ${allTransmitters.length} transmitters`);

    return allTransmitters.slice(0, limit);
  }

  /**
   * Fetch transmitters for specific satellites
   *
   * @param noradIds - Array of NORAD catalog IDs
   * @returns Array of transmitter entries
   */
  async fetchTransmittersForSatellites(noradIds: number[]): Promise<SatnogsTransmitter[]> {
    if (noradIds.length === 0) {
      return [];
    }

    return this.fetchTransmitters({ norad_ids: noradIds });
  }

  /**
   * Get band information for a transmitter
   *
   * @param transmitter - SatNOGS transmitter entry
   * @returns Object with uplink/downlink bands and frequencies
   */
  getTransmitterBands(transmitter: SatnogsTransmitter): {
    downlink_freq_hz: number | null;
    downlink_band: string | null;
    uplink_freq_hz: number | null;
    uplink_band: string | null;
  } {
    const downlink_freq_hz = transmitter.downlink_low;
    const uplink_freq_hz = transmitter.uplink_low;

    return {
      downlink_freq_hz,
      downlink_band: downlink_freq_hz ? classifyFrequencyBand(downlink_freq_hz) : null,
      uplink_freq_hz,
      uplink_band: uplink_freq_hz ? classifyFrequencyBand(uplink_freq_hz) : null,
    };
  }
}

/**
 * Singleton instance
 */
export const satnogs = new SatnogsClient();
