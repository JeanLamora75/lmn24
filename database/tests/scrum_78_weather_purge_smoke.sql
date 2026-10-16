-- SCRUM-78 — regression smoke for meteorological purge invariants.
-- Runs inside ROLLBACK and NEVER alters persistent data.
-- Requires schema 011 and weather seed in the CI scratch database.
BEGIN;

DO $$
DECLARE
  paris_id uuid;
  active_id uuid := gen_random_uuid();
  historic_id uuid := gen_random_uuid();
BEGIN
  SELECT id INTO paris_id FROM public.weather_city WHERE slug='paris';
  IF paris_id IS NULL THEN RAISE EXCEPTION 'Seed weather_city missing Paris'; END IF;

  INSERT INTO public.weather_current
    (city_id,temperature_c,weather_code,is_day,observed_at,fetched_at)
  VALUES(paris_id,17.0,2,TRUE,now()-interval '9 days',now()-interval '9 days')
  ON CONFLICT(city_id) DO UPDATE SET
    observed_at=EXCLUDED.observed_at, fetched_at=EXCLUDED.fetched_at,
    temperature_c=EXCLUDED.temperature_c;

  INSERT INTO public.weather_run(id,status,trigger,started_at,total_cities)
  VALUES(active_id,'RUNNING','MANUAL',now()-interval '10 days',1);

  INSERT INTO public.weather_run(id,status,trigger,started_at,
    finished_at,total_cities,processed_cities,successful_cities)
  VALUES(historic_id,'SUCCESS','MANUAL',now()-interval '20 days',
    now()-interval '20 days'+interval '1 minute',1,1,1);

  -- Test the exact intended WHERE semantics of the application purge.
  DELETE FROM public.weather_current WHERE observed_at<now()-interval '7 days';
  DELETE FROM public.weather_run
  WHERE status <> 'RUNNING' AND started_at<now()-interval '14 days';

  IF EXISTS (SELECT 1 FROM public.weather_current WHERE city_id=paris_id) THEN
    RAISE EXCEPTION 'Expired observation survived purge';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.weather_city WHERE id=paris_id) THEN
    RAISE EXCEPTION 'Master weather city was lost';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.weather_run WHERE id=active_id AND status='RUNNING') THEN
    RAISE EXCEPTION 'RUNNING parser execution was lost';
  END IF;
  IF EXISTS(SELECT 1 FROM public.weather_run WHERE id=historic_id) THEN
    RAISE EXCEPTION 'Expired completed parser run survived purge';
  END IF;
  IF (SELECT COUNT(*) FROM public.setting WHERE "scope"='GLOBAL'
      AND "key" IN ('weatherCurrentRetentionDays','weatherRunRetentionDays')) <> 2 THEN
    RAISE EXCEPTION 'Missing meteorological retention settings; rerun seeds';
  END IF;
END $$;
ROLLBACK;
