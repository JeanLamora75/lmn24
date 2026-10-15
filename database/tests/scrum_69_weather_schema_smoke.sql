-- SCRUM-69 - PostgreSQL smoke test for weather schema and initial data.
-- Execute AFTER migration 011 + city/settings seeds.
-- Runs in a transaction and rolls back test data.
BEGIN;

DO $$
DECLARE
  expected RECORD;
  real_count INTEGER;
  smoke_city_id UUID;
BEGIN
  IF to_regclass('public.weather_city') IS NULL
    OR to_regclass('public.weather_current') IS NULL
    OR to_regclass('public.weather_run') IS NULL THEN
    RAISE EXCEPTION 'Weather schema missing; apply database/migrations/011_weather_data_model.sql first';
  END IF;

  FOR expected IN
    SELECT * FROM (VALUES ('EU',15),('AS',15),('AF',12),('NA',12),('SA',6),('OC',6))
      AS x(continent_code,minimum_count)
  LOOP
    SELECT COUNT(*) INTO real_count
      FROM public.weather_city c WHERE c.continent_code = expected.continent_code;
    IF real_count < expected.minimum_count THEN
      RAISE EXCEPTION 'Insufficient cities for %: expected at least %, got %',
        expected.continent_code, expected.minimum_count, real_count;
    END IF;
  END LOOP;

  IF (SELECT COUNT(*) FROM public.weather_city) < 66 THEN
    RAISE EXCEPTION 'Expected at least 66 cities after seed';
  END IF;

  IF (SELECT COUNT(*) FROM public.setting
    WHERE "scope"='GLOBAL' AND "key" IN (
      'weatherCurrentRefreshMinutes','weatherStaleAfterMinutes','weatherRunRetentionDays'
    )) <> 3 THEN
    RAISE EXCEPTION 'Missing one or more global weather settings';
  END IF;

  -- Check the city/current relationship and defaults on ephemeral records.
  INSERT INTO public.weather_city
    (slug,name,country_iso2,continent_code,latitude,longitude,timezone,display_order)
    VALUES ('scrum69-smoke-city','Weather Smoke City','FR','EU',48.0,2.0,'Europe/Paris',30000)
    RETURNING id INTO smoke_city_id;

  INSERT INTO public.weather_current
    (city_id,temperature_c,weather_code,is_day,observed_at,fetched_at)
  VALUES (smoke_city_id,18.0,1,TRUE,now(),now());

  IF (SELECT provider FROM public.weather_current WHERE city_id = smoke_city_id) <> 'OPEN_METEO' THEN
    RAISE EXCEPTION 'Expected OPEN_METEO provider default';
  END IF;

  BEGIN
    INSERT INTO public.weather_city
      (slug,name,country_iso2,continent_code,latitude,longitude,timezone,display_order)
    VALUES ('scrum69-invalid-city','Invalid','FR','EU',91.0,2.0,'Europe/Paris',29999);
    RAISE EXCEPTION 'Invalid latitude unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.weather_current SET humidity_pct = 101 WHERE city_id = smoke_city_id;
    RAISE EXCEPTION 'Invalid humidity unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.weather_run (total_cities,processed_cities)
    VALUES (1,2);
    RAISE EXCEPTION 'Invalid parser counters unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  DELETE FROM public.weather_city WHERE id=smoke_city_id;
  IF EXISTS(SELECT 1 FROM public.weather_current WHERE city_id=smoke_city_id) THEN
    RAISE EXCEPTION 'Weather current was not removed with its test city';
  END IF;
END $$;

SELECT continent_code,COUNT(*) AS city_count
  FROM public.weather_city
  GROUP BY continent_code ORDER BY continent_code;
SELECT COUNT(*) AS total_cities FROM public.weather_city;

ROLLBACK;
