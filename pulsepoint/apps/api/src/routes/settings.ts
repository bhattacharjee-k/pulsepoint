import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireSession } from '../middleware/requireSession.js';
import { parseOrReply } from '../lib/validation.js';

const settingsSchema = z.object({
  accentColor: z.string().min(1).optional(),
  promptText: z.string().min(1).max(200).optional(),
  enabledTypes: z.array(z.enum(['bug', 'feature', 'rating', 'other'])).min(1).optional()
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireSession);
  app.addHook('preHandler', requireAdmin);

  app.get('/settings', async (request, reply) => {
    if (!request.sessionUser) return;
    const settings = await withTenant(request.sessionUser.tenantId, async (client) => {
      const result = await client.query('SELECT widget_config FROM tenants WHERE id = $1', [
        request.sessionUser!.tenantId
      ]);
      return result.rows[0]?.widget_config;
    });
    return reply.send(settings);
  });

  app.patch('/settings', async (request, reply) => {
    const body = parseOrReply(settingsSchema, request.body, reply);
    if (!body || !request.sessionUser) return;
    const settings = await withTenant(request.sessionUser.tenantId, async (client) => {
      const current = await client.query<{ widget_config: Record<string, unknown> }>(
        'SELECT widget_config FROM tenants WHERE id = $1',
        [request.sessionUser!.tenantId]
      );
      const merged = { ...current.rows[0].widget_config, ...body };
      const updated = await client.query('UPDATE tenants SET widget_config = $2, updated_at = now() WHERE id = $1 RETURNING widget_config', [
        request.sessionUser!.tenantId,
        merged
      ]);
      return updated.rows[0].widget_config;
    });
    return reply.send(settings);
  });
}
