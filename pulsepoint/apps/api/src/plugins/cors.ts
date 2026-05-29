import cors, { type FastifyCorsOptions } from '@fastify/cors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';

// CORS is split by surface, because the two APIs have different threat models:
// - Public ingest (/api/v1/public/*): the widget runs on arbitrary tenant sites, so any
//   origin may call it — but WITHOUT credentials, since it never uses cookies.
// - Admin API (everything else): locked to the dashboard origin and credentialed, so no
//   other website can make an authenticated cross-origin request to it.
export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(
    cors,
    () => (req: FastifyRequest, callback: (err: Error | null, options: FastifyCorsOptions) => void) => {
      if (req.url.startsWith('/api/v1/public/')) {
        callback(null, { origin: true, credentials: false });
        return;
      }
      callback(null, { origin: config.ADMIN_CORS_ORIGIN, credentials: true });
    }
  );
}
