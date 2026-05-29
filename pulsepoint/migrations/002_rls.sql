ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE feedback_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_app_rw ON tenants;
DROP POLICY IF EXISTS tenant_migrate_all ON tenants;
CREATE POLICY tenant_migrate_all ON tenants FOR ALL TO pulsepoint_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tenant_app_rw ON tenants;
CREATE POLICY tenant_app_rw ON tenants
  FOR ALL TO pulsepoint_app
  USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_ingest_lookup ON tenants;
CREATE POLICY tenant_ingest_lookup ON tenants
  FOR SELECT TO pulsepoint_ingest
  USING (true);

DROP POLICY IF EXISTS memberships_app_rw ON memberships;
DROP POLICY IF EXISTS memberships_migrate_all ON memberships;
CREATE POLICY memberships_migrate_all ON memberships FOR ALL TO pulsepoint_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS memberships_app_rw ON memberships;
CREATE POLICY memberships_app_rw ON memberships
  FOR ALL TO pulsepoint_app
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR user_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid
  )
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS feedback_app_rw ON feedback;
DROP POLICY IF EXISTS feedback_migrate_all ON feedback;
CREATE POLICY feedback_migrate_all ON feedback FOR ALL TO pulsepoint_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS feedback_app_rw ON feedback;
CREATE POLICY feedback_app_rw ON feedback
  FOR ALL TO pulsepoint_app
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS feedback_ingest_insert ON feedback;
CREATE POLICY feedback_ingest_insert ON feedback
  FOR INSERT TO pulsepoint_ingest
  WITH CHECK (tenant_id = NULLIF(current_setting('app.ingest_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS feedback_notes_app_rw ON feedback_notes;
DROP POLICY IF EXISTS feedback_notes_migrate_all ON feedback_notes;
CREATE POLICY feedback_notes_migrate_all ON feedback_notes FOR ALL TO pulsepoint_migrate USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS feedback_notes_app_rw ON feedback_notes;
CREATE POLICY feedback_notes_app_rw ON feedback_notes
  FOR ALL TO pulsepoint_app
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

GRANT USAGE ON SCHEMA public TO pulsepoint_app, pulsepoint_ingest;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, memberships, feedback, feedback_notes, users TO pulsepoint_migrate;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, memberships, feedback, feedback_notes TO pulsepoint_app;
GRANT SELECT ON users TO pulsepoint_app;
GRANT SELECT ON tenants TO pulsepoint_ingest;
GRANT INSERT ON feedback TO pulsepoint_ingest;
REVOKE ALL ON feedback FROM pulsepoint_ingest;
GRANT INSERT ON feedback TO pulsepoint_ingest;
REVOKE ALL ON feedback_notes, users, memberships FROM pulsepoint_ingest;
GRANT REFERENCES ON tenants, memberships TO pulsepoint_ingest;
