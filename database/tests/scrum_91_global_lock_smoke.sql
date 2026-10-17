-- SCRUM-91: PostgreSQL-level concurrency smoke test.
-- This script runs inside a single psql session and cannot establish
-- multi-process guarantees. It verifies a held global parser lock is visible
-- to an independent PostgreSQL session using dblink.
CREATE EXTENSION IF NOT EXISTS dblink;
SELECT pg_advisory_lock(241024, 85);
DO $$
DECLARE lock_available boolean;
BEGIN
  SELECT acquired INTO lock_available
  FROM dblink('dbname=' || current_database() || ' user=postgres password=postgres',
    'SELECT pg_try_advisory_lock(241024,85) AS acquired')
    AS result(acquired boolean);
  IF lock_available THEN
    RAISE EXCEPTION 'Independent DB session acquired an already-held global parser lock';
  END IF;
END $$;
SELECT pg_advisory_unlock(241024,85);
DO $$
DECLARE lock_available boolean;
BEGIN
  SELECT acquired INTO lock_available
  FROM dblink('dbname=' || current_database() || ' user=postgres password=postgres',
    'SELECT pg_try_advisory_lock(241024,85) AS acquired')
    AS result(acquired boolean);
  IF NOT lock_available THEN
    RAISE EXCEPTION 'Global parser lock remained unavailable after release';
  END IF;
END $$;
