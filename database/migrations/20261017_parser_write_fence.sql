-- SCRUM-89 — Transactional fencing epoch for content writers.
-- Separate epoch lock (241024,86) ensures a successor cannot begin before
-- all previously authorized business-write transactions have committed.
BEGIN;
CREATE TABLE IF NOT EXISTS parser_write_epoch (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  owner_token UUID NOT NULL,
  lock_backend_pid INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE parser_write_epoch ADD COLUMN IF NOT EXISTS lock_backend_pid INTEGER;
CREATE OR REPLACE FUNCTION assert_parser_write_epoch(expected_owner UUID)
RETURNS VOID LANGUAGE plpgsql AS $parser_fence$
DECLARE active_owner UUID;
DECLARE lock_pid INTEGER;
BEGIN
  -- This lock survives until the caller's transaction commits.
  PERFORM pg_advisory_xact_lock_shared(241024, 86);
  SELECT owner_token, lock_backend_pid INTO active_owner, lock_pid FROM parser_write_epoch WHERE singleton_id = 1;
  IF active_owner IS DISTINCT FROM expected_owner OR lock_pid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_locks WHERE locktype='advisory' AND granted=TRUE
      AND pid=lock_pid AND classid=241024 AND objid=85
  ) THEN
    RAISE EXCEPTION 'Parser write denied: superseded owner token'
      USING ERRCODE = 'P0001';
  END IF;
END $parser_fence$;
COMMIT;
