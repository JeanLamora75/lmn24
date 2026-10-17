-- Concurrent reservation smoke test using two independent PostgreSQL sessions.
-- session A holds a row lock; session B must SKIP LOCKED and select another row.
CREATE EXTENSION IF NOT EXISTS dblink;
BEGIN;
INSERT INTO scheduler_job(parser_type,scheduled_for,status,not_before)
VALUES ('INFOS','2031-01-01T00:00:00Z','PENDING','2020-01-01T00:00:00Z'),
       ('VIDEOS','2031-01-01T00:00:00Z','PENDING','2020-01-01T00:00:00Z')
ON CONFLICT (parser_type,scheduled_for) DO NOTHING;
-- Separate session B owns the INFOS row lock and stays in its transaction.
SELECT dblink_connect('claim_peer',
  'dbname=' || current_database() || ' user=postgres password=postgres');
SELECT dblink_exec('claim_peer','BEGIN');
SELECT dblink_exec('claim_peer',
  'UPDATE scheduler_job SET updated_at=NOW() WHERE parser_type=''INFOS'' AND scheduled_for=''2031-01-01T00:00:00Z''');
DO $$
DECLARE winner TEXT;
BEGIN
 SELECT parser_type INTO winner
 FROM scheduler_job
 WHERE status='PENDING'
 AND scheduled_for='2031-01-01T00:00:00Z'
 ORDER BY CASE parser_type WHEN 'INFOS' THEN 1 WHEN 'VIDEOS' THEN 2 ELSE 3 END
 LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF winner <> 'VIDEOS' THEN
  RAISE EXCEPTION 'SKIP LOCKED failed: expected VIDEOS, got %',winner;
 END IF;
END $$;
SELECT dblink_exec('claim_peer','ROLLBACK');
SELECT dblink_disconnect('claim_peer');
ROLLBACK;
