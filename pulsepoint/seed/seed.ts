import pg from 'pg';
import { hashPassword } from '../apps/api/src/lib/password.js';

const connectionString =
  process.env.DATABASE_MIGRATE_URL ??
  'postgres://pulsepoint_migrate:pulsepoint_migrate@localhost:5432/pulsepoint';

const widgetConfig = {
  alpha: {
    accentColor: '#2563eb',
    promptText: 'How can Alpha improve this experience?',
    enabledTypes: ['bug', 'feature', 'rating', 'other']
  },
  delta: {
    accentColor: '#d97706',
    promptText: 'Send Delta product feedback',
    enabledTypes: ['bug', 'feature', 'rating']
  }
};

async function upsertUser(client: pg.Client, email: string, displayName: string, password: string): Promise<string> {
  const passwordHash = await hashPassword(password);
  const result = await client.query<{ id: string }>(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [email, displayName, passwordHash]
  );
  return result.rows[0].id;
}

async function run(): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    const alpha = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug, public_key, widget_config)
       VALUES ('Alpha Corp', 'alpha', 'pk_alpha_demo', $1)
       ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name, public_key = EXCLUDED.public_key, widget_config = EXCLUDED.widget_config
       RETURNING id`,
      [widgetConfig.alpha]
    );
    const delta = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug, public_key, widget_config)
       VALUES ('Delta Inc', 'delta', 'pk_delta_demo', $1)
       ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name, public_key = EXCLUDED.public_key, widget_config = EXCLUDED.widget_config
       RETURNING id`,
      [widgetConfig.delta]
    );

    const alphaAdmin = await upsertUser(client, 'admin@alpha.com', 'Alpha Admin', 'password123');
    const casey = await upsertUser(client, 'member@alpha.com', 'Casey', 'password123');
    const deltaAdmin = await upsertUser(client, 'admin@delta.com', 'Delta Admin', 'password123');

    await client.query(
      `INSERT INTO memberships (user_id, tenant_id, role)
       VALUES ($1,$2,'admin'), ($3,$2,'member'), ($4,$5,'admin')
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role`,
      [alphaAdmin, alpha.rows[0].id, casey, deltaAdmin, delta.rows[0].id]
    );

    const alphaCount = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM feedback WHERE tenant_id = $1',
      [alpha.rows[0].id]
    );
    const deltaCount = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM feedback WHERE tenant_id = $1',
      [delta.rows[0].id]
    );

    if (alphaCount.rows[0].count === 0) {
      await client.query(
        `INSERT INTO feedback (tenant_id, type, message, rating, contact_email, submitter_external_id, submitter_email, submitter_display_name, context_page_url, status)
         VALUES
         ($1,'bug','Checkout button is hidden on mobile',NULL,'alice@example.com','alpha-1','alice@example.com','Alice','https://alpha.example/pricing','open'),
         ($1,'feature','Please add export to CSV',NULL,NULL,'alpha-2',NULL,'Jordan','https://alpha.example/reports','in_progress'),
         ($1,'rating',NULL,5,NULL,'alpha-3',NULL,'Morgan','https://alpha.example/dashboard','resolved'),
         ($1,'other','The dashboard feels fast today',NULL,NULL,'alpha-4',NULL,'Riley','https://alpha.example/dashboard','closed'),
         ($1,'bug','Search clears when I change status',NULL,'casey@example.com','alpha-5','casey@example.com','Casey','https://alpha.example/search','open')`,
        [alpha.rows[0].id]
      );
    }
    if (deltaCount.rows[0].count === 0) {
      await client.query(
        `INSERT INTO feedback (tenant_id, type, message, rating, contact_email, submitter_external_id, submitter_email, submitter_display_name, context_page_url, status)
         VALUES
         ($1,'feature','Add dark mode to the portal',NULL,'bob@example.com','delta-1','bob@example.com','Bob','https://delta.example/app','open'),
         ($1,'rating',NULL,3,NULL,'delta-2',NULL,'Sam','https://delta.example/app','open'),
         ($1,'bug','Invoice PDF link returns 404',NULL,NULL,'delta-3',NULL,'Taylor','https://delta.example/billing','in_progress'),
         ($1,'other','Can support hours be displayed in-product?',NULL,NULL,'delta-4',NULL,'Drew','https://delta.example/help','resolved')`,
        [delta.rows[0].id]
      );
    }

    await client.query('COMMIT');
    console.info('seed complete: admin@alpha.com, member@alpha.com, admin@delta.com password=password123');
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
