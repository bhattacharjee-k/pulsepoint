import type { FastifyInstance } from 'fastify';
import { ingestPool } from '../../db/pools.js';
import { sendError } from '../../lib/errors.js';

export async function widgetConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get('/public/widget-config', async (request, reply) => {
    const key = typeof request.query === 'object' && request.query ? (request.query as { key?: string }).key : undefined;
    if (!key) return sendError(reply, 404, 'NOT_FOUND', 'Unknown widget key');

    const { rows } = await ingestPool.query<{ widget_config: Record<string, unknown> }>(
      'SELECT widget_config FROM tenants WHERE public_key = $1',
      [key]
    );
    if (!rows[0]) return sendError(reply, 404, 'NOT_FOUND', 'Unknown widget key');
    return reply.send(rows[0].widget_config);
  });
}
