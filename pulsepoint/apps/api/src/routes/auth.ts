import type { FastifyInstance } from 'fastify';
import { withAuthUser } from '../db/authLookup.js';
import { appPool } from '../db/pools.js';
import { sendError } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import { loginSchema, parseOrReply } from '../lib/validation.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (request, reply) => {
    const body = parseOrReply(loginSchema, request.body, reply);
    if (!body) return;
    const userResult = await appPool.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [body.email.toLowerCase()]
    );
    const user = userResult.rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid email or password');
    }
    const memberships = await withAuthUser(user.id, async (client) => {
      const result = await client.query<{ tenantId: string; membershipId: string; role: string }>(
        `SELECT tenant_id AS "tenantId", id AS "membershipId", role
           FROM memberships
          WHERE user_id = $1
          ORDER BY created_at
          LIMIT 1`,
        [user.id]
      );
      return result.rows;
    });
    if (!memberships[0]) return sendError(reply, 401, 'UNAUTHORIZED', 'No tenant membership');
    request.session.userId = user.id;
    return reply.send({
      user: { id: user.id, email: user.email, tenantId: memberships[0].tenantId, role: memberships[0].role }
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });
}
