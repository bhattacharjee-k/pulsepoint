import type { PoolClient } from 'pg';
import { appPool } from './pools.js';

export async function withAuthUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // This scoped setting lets RLS reveal only memberships belonging to the authenticated user.
    await client.query("SELECT set_config('app.auth_user_id', $1, true)", [userId]);
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
