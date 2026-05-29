import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendError } from '../lib/errors.js';

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.sessionUser?.role !== 'admin') {
    sendError(reply, 403, 'FORBIDDEN', 'Admin role required');
  }
}
