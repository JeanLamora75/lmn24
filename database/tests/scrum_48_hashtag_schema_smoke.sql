-- SCRUM-48 — non-destructive SQL smoke test.
-- Run AFTER applying the hashtag migration, on a test database whenever possible.
-- The test inserts temporary rows and rolls back its own transaction.
\set ON_ERROR_STOP on
BEGIN;

DO $smoke$
DECLARE
    target_id UUID;
    utc_hour TIMESTAMPTZ;
    blocked BOOLEAN;
BEGIN
    INSERT INTO hashtag (name, slug)
    VALUES ('Test SCRUM-48', 'scrum-48-schema-smoke')
    RETURNING id INTO target_id;

    -- Duplicate slug must fail, even when concurrent writers are attempted.
    blocked := FALSE;
    BEGIN
        INSERT INTO hashtag (name, slug) VALUES ('Duplicate', 'scrum-48-schema-smoke');
    EXCEPTION WHEN unique_violation THEN blocked := TRUE;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'duplicate hashtag slug was accepted'; END IF;

    -- Different languages may use the same table; canonical aliases unique
    -- per hashtag, irrespective of the displayed alias spelling/language.
    INSERT INTO hashtag_alias
        (hashtag_id, name, normalized_name, language_iso_code2)
    VALUES
        (target_id, 'Moscou', 'moscou', 'fr'),
        (target_id, 'Москва', 'москва', 'ru');

    blocked := FALSE;
    BEGIN
        INSERT INTO hashtag_alias (hashtag_id, name, normalized_name)
        VALUES (target_id, 'MOSCOU', 'moscou');
    EXCEPTION WHEN unique_violation THEN blocked := TRUE;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'duplicate normalized alias was accepted'; END IF;

    utc_hour := date_trunc('hour', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    INSERT INTO hashtag_hourly_count (hashtag_id, hour_utc, article_count)
    VALUES (target_id, utc_hour, 3);

    blocked := FALSE;
    BEGIN
        INSERT INTO hashtag_hourly_count (hashtag_id, hour_utc, article_count)
        VALUES (target_id, utc_hour, 1);
    EXCEPTION WHEN unique_violation THEN blocked := TRUE;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'duplicate hashtag/hour was accepted'; END IF;

    blocked := FALSE;
    BEGIN
        INSERT INTO hashtag_hourly_count (hashtag_id, hour_utc, article_count)
        VALUES (target_id, utc_hour + interval '1 hour', -1);
    EXCEPTION WHEN check_violation THEN blocked := TRUE;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'negative count was accepted'; END IF;

    blocked := FALSE;
    BEGIN
        INSERT INTO hashtag_hourly_count (hashtag_id, hour_utc, article_count)
        VALUES (target_id, utc_hour + interval '15 minutes', 1);
    EXCEPTION WHEN check_violation THEN blocked := TRUE;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'non-aligned UTC hour was accepted'; END IF;

    DELETE FROM hashtag WHERE id = target_id;

    IF EXISTS (SELECT 1 FROM hashtag_alias WHERE hashtag_id = target_id)
      OR EXISTS (SELECT 1 FROM hashtag_hourly_count WHERE hashtag_id = target_id)
    THEN RAISE EXCEPTION 'cascade delete left dependent rows'; END IF;
END;
$smoke$;

ROLLBACK;
-- Expected: successful transaction then ROLLBACK. No persistent test data.
