import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { requireSession } from '../middleware/requireSession.js';
import { sendError } from '../lib/errors.js';
import { feedbackStatusSchema, feedbackTypeSchema, parseOrReply } from '../lib/validation.js';

const listQuerySchema = z.object({
  status: feedbackStatusSchema.optional(),
  type: feedbackTypeSchema.optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0)
});

const patchSchema = z.object({
  status: feedbackStatusSchema.optional(),
  assigneeMembershipId: z.string().uuid().nullable().optional()
});

const noteSchema = z.object({ body: z.string().min(1).max(5000) });

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireSession);

  app.get('/feedback', async (request, reply) => {
    const query = parseOrReply(listQuerySchema, request.query, reply);
    if (!query || !request.sessionUser) return;
    const result = await withTenant(request.sessionUser.tenantId, async (client) => {
      const where = ['tenant_id = $1'];
      const values: unknown[] = [request.sessionUser!.tenantId];
      if (query.status) {
        values.push(query.status);
        where.push(`status = $${values.length}`);
      }
      if (query.type) {
        values.push(query.type);
        where.push(`type = $${values.length}`);
      }
      if (query.q) {
        values.push(`%${query.q}%`);
        where.push(`(message ILIKE $${values.length} OR submitter_email ILIKE $${values.length})`);
      }
      values.push(query.limit, query.offset);
      const itemSql = `SELECT id, type, message, rating, contact_email AS "contactEmail",
          submitter_external_id AS "submitterExternalId", submitter_email AS "submitterEmail",
          submitter_display_name AS "submitterDisplayName", context_page_url AS "contextPageUrl",
          context_user_agent AS "contextUserAgent", context_referrer AS "contextReferrer",
          status, assignee_membership_id AS "assigneeMembershipId", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM feedback WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;
      const countSql = `SELECT count(*)::int AS total FROM feedback WHERE ${where.join(' AND ')}`;
      const items = await client.query(itemSql, values);
      const count = await client.query<{ total: number }>(countSql, values.slice(0, values.length - 2));
      return { items: items.rows, total: count.rows[0].total };
    });
    return reply.send(result);
  });

  app.get('/feedback/:id', async (request, reply) => {
    if (!request.sessionUser) return;
    const id = (request.params as { id: string }).id;
    const result = await withTenant(request.sessionUser.tenantId, async (client) => {
      const item = await client.query('SELECT * FROM feedback WHERE id = $1', [id]);
      if (!item.rows[0]) return undefined;
      const notes = await client.query(
        `SELECT n.id, n.body, n.created_at AS "createdAt", u.email AS "authorEmail"
           FROM feedback_notes n
           JOIN memberships m ON m.id = n.author_membership_id
           JOIN users u ON u.id = m.user_id
          WHERE n.feedback_id = $1
          ORDER BY n.created_at ASC`,
        [id]
      );
      return { ...item.rows[0], notes: notes.rows };
    });
    if (!result) return sendError(reply, 404, 'NOT_FOUND', 'Feedback not found');
    return reply.send(result);
  });

  app.patch('/feedback/:id', async (request, reply) => {
    const body = parseOrReply(patchSchema, request.body, reply);
    if (!body || !request.sessionUser) return;
    const id = (request.params as { id: string }).id;
    const updated = await withTenant(request.sessionUser.tenantId, async (client) => {
      const result = await client.query(
        `UPDATE feedback
            SET status = COALESCE($2, status),
                assignee_membership_id = CASE WHEN $3::boolean THEN $4::uuid ELSE assignee_membership_id END,
                updated_at = now()
          WHERE id = $1
          RETURNING id, status, assignee_membership_id AS "assigneeMembershipId"`,
        [id, body.status ?? null, Object.hasOwn(body, 'assigneeMembershipId'), body.assigneeMembershipId ?? null]
      );
      return result.rows[0];
    });
    if (!updated) return sendError(reply, 404, 'NOT_FOUND', 'Feedback not found');
    return reply.send(updated);
  });

  app.post('/feedback/:id/notes', async (request, reply) => {
    const body = parseOrReply(noteSchema, request.body, reply);
    if (!body || !request.sessionUser) return;
    const id = (request.params as { id: string }).id;
    const note = await withTenant(request.sessionUser.tenantId, async (client) => {
      const exists = await client.query('SELECT id FROM feedback WHERE id = $1', [id]);
      if (!exists.rows[0]) return undefined;
      const result = await client.query(
        `INSERT INTO feedback_notes (tenant_id, feedback_id, author_membership_id, body)
         VALUES ($1, $2, $3, $4)
         RETURNING id, body, created_at AS "createdAt"`,
        [request.sessionUser!.tenantId, id, request.sessionUser!.membershipId, body.body]
      );
      return result.rows[0];
    });
    if (!note) return sendError(reply, 404, 'NOT_FOUND', 'Feedback not found');
    return reply.status(201).send(note);
  });
}
