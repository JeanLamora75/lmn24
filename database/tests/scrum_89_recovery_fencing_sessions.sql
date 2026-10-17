-- SCRUM-89: recovery fencing against an independent live PostgreSQL owner.
-- Two real PostgreSQL sessions via dblink. No real parser execution is simulated.
CREATE EXTENSION IF NOT EXISTS dblink;
INSERT INTO scheduler_job(id,parser_type,scheduled_for,status,attempt,
                          owner_token,heartbeat_at,started_at,not_before)
VALUES ('a8900000-0000-4000-8000-000000000089','INFOS',
        '2035-01-01T00:00:00Z','RUNNING',1,
        'a8910000-0000-4000-8000-000000000089',
        '2035-01-01T00:00:00Z','2035-01-01T00:00:00Z','2035-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
SELECT dblink_connect('recovery_owner',
  'dbname=' || current_database() || ' user=postgres password=postgres');
-- Independent process holds the actual global advisory lock.
SELECT acquired FROM dblink('recovery_owner',
  'SELECT pg_try_advisory_lock(241024,85) AS acquired') AS t(acquired boolean);
DO $recovery$
BEGIN
  IF pg_try_advisory_lock(241024,85) THEN
    PERFORM pg_advisory_unlock(241024,85);
    RAISE EXCEPTION 'Recovery acquired global lock while parser session owned it';
  END IF;
END $recovery$;
-- Simulate an owner refresh: a snapshot with a stale cutoff must not recover it.
SELECT dblink_exec('recovery_owner',
  'UPDATE scheduler_job SET heartbeat_at=''2035-01-01T00:10:00Z''
   WHERE id=''a8900000-0000-4000-8000-000000000089''');
DO $recovery$
DECLARE changed integer;
BEGIN
  UPDATE scheduler_job SET status='PENDING',owner_token=NULL,heartbeat_at=NULL
  WHERE id='a8900000-0000-4000-8000-000000000089'
    AND status='RUNNING'
    AND owner_token='a8910000-0000-4000-8000-000000000089'
    AND heartbeat_at<'2035-01-01T00:05:00Z';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN
    RAISE EXCEPTION 'Live owner incorrectly recovered: % row(s)',changed;
  END IF;
END $recovery$;
-- Releasing the independent session releases the lock; a stale job is now eligible.
SELECT dblink_disconnect('recovery_owner');
DO $recovery$
DECLARE changed integer;
BEGIN
  IF NOT pg_try_advisory_lock(241024,85) THEN
    RAISE EXCEPTION 'Recovery cannot acquire released global lock';
  END IF;
  UPDATE scheduler_job SET status='PENDING',owner_token=NULL,heartbeat_at=NULL,
                           started_at=NULL,not_before=NOW()+INTERVAL '1 minute'
  WHERE id='a8900000-0000-4000-8000-000000000089'
    AND status='RUNNING'
    AND owner_token='a8910000-0000-4000-8000-000000000089'
    AND heartbeat_at<'2035-01-01T00:15:00Z';
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM pg_advisory_unlock(241024,85);
  IF changed<>1 THEN
    RAISE EXCEPTION 'Released stale job was not recovered: % row(s)',changed;
  END IF;
END $recovery$;
DELETE FROM scheduler_job WHERE id='a8900000-0000-4000-8000-000000000089';
