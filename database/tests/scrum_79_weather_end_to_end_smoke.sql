-- SCRUM-79 — end-to-end SQL acceptance checks for the weather MVP.
-- ONLY run on an isolated test database after migration 011 and both weather seeds.
-- Entire scenario is rolled back, including simulated parser writes and purges.
BEGIN;
DO $$
DECLARE
  scope RECORD;
  city_paris UUID;
  city_tokyo UUID;
  city_berlin UUID;
  test_run UUID := gen_random_uuid();
  n INTEGER;
  active_n INTEGER;
BEGIN
  IF (SELECT count(*) FROM public.weather_city) <> 66 THEN
    RAISE EXCEPTION 'Fresh CI weather seed must contain exactly 66 cities';
  END IF;
  FOR scope IN SELECT * FROM (VALUES
    ('EU',15),('AS',15),('AF',12),('NA',12),('SA',6),('OC',6)
  ) AS expected(continent_code,expected_count)
  LOOP
    SELECT count(*) INTO n FROM public.weather_city
      WHERE continent_code=scope.continent_code AND is_active;
    IF n <> scope.expected_count THEN
      RAISE EXCEPTION 'Active city count for % must be %, found %',
        scope.continent_code,scope.expected_count,n;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.weather_city c
    WHERE NOT EXISTS (SELECT 1 FROM pg_timezone_names t WHERE t.name=c.timezone)) THEN
    RAISE EXCEPTION 'One or more city IANA timezones are not recognized by PostgreSQL';
  END IF;
  SELECT id INTO city_paris FROM public.weather_city WHERE slug='paris';
  SELECT id INTO city_tokyo FROM public.weather_city WHERE slug='tokyo';
  SELECT id INTO city_berlin FROM public.weather_city WHERE slug='berlin';
  IF city_paris IS NULL OR city_tokyo IS NULL OR city_berlin IS NULL THEN
    RAISE EXCEPTION 'Required seed cities are missing';
  END IF;

  -- A simulated parser run for two continents, without HTTP or a scheduler.
  INSERT INTO public.weather_run (id,trigger,status,total_cities)
    VALUES(test_run,'MANUAL','RUNNING',3);
  INSERT INTO public.weather_current
    (city_id,temperature_c,weather_code,is_day,observed_at,fetched_at)
  VALUES
    (city_paris,19.2,2,TRUE,now()-interval '10 minutes',now()),
    (city_tokyo,23.4,0,FALSE,now()-interval '20 minutes',now()),
    (city_berlin,4.2,61,TRUE,now()-interval '1 day',now());
  UPDATE public.weather_run
    SET processed_cities=3,successful_cities=2,failed_cities=1,
        status='PARTIAL',finished_at=now(),error_message='One simulated failure'
    WHERE id=test_run;
  IF NOT EXISTS (SELECT 1 FROM public.weather_run
    WHERE id=test_run AND status='PARTIAL' AND processed_cities=3
      AND successful_cities=2 AND failed_cities=1) THEN
    RAISE EXCEPTION 'Weather run counters not persisted correctly';
  END IF;
  -- Monotonic upsert: stale supplier results cannot roll back newer values.
  INSERT INTO public.weather_current
    (city_id,temperature_c,weather_code,is_day,observed_at,fetched_at)
    VALUES (city_paris,1.0,0,FALSE,now()-interval '2 days',now())
  ON CONFLICT (city_id) DO UPDATE SET
    temperature_c=EXCLUDED.temperature_c,observed_at=EXCLUDED.observed_at
  WHERE weather_current.observed_at<=EXCLUDED.observed_at;
  IF (SELECT temperature_c FROM public.weather_current WHERE city_id=city_paris)<>19.2 THEN
    RAISE EXCEPTION 'Older supplier weather overwrote a newer observation';
  END IF;

  -- Public API's requested-continent restriction and stale/empty semantics.
  SELECT count(*) INTO n FROM public.weather_city c
    LEFT JOIN public.weather_current w ON w.city_id=c.id
    WHERE c.is_active AND c.continent_code='EU';
  IF n<>15 THEN RAISE EXCEPTION 'EU public query returned % cities, expected 15',n; END IF;
  SELECT count(*) INTO n FROM public.weather_city c
    LEFT JOIN public.weather_current w ON w.city_id=c.id
    WHERE c.is_active AND c.continent_code='EU' AND w.city_id IS NULL;
  IF n<>13 THEN RAISE EXCEPTION 'EU public query should retain 13 cities without readings'; END IF;
  SELECT count(*) INTO n FROM public.weather_city c
    JOIN public.weather_current w ON w.city_id=c.id
    WHERE c.is_active AND c.continent_code='EU'
      AND w.observed_at<now()-interval '180 minutes';
  IF n<>1 THEN RAISE EXCEPTION 'Stale-data boundary not working'; END IF;

  UPDATE public.weather_city SET is_active=FALSE WHERE id=city_berlin;
  SELECT count(*) INTO active_n FROM public.weather_city
    WHERE continent_code='EU' AND is_active;
  IF active_n<>14 THEN RAISE EXCEPTION 'Inactive city appeared in active-count filter'; END IF;

  -- Weather purges must never delete city master and must leave the most recent
  -- run intact (SCRUM-78's separate test checks concurrent RUNNING protection).
  DELETE FROM public.weather_current WHERE observed_at<now()-interval '12 hours';
  IF (SELECT count(*) FROM public.weather_city) <> 66 THEN
    RAISE EXCEPTION 'Weather observation cleanup changed master city count';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.weather_run WHERE id=test_run AND status='PARTIAL') THEN
    RAISE EXCEPTION 'Observation cleanup touched parser run history';
  END IF;
END $$;
ROLLBACK;
