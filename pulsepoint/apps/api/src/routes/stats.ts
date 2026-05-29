import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { requireSession } from '../middleware/requireSession.js';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireSession);

  app.get('/stats', async (request, reply) => {
    if (!request.sessionUser) return;
    const stats = await withTenant(request.sessionUser.tenantId, async (client) => {
      const byStatus = await client.query('SELECT status, count(*)::int AS count FROM feedback GROUP BY status ORDER BY status');
      const byType = await client.query('SELECT type, count(*)::int AS count FROM feedback GROUP BY type ORDER BY type');
      const avgRating = await client.query<{ avgRating: number | null }>(
        'SELECT avg(rating)::float AS "avgRating" FROM feedback WHERE rating IS NOT NULL'
      );
      return { byStatus: byStatus.rows, byType: byType.rows, avgRating: avgRating.rows[0].avgRating };
    });
    return reply.send(stats);
  });
}
