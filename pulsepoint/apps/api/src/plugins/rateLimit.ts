import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const keyHits = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxPerKey = 20;

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute'
  });
}

export function checkTenantKeyLimit(request: FastifyRequest, key: string): boolean {
  const now = Date.now();
  const id = `${request.ip}:${key}`;
  const current = keyHits.get(id);
  if (!current || current.resetAt < now) {
    keyHits.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= maxPerKey;
}

export function resetRateLimitForTests(): void {
  keyHits.clear();
}
