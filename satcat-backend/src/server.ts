/**
 * Satellite Catalog Backend Server
 *
 * TypeScript/Node.js service for satellite tracking data.
 * Pulls data from Space-Track.org and SatNOGS DB, stores in PostgreSQL.
 * Exposes REST API for Cesium-based frontend.
 *
 * Usage:
 *   npm run dev      - Run in development mode
 *   npm start        - Run in production mode
 *   npm run ingest   - Run data ingest manually
 */

import express from 'express';
import cors from 'cors';
import { initDatabase, checkDatabaseHealth } from './db/client.js';
import { router as apiRouter } from './api/routes.js';

const PORT = parseInt(process.env.SATCAT_PORT || '9001', 10);
const HOST = process.env.SATCAT_HOST || '0.0.0.0';

/**
 * Initialize Express app
 */
async function createApp(): Promise<express.Application> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // API routes
  app.use('/api', apiRouter);

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      service: 'AetherLink Satellite Catalog Backend',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        stats: '/api/stats',
        satellites: '/api/satellites',
        satellite_detail: '/api/satellites/:noradId',
        acquire: '/api/acquire/:noradId (POST)',
      },
      docs: 'https://github.com/yourusername/aetherlink',
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

/**
 * Start server
 */
async function start(): Promise<void> {
  try {
    console.log('='.repeat(60));
    console.log('AetherLink Satellite Catalog Backend');
    console.log('='.repeat(60));

    // Initialize database
    console.log('[Server] Connecting to database...');
    await initDatabase();

    // Health check
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    console.log('[Server] Database health check: OK');

    // Create app
    const app = await createApp();

    // Start listening
    app.listen(PORT, HOST, () => {
      console.log('='.repeat(60));
      console.log(`[Server] Listening on http://${HOST}:${PORT}`);
      console.log('[Server] API endpoints:');
      console.log(`  - Health:     http://${HOST}:${PORT}/api/health`);
      console.log(`  - Stats:      http://${HOST}:${PORT}/api/stats`);
      console.log(`  - Satellites: http://${HOST}:${PORT}/api/satellites`);
      console.log('='.repeat(60));
    });

  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { createApp, start };
