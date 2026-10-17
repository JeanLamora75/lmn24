-- SCRUM-89: real PostgreSQL transaction-level parser epoch fencing.
CREATE EXTENSION IF NOT EXISTS dblink;
INSERT INTO parser_write_epoch(singleton_id,owner_token)
VALUES (1,'11111111-1111-4111-8111-111111111111')
ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token;

BEGIN;
SELECT assert_parser_write_epoch('11111111-1111-4111-8111-111111111111'::uuid);
DO $fence_test$
DECLARE acquired BOOLEAN;
BEGIN
  PERFORM dblink_connect('fence_peer', 'dbname='||current_database()||' user=postgres password=postgres');
  PERFORM dblink_exec('fence_peer','BEGIN');
  SELECT locked INTO acquired FROM dblink('fence_peer',
    'SELECT pg_try_advisory_xact_lock(241024,86) AS locked') AS t(locked BOOLEAN);
  PERFORM dblink_exec('fence_peer','ROLLBACK');
  PERFORM dblink_disconnect('fence_peer');
  IF acquired THEN
    RAISE EXCEPTION 'Successor acquired exclusive fence while old writer active';
  END IF;
END $fence_test$;
COMMIT;

-- A later exclusive epoch rotation invalidates all old writer tokens.
BEGIN;
SELECT pg_advisory_xact_lock(241024,86);
UPDATE parser_write_epoch SET owner_token='22222222-2222-4222-8222-222222222222'
WHERE singleton_id=1;
COMMIT;

DO $fence_test$
DECLARE rejected BOOLEAN:=FALSE;
BEGIN
  BEGIN
    PERFORM assert_parser_write_epoch('11111111-1111-4111-8111-111111111111'::uuid);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    rejected:=TRUE;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'Stale owner was accepted after successor rotation';
  END IF;
END $fence_test$;
SELECT assert_parser_write_epoch('22222222-2222-4222-8222-222222222222'::uuid);
DELETE FROM parser_write_epoch WHERE singleton_id=1;
