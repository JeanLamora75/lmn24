-- SCRUM-83 / SCRUM-84: non-destructive scheduler foundations
-- Apply with the deployment's existing SQL migration procedure.
BEGIN;
CREATE TABLE IF NOT EXISTS scheduler_config (
  parser_type VARCHAR(24) PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  interval_minutes INTEGER,
  local_time VARCHAR(5),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris',
  next_due_at TIMESTAMPTZ,
  last_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduler_config_type_chk CHECK (parser_type IN ('INFOS','VIDEOS','WEATHER','HOROSCOPE_IMPORT')),
  CONSTRAINT scheduler_config_schedule_chk CHECK (
    (parser_type = 'HOROSCOPE_IMPORT' AND interval_minutes IS NULL AND local_time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' AND local_time >= '06:00')
    OR (parser_type <> 'HOROSCOPE_IMPORT' AND interval_minutes BETWEEN 15 AND 1440 AND local_time IS NULL)
  )
);
CREATE TABLE IF NOT EXISTS scheduler_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parser_type VARCHAR(24) NOT NULL REFERENCES scheduler_config(parser_type),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt INTEGER NOT NULL DEFAULT 0,
  not_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduler_job_status_chk CHECK (status IN ('PENDING','RUNNING','SUCCESS','ERROR','INTERRUPTED','CANCELLED')),
  CONSTRAINT scheduler_job_attempt_chk CHECK (attempt BETWEEN 0 AND 100),
  CONSTRAINT scheduler_job_unique_due UNIQUE (parser_type, scheduled_for)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_dispatch ON scheduler_job(status, not_before, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_parser_date ON scheduler_job(parser_type, scheduled_for DESC);
-- Keep disabled until administrator intentionally enables scheduling.
INSERT INTO scheduler_config(parser_type,is_enabled,interval_minutes,local_time)
VALUES ('INFOS',FALSE,60,NULL),('VIDEOS',FALSE,120,NULL),('WEATHER',FALSE,240,NULL),('HOROSCOPE_IMPORT',FALSE,NULL,'06:15')
ON CONFLICT (parser_type) DO NOTHING;
COMMIT;
