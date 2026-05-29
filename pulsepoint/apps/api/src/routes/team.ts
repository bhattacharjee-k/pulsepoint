import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireSession } from '../middleware/requireSession.js';

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireSession);
  app.addHook('preHandler', requireAdmin);

  app.get('/team', async (request, reply) => {
    if (!request.sessionUser) return;
    const rows = await withTenant(request.sessionUser.tenantId, async (client) => {
      const result = await client.query(
        `SELECT m.id, m.role, m.created_at AS "createdAt", u.email, u.display_name AS "displayName"
           FROM memberships m
           JOIN users u ON u.id = m.user_id
          ORDER BY u.email`
      );
      return result.rows;
    });
    return reply.send({ items: rows });
  });
}
