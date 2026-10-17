-- SCRUM-91: validate SQL used by scheduler-dispatcher.ts.
-- Isolated test transaction; nothing is left enabled or persisted.
BEGIN;
UPDATE scheduler_config SET is_enabled=TRUE
WHERE parser_type IN ('INFOS','VIDEOS','WEATHER','HOROSCOPE_IMPORT');
INSERT INTO scheduler_job(parser_type,scheduled_for,status,not_before)
VALUES
 ('WEATHER','2030-01-01T00:00:00Z','PENDING','2020-01-01T00:00:00Z'),
 ('VIDEOS','2030-01-01T00:00:00Z','PENDING','2020-01-01T00:00:00Z'),
 ('INFOS','2030-01-01T00:00:00Z','PENDING','2020-01-01T00:00:00Z'),
 ('HOROSCOPE_IMPORT','2030-01-01T00:00:00Z','PENDING','2020-01-01T00:00:00Z');
DO $$
DECLARE winner TEXT;
BEGIN
 SELECT j.parser_type INTO winner
 FROM scheduler_job j JOIN scheduler_config c ON c.parser_type=j.parser_type
 WHERE j.status='PENDING' AND j.not_before <= NOW() AND c.is_enabled=TRUE
 ORDER BY CASE j.parser_type WHEN 'HOROSCOPE_IMPORT' THEN 0 WHEN 'INFOS' THEN 1
 WHEN 'VIDEOS' THEN 2 WHEN 'WEATHER' THEN 3 ELSE 4 END,
 j.scheduled_for ASC,j.id ASC LIMIT 1;
 IF winner <> 'HOROSCOPE_IMPORT' THEN
 RAISE EXCEPTION 'Expected HOROSCOPE_IMPORT first; got %',winner;
 END IF;
END $$;
UPDATE scheduler_config SET is_enabled=FALSE WHERE parser_type='HOROSCOPE_IMPORT';
DO $$
DECLARE winner TEXT;
BEGIN
 SELECT j.parser_type INTO winner
 FROM scheduler_job j JOIN scheduler_config c ON c.parser_type=j.parser_type
 WHERE j.status='PENDING' AND j.not_before <= NOW() AND c.is_enabled=TRUE
 ORDER BY CASE j.parser_type WHEN 'HOROSCOPE_IMPORT' THEN 0 WHEN 'INFOS' THEN 1
 WHEN 'VIDEOS' THEN 2 WHEN 'WEATHER' THEN 3 ELSE 4 END,
 j.scheduled_for ASC,j.id ASC LIMIT 1;
 IF winner <> 'INFOS' THEN RAISE EXCEPTION 'Disabled horoscope selected: %',winner; END IF;
END $$;
UPDATE scheduler_config SET is_enabled=FALSE;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM scheduler_job j JOIN scheduler_config c
 ON c.parser_type=j.parser_type WHERE j.status='PENDING'
 AND j.not_before <= NOW() AND c.is_enabled=TRUE)
 THEN RAISE EXCEPTION 'Disabled parsers still eligible'; END IF;
END $$;
ROLLBACK;
