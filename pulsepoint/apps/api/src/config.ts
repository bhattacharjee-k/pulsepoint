import { z } from 'zod';

const envSchema = z.object({
  DATABASE_APP_URL: z
    .string()
    .default('postgres://pulsepoint_app:pulsepoint_app@localhost:5432/pulsepoint'),
  DATABASE_INGEST_URL: z
    .string()
    .default('postgres://pulsepoint_ingest:pulsepoint_ingest@localhost:5432/pulsepoint'),
  DATABASE_MIGRATE_URL: z
    .string()
    .default('postgres://pulsepoint_migrate:pulsepoint_migrate@localhost:5432/pulsepoint'),
  DATABASE_SUPER_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).default('local-test-session-secret-at-least-32'),
  ADMIN_CORS_ORIGIN: z.string().default('http://localhost:5173'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default('development')
});

export const config = envSchema.parse(process.env);
