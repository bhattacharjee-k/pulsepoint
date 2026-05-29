import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { ingestPool } from '../../db/pools.js';
import { withIngestTenant } from '../../db/withTenant.js';
import { verifyCaptcha } from '../../lib/captcha.js';
import { sendError } from '../../lib/errors.js';
import { ingestPayloadSchema, parseOrReply } from '../../lib/validation.js';
import { checkTenantKeyLimit } from '../../plugins/rateLimit.js';

export async function publicFeedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post('/public/feedback', async (request, reply) => {
    const publicKey = request.headers['x-tenant-key'];
    if (typeof publicKey !== 'string' || publicKey.length === 0) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid tenant key');
    }
    if (!checkTenantKeyLimit(request, publicKey)) {
      return sendError(reply, 429, 'RATE_LIMITED', 'Too many submissions');
    }

    const payload = parseOrReply(ingestPayloadSchema, request.body, reply);
    if (!payload) return;
    if (!(await verifyCaptcha(payload.captchaToken))) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Captcha failed');
    }

    const tenant = await ingestPool.query<{ id: string }>('SELECT id FROM tenants WHERE public_key = $1', [
      publicKey
    ]);
    if (!tenant.rows[0]) return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid tenant key');

    const id = randomUUID();
    await withIngestTenant(tenant.rows[0].id, async (client) => {
      await client.query(
        `INSERT INTO feedback (
          id, tenant_id, type, message, rating, contact_email,
          submitter_external_id, submitter_email, submitter_display_name,
          context_page_url, context_user_agent, context_referrer
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          id,
          tenant.rows[0].id,
          payload.type,
          payload.message?.trim() || null,
          payload.rating ?? null,
          payload.contactEmail ?? null,
          payload.submitter?.externalId ?? null,
          payload.submitter?.email ?? null,
          payload.submitter?.displayName ?? null,
          payload.context?.pageUrl ?? null,
          payload.context?.userAgent ?? null,
          payload.context?.referrer ?? null
        ]
      );
    });

    return reply.status(201).send({ id });
  });
}
