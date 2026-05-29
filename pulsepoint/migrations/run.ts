import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureRoles(): Promise<void> {
  const superUrl = process.env.DATABASE_SUPER_URL;
  if (!superUrl) return;
  const client = new Client({ connectionString: superUrl });
  await client.connect();
  try {
    await client.query(await fs.readFile(path.join(dirname, '..', 'db', '000_roles.sql'), 'utf8'));
  } finally {
    await client.end();
  }
}

async function run(): Promise<void> {
  await ensureRoles();
  const connectionString =
    process.env.DATABASE_MIGRATE_URL ??
    'postgres://pulsepoint_migrate:pulsepoint_migrate@localhost:5432/pulsepoint';
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const files = (await fs.readdir(dirname))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const sql = await fs.readFile(path.join(dirname, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.info(`applied ${file}`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
