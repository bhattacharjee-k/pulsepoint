import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { withTenant } from '../src/db/withTenant.js';
import { appPool } from '../src/db/pools.js';
import { ingestUrl, login, resetDb, type SeedState, useApi } from './helpers/db.js';

describe('RLS tenant isolation', () => {
  const getApp = useApi();
  let seed: SeedState;

  beforeEach(async () => {
    seed = await resetDb();
  });

  it('returns only Alpha rows under Alpha context', async () => {
    const rows = await withTenant(seed.alphaId, async (client) => {
      const result = await client.query<{ tenant_id: string }>('SELECT tenant_id FROM feedback ORDER BY created_at');
      return result.rows;
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.tenant_id === seed.alphaId)).toBe(true);
  });

  it('rejects writes to another tenant under Alpha context', async () => {
    await expect(
      withTenant(seed.alphaId, async (client) => {
        await client.query(
          "INSERT INTO feedback (tenant_id, type, message) VALUES ($1, 'bug', 'cross tenant')",
          [seed.deltaId]
        );
      })
    ).rejects.toThrow();
  });

  it('fails closed with no tenant context', async () => {
    const result = await appPool.query('SELECT * FROM feedback');
    expect(result.rows).toHaveLength(0);
  });

  it('denies feedback SELECT to ingest role', async () => {
    const client = new pg.Client({ connectionString: ingestUrl });
    await client.connect();
    try {
      await expect(client.query('SELECT * FROM feedback')).rejects.toThrow(/permission denied|denied/i);
    } finally {
      await client.end();
    }
  });

  it('does not fetch a Delta id inside Alpha context and route returns 404', async () => {
    const rows = await withTenant(seed.alphaId, async (client) => {
      const result = await client.query('SELECT id FROM feedback WHERE id = $1', [seed.deltaFeedbackId]);
      return result.rows;
    });
    expect(rows).toHaveLength(0);

    const cookie = await login(getApp(), 'admin@alpha.com');
    const response = await getApp().inject({
      method: 'GET',
      url: `/api/v1/feedback/${seed.deltaFeedbackId}`,
      headers: { cookie }
    });
    expect(response.statusCode).toBe(404);
  });

});
