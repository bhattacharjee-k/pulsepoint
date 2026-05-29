import pg from 'pg';
import { beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/index.js';
import { hashPassword } from '../../src/lib/password.js';
import type { FastifyInstance } from 'fastify';

export const migrateUrl =
  process.env.DATABASE_MIGRATE_URL ??
  'postgres://pulsepoint_migrate:pulsepoint_migrate@localhost:5432/pulsepoint';
export const appUrl =
  process.env.DATABASE_APP_URL ?? 'postgres://pulsepoint_app:pulsepoint_app@localhost:5432/pulsepoint';
export const ingestUrl =
  process.env.DATABASE_INGEST_URL ??
  'postgres://pulsepoint_ingest:pulsepoint_ingest@localhost:5432/pulsepoint';

export type SeedState = {
  alphaId: string;
  deltaId: string;
  alphaFeedbackId: string;
  deltaFeedbackId: string;
  alphaAdminUserId: string;
  caseyUserId: string;
  deltaAdminUserId: string;
};

export async function resetDb(): Promise<SeedState> {
  const client = new pg.Client({ connectionString: migrateUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE feedback_notes, feedback, memberships, users, tenants RESTART IDENTITY CASCADE');
    const alpha = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug, public_key, widget_config)
       VALUES ('Alpha Corp','alpha','pk_alpha_demo',$1) RETURNING id`,
      [{ accentColor: '#2563eb', promptText: 'Alpha prompt', enabledTypes: ['bug', 'feature', 'rating', 'other'] }]
    );
    const delta = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug, public_key, widget_config)
       VALUES ('Delta Inc','delta','pk_delta_demo',$1) RETURNING id`,
      [{ accentColor: '#d97706', promptText: 'Delta prompt', enabledTypes: ['bug', 'feature', 'rating'] }]
    );
    const hash = await hashPassword('password123');
    const users = await client.query<{ id: string; email: string }>(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES
       ('admin@alpha.com','Alpha Admin',$1),
       ('member@alpha.com','Casey',$1),
       ('admin@delta.com','Delta Admin',$1)
       RETURNING id, email`,
      [hash]
    );
    const user = (email: string) => users.rows.find((row) => row.email === email)!.id;
    await client.query(
      `INSERT INTO memberships (user_id, tenant_id, role)
       VALUES ($1,$2,'admin'),($3,$2,'member'),($4,$5,'admin')`,
      [user('admin@alpha.com'), alpha.rows[0].id, user('member@alpha.com'), user('admin@delta.com'), delta.rows[0].id]
    );
    const alphaFeedback = await client.query<{ id: string }>(
      `INSERT INTO feedback (tenant_id, type, message, status, submitter_email)
       VALUES
       ($1,'bug','Alpha bug','open','alice@example.com'),
       ($1,'feature','Alpha feature','in_progress','pm@example.com'),
       ($1,'rating',NULL,'resolved',NULL)
       RETURNING id`,
      [alpha.rows[0].id]
    );
    const deltaFeedback = await client.query<{ id: string }>(
      `INSERT INTO feedback (tenant_id, type, message, status)
       VALUES ($1,'bug','Delta bug','open'), ($1,'feature','Delta feature','closed')
       RETURNING id`,
      [delta.rows[0].id]
    );
    await client.query('COMMIT');
    return {
      alphaId: alpha.rows[0].id,
      deltaId: delta.rows[0].id,
      alphaFeedbackId: alphaFeedback.rows[0].id,
      deltaFeedbackId: deltaFeedback.rows[0].id,
      alphaAdminUserId: user('admin@alpha.com'),
      caseyUserId: user('member@alpha.com'),
      deltaAdminUserId: user('admin@delta.com')
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export function useApi() {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });
  return () => app;
}

export async function login(app: FastifyInstance, email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' }
  });
  const cookie = response.headers['set-cookie'];
  const raw = Array.isArray(cookie) ? cookie[0] : (cookie ?? '');
  return raw.split(';')[0];
}
