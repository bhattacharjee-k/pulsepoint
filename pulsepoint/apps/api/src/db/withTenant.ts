import type { Pool, PoolClient } from 'pg';
import { appPool, ingestPool } from './pools.js';

async function withLocalSetting<T>(
  pool: Pool,
  settingName: 'app.current_tenant_id' | 'app.ingest_tenant_id',
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL scopes tenant identity to this transaction so reused pool clients fail closed later.
    await client.query('SELECT set_config($1, $2, true)', [settingName, tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withLocalSetting(appPool, 'app.current_tenant_id', tenantId, fn);
}

export async function withIngestTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withLocalSetting(ingestPool, 'app.ingest_tenant_id', tenantId, fn);
}
