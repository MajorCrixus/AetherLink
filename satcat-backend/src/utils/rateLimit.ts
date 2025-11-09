/**
 * Rate-limited HTTP client for Space-Track.org API
 *
 * Enforces:
 * - Configurable minimum delay between requests
 * - HTTP 429 (Too Many Requests) handling with Retry-After
 * - Exponential backoff on 5xx errors
 * - Secure logging (never prints credentials)
 */

import { setTimeout as sleep } from 'timers/promises';

interface RateLimitConfig {
  minIntervalMs: number;  // Minimum time between requests (default 1200ms)
  maxRetries: number;     // Maximum retry attempts (default 5)
  initialBackoffMs: number; // Initial backoff delay (default 1000ms)
  maxBackoffMs: number;   // Maximum backoff delay (default 30000ms)
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | FormData;
  timeout?: number; // Request timeout in ms (default 30000)
}

interface RateLimitState {
  lastRequestTime: number;
  pendingRequests: number;
}

/**
 * Rate-limited HTTP client with retry logic
 */
export class RateLimitedClient {
  private config: RateLimitConfig;
  private state: RateLimitState;
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      minIntervalMs: config?.minIntervalMs ?? parseInt(process.env.SPACETRACK_MIN_INTERVAL_MS || '0'),
      maxRetries: config?.maxRetries ?? 5,
      initialBackoffMs: config?.initialBackoffMs ?? 1000,
      maxBackoffMs: config?.maxBackoffMs ?? 30000,
    };

    this.state = {
      lastRequestTime: 0,
      pendingRequests: 0,
    };

    if (this.config.minIntervalMs > 0) {
      console.log(`[RateLimitedClient] Initialized with ${this.config.minIntervalMs}ms minimum interval`);
    } else {
      console.log(`[RateLimitedClient] Initialized with NO artificial rate limiting (Space-Track enforces 30/min, 300/hour)`);
    }
  }

  /**
   * Make a rate-limited HTTP request
   *
   * @param url - Target URL (credentials will be redacted in logs)
   * @param options - Request options
   * @returns Response object
   */
  async fetch(url: string, options?: RequestOptions): Promise<Response> {
    // Queue this request to ensure serial execution
    const request = this.requestQueue.then(() => this._fetchWithRetry(url, options));
    this.requestQueue = request.then(() => {}).catch(() => {}); // Don't let failures block the queue
    return request;
  }

  /**
   * Internal fetch with retry logic
   */
  private async _fetchWithRetry(url: string, options?: RequestOptions): Promise<Response> {
    const redactedUrl = this._redactUrl(url);
    let attempt = 0;
    let backoffMs = this.config.initialBackoffMs;

    while (attempt <= this.config.maxRetries) {
      try {
        // Enforce rate limit delay
        await this._enforceRateLimit();

        // Log request (with redacted credentials)
        const method = options?.method || 'GET';
        console.log(`[RateLimitedClient] ${method} ${redactedUrl} (attempt ${attempt + 1}/${this.config.maxRetries + 1})`);

        // Make request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 30000);

        const response = await fetch(url, {
          method: options?.method || 'GET',
          headers: options?.headers || {},
          body: options?.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        this.state.lastRequestTime = Date.now();

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = this._parseRetryAfter(response.headers.get('Retry-After'));
          console.warn(`[RateLimitedClient] Rate limited (429). Waiting ${retryAfter}ms before retry.`);
          await sleep(retryAfter);
          attempt++;
          continue;
        }

        // Handle server errors (5xx) with exponential backoff
        if (response.status >= 500) {
          console.warn(`[RateLimitedClient] Server error ${response.status}. Backing off ${backoffMs}ms.`);
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, this.config.maxBackoffMs);
          attempt++;
          continue;
        }

        // Success or client error (4xx) - don't retry client errors
        if (!response.ok) {
          console.error(`[RateLimitedClient] Request failed with status ${response.status}`);
        } else {
          console.log(`[RateLimitedClient] Request succeeded (${response.status})`);
        }

        return response;

      } catch (error) {
        console.error(`[RateLimitedClient] Request error on attempt ${attempt + 1}:`, error instanceof Error ? error.message : error);

        if (attempt >= this.config.maxRetries) {
          throw new Error(`Request failed after ${this.config.maxRetries + 1} attempts: ${error instanceof Error ? error.message : error}`);
        }

        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, this.config.maxBackoffMs);
        attempt++;
      }
    }

    throw new Error(`Request failed after ${this.config.maxRetries + 1} attempts`);
  }

  /**
   * Enforce minimum interval between requests
   */
  private async _enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.state.lastRequestTime;
    const waitTime = this.config.minIntervalMs - timeSinceLastRequest;

    if (waitTime > 0) {
      console.log(`[RateLimitedClient] Waiting ${waitTime}ms to respect rate limit`);
      await sleep(waitTime);
    }
  }

  /**
   * Parse Retry-After header (supports seconds or HTTP date)
   */
  private _parseRetryAfter(header: string | null): number {
    if (!header) {
      return this.config.initialBackoffMs;
    }

    // Try parsing as seconds
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(header);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return this.config.initialBackoffMs;
  }

  /**
   * Redact sensitive information from URLs for logging
   */
  private _redactUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Redact username/password in URL
      if (urlObj.username || urlObj.password) {
        urlObj.username = '[REDACTED]';
        urlObj.password = '[REDACTED]';
      }

      // Redact common credential parameters
      const credentialParams = ['password', 'pass', 'token', 'secret', 'key', 'auth'];
      credentialParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });

      return urlObj.toString();
    } catch {
      // If URL parsing fails, just return a safe message
      return '[INVALID URL]';
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): { lastRequestTime: number; pendingRequests: number } {
    return { ...this.state };
  }
}

/**
 * Singleton instance for Space-Track API
 */
export const spaceTrackClient = new RateLimitedClient();
