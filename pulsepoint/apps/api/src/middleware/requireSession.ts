import type { FastifyReply, FastifyRequest } from 'fastify';
import { withAuthUser } from '../db/authLookup.js';
import { sendError } from '../lib/errors.js';

export type SessionUser = {
  userId: string;
  tenantId: string;
  membershipId: string;
  role: 'admin' | 'member';
  email: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.session.userId;
  if (!userId) {
    sendError(reply, 401, 'UNAUTHORIZED', 'Login required');
    return;
  }
  const rows = await withAuthUser(userId, async (client) => {
    const result = await client.query<SessionUser>(
    `SELECT u.id AS "userId",
            u.email,
            m.id AS "membershipId",
            m.tenant_id AS "tenantId",
            m.role
       FROM users u
       JOIN memberships m ON m.user_id = u.id
      WHERE u.id = $1
      ORDER BY m.created_at
      LIMIT 1`,
    [userId]
    );
    return result.rows;
  });
  if (!rows[0]) {
    sendError(reply, 401, 'UNAUTHORIZED', 'Login required');
    return;
  }
  request.sessionUser = rows[0];
}
