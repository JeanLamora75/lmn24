-- SCRUM-89 — Transactional fencing epoch for content writers.
-- Separate epoch lock (241024,86) ensures a successor cannot begin before
-- all previously authorized business-write transactions have committed.
BEGIN;
CREATE TABLE IF NOT EXISTS parser_write_epoch (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  owner_token UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION assert_parser_write_epoch(expected_owner UUID)
RETURNS VOID LANGUAGE plpgsql AS $parser_fence$
DECLARE active_owner UUID;
BEGIN
  -- This lock survives until the caller's transaction commits.
  PERFORM pg_advisory_xact_lock_shared(241024, 86);
  SELECT owner_token INTO active_owner FROM parser_write_epoch WHERE singleton_id = 1;
  IF active_owner IS DISTINCT FROM expected_owner THEN
    RAISE EXCEPTION 'Parser write denied: superseded owner token'
      USING ERRCODE = 'P0001';
  END IF;
END $parser_fence$;
COMMIT;
