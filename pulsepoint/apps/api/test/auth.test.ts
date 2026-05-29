import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrateUrl, resetDb, useApi } from './helpers/db.js';

describe('auth and sessions', () => {
  const getApp = useApi();

  beforeEach(async () => {
    await resetDb();
  });

  it('sets a session cookie for correct credentials and rejects wrong password', async () => {
    const ok = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@alpha.com', password: 'password123' }
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['set-cookie']).toContain('pulsepoint.sid');

    const bad = await getApp().inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@alpha.com', password: 'wrong' }
    });
    expect(bad.statusCode).toBe(401);
  });

  it('stores bcrypt hashes, not plaintext', async () => {
    const client = new pg.Client({ connectionString: migrateUrl });
    await client.connect();
    const result = await client.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE email = $1', [
      'admin@alpha.com'
    ]);
    await client.end();
    expect(result.rows[0].password_hash).not.toBe('password123');
    expect(result.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('requires a session for admin routes', async () => {
    const response = await getApp().inject({ method: 'GET', url: '/api/v1/feedback' });
    expect(response.statusCode).toBe(401);
  });
});
