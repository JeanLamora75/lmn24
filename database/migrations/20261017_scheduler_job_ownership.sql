-- SCRUM-89: idempotent extension of the scheduler job ownership protocol.
-- Requires 20261017_scheduler_foundations.sql to have been applied.
BEGIN;
ALTER TABLE scheduler_job ADD COLUMN IF NOT EXISTS owner_token UUID;
ALTER TABLE scheduler_job ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_scheduler_job_heartbeat
  ON scheduler_job(status, heartbeat_at)
  WHERE status = 'RUNNING';
-- Invariant: a RUNNING job must have an owner and a heartbeat. Existing legacy
-- RUNNING rows must be reconciled before validating this CHECK in deployment.
ALTER TABLE scheduler_job
  ADD CONSTRAINT scheduler_job_running_owner_chk
  CHECK (status <> 'RUNNING' OR (owner_token IS NOT NULL AND heartbeat_at IS NOT NULL))
  NOT VALID;
COMMIT;
