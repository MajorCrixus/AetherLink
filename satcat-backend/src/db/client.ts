/**
 * Database Client
 *
 * Uses native pg library (lightweight, ARM64-friendly alternative to Prisma)
 */

// Re-export from pg-client
export {
  pool,
  initDatabase,
  closeDatabase,
  checkDatabaseHealth,
  query,
} from './pg-client.js';

// Placeholder prisma export for backwards compatibility
// TODO: Update ingest services and API routes to use raw SQL with pool/query
export const prisma = {
  $queryRaw: async (sql: any, ...values: any[]) => {
    const { pool } = await import('./pg-client.js');
    return pool.query(sql, values);
  },
  $connect: async () => {},
  $disconnect: async () => {
    const { closeDatabase } = await import('./pg-client.js');
    return closeDatabase();
  },
};
