import cookie from '@fastify/cookie';
import session from '@fastify/session';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

declare module '@fastify/session' {
  interface FastifySessionObject {
    userId?: string;
  }
}

export async function registerSession(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  await app.register(session, {
    secret: config.SESSION_SECRET,
    cookieName: 'pulsepoint.sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/'
    }
  });
}
