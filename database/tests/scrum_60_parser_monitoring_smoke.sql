-- SCRUM-60 : smoke tests for additive monitoring schema, no data deletion.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='parser_batch_run')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='parser_run_event')
  THEN RAISE EXCEPTION 'Parser monitoring tables missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='feed_run' AND column_name='batch_run_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='feed_video_run' AND column_name='batch_run_id')
  THEN RAISE EXCEPTION 'Nullable parser batch FK columns missing'; END IF;
END $$;

INSERT INTO parser_batch_run(id, parser_type,trigger,filters,status)
VALUES('11111111-1111-4111-8111-111111111111','INFOS','MANUAL','{"languageIsoCode2":"fr"}'::jsonb,'RUNNING');
INSERT INTO parser_run_event(batch_run_id,level,event_type,message)
VALUES('11111111-1111-4111-8111-111111111111','INFO','run-started','Test start');
UPDATE parser_batch_run
SET status='SUCCESS',finished_at=now(),processed_feeds=0
WHERE id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF (SELECT count(*) FROM parser_run_event WHERE batch_run_id =
    '11111111-1111-4111-8111-111111111111') <> 1 THEN
    RAISE EXCEPTION 'Persistent parser events not stored';
  END IF;
END $$;
-- No monitoring test data should be committed to the CI DB.
ROLLBACK;
