import type { FastifyReply } from 'fastify';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export function sendError(reply: FastifyReply, statusCode: number, code: ErrorCode, message: string) {
  return reply.status(statusCode).send({ error: { code, message } });
}
