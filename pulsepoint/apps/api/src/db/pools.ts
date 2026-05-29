import pg from 'pg';
import { config } from '../config.js';

export const appPool = new pg.Pool({ connectionString: config.DATABASE_APP_URL });
export const ingestPool = new pg.Pool({ connectionString: config.DATABASE_INGEST_URL });

export async function closePools(): Promise<void> {
  await Promise.all([appPool.end(), ingestPool.end()]);
}
