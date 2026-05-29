import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimitForTests } from '../src/plugins/rateLimit.js';
import { migrateUrl, resetDb, type SeedState, useApi } from './helpers/db.js';

describe('public ingest API', () => {
  const getApp = useApi();
  let seed: SeedState;

  beforeEach(async () => {
    resetRateLimitForTests();
    seed = await resetDb();
  });

  it('stores valid submission under the key tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/public/feedback',
      headers: { 'x-tenant-key': 'pk_alpha_demo' },
      payload: { type: 'bug', message: 'New Alpha bug', captchaToken: 'stub' }
    });
    expect(response.statusCode).toBe(201);
    const id = response.json<{ id: string }>().id;
    const client = new pg.Client({ connectionString: migrateUrl });
    await client.connect();
    const row = await client.query<{ tenant_id: string }>('SELECT tenant_id FROM feedback WHERE id = $1', [id]);
    await client.end();
    expect(row.rows[0].tenant_id).toBe(seed.alphaId);
  });

  it('ignores tenant_id in the body', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/api/v1/public/feedback',
      headers: { 'x-tenant-key': 'pk_alpha_demo' },
      payload: { type: 'feature', message: 'Pretend Delta', tenant_id: seed.deltaId }
    });
    expect(response.statusCode).toBe(201);
    const id = response.json<{ id: string }>().id;
    const client = new pg.Client({ connectionString: migrateUrl });
    await client.connect();
    const row = await client.query<{ tenant_id: string }>('SELECT tenant_id FROM feedback WHERE id = $1', [id]);
    await client.end();
    expect(row.rows[0].tenant_id).toBe(seed.alphaId);
  });

  it('rejects bad keys and invalid payloads', async () => {
    const badKey = await getApp().inject({
      method: 'POST',
      url: '/api/v1/public/feedback',
      headers: { 'x-tenant-key': 'garbage' },
      payload: { type: 'bug', message: 'x' }
    });
    expect(badKey.statusCode).toBe(401);

    const noRating = await getApp().inject({
      method: 'POST',
      url: '/api/v1/public/feedback',
      headers: { 'x-tenant-key': 'pk_alpha_demo' },
      payload: { type: 'rating' }
    });
    expect(noRating.statusCode).toBe(400);

    const longMessage = await getApp().inject({
      method: 'POST',
      url: '/api/v1/public/feedback',
      headers: { 'x-tenant-key': 'pk_alpha_demo' },
      payload: { type: 'bug', message: 'x'.repeat(5001) }
    });
    expect(longMessage.statusCode).toBe(400);

    const unknownType = await getApp().inject({
      method: 'POST',
      url: '/api/v1/public/feedback',
      headers: { 'x-tenant-key': 'pk_alpha_demo' },
      payload: { type: 'question', message: 'x' }
    });
    expect(unknownType.statusCode).toBe(400);
  });

  it('rate limits by tenant key and IP', async () => {
    let response;
    for (let i = 0; i < 21; i += 1) {
      response = await getApp().inject({
        method: 'POST',
        url: '/api/v1/public/feedback',
        headers: { 'x-tenant-key': 'pk_alpha_demo' },
        payload: { type: 'bug', message: `Bug ${i}` }
      });
    }
    expect(response?.statusCode).toBe(429);
  });
});
