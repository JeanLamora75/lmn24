-- SCRUM-91 — Scheduler schema and ownership smoke test.
BEGIN;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM scheduler_config;
  IF n <> 4 THEN RAISE EXCEPTION 'Expected four scheduler configurations, got %',n; END IF;
  IF EXISTS (SELECT 1 FROM scheduler_config WHERE is_enabled) THEN
    RAISE EXCEPTION 'Scheduler must be disabled by default';
  END IF;
END $$;
INSERT INTO scheduler_job(parser_type,scheduled_for,status,owner_token,heartbeat_at)
VALUES('INFOS','2030-01-01T00:00:00Z','RUNNING',gen_random_uuid(),now());
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM scheduler_job WHERE parser_type='INFOS'
    AND scheduled_for='2030-01-01T00:00:00Z'
    AND owner_token IS NOT NULL AND heartbeat_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Scheduler owner data not persisted';
  END IF;
END $$;
-- Invalid RUNNING ownership must fail the NOT VALID check for new rows.
DO $$
BEGIN
  BEGIN
    INSERT INTO scheduler_job(parser_type,scheduled_for,status)
    VALUES('VIDEOS','2030-01-01T00:00:00Z','RUNNING');
    RAISE EXCEPTION 'RUNNING without owner wrongly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
