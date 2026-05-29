DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulsepoint_migrate') THEN
    CREATE ROLE pulsepoint_migrate LOGIN PASSWORD 'pulsepoint_migrate';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulsepoint_app') THEN
    CREATE ROLE pulsepoint_app LOGIN PASSWORD 'pulsepoint_app';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulsepoint_ingest') THEN
    CREATE ROLE pulsepoint_ingest LOGIN PASSWORD 'pulsepoint_ingest';
  END IF;
END
$$;

GRANT CREATE ON DATABASE pulsepoint TO pulsepoint_migrate;
GRANT USAGE, CREATE ON SCHEMA public TO pulsepoint_migrate;
