-- SCRUM-117: deletion of PUBLISHED data only with expiry + owner lease + explicit retention.
-- Runs on disposable PG17 database with parser epoch; all fixtures rollback.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.country(id) VALUES ('d1000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_country(country_id,reference_timezone,is_active)
VALUES ('d1000000-0000-4000-8000-000000000001','UTC',TRUE);
INSERT INTO public.tv_channel(id,slug,name) VALUES
('d2000000-0000-4000-8000-000000000001','scrum117-retention','Retention');
INSERT INTO public.tv_channel_country(id,channel_id,country_id) VALUES
('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
'd1000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_channel_variant(id,channel_id,code,name,timezone) VALUES
('d4000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','main','Main','UTC');
INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id) VALUES
('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',
'd2000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_source(id,name,source_url,format)
VALUES('d5000000-0000-4000-8000-000000000001','Test','https://example.org/epg','JSON');
INSERT INTO public.tv_programme(id,title)
VALUES('d6000000-0000-4000-8000-000000000001','Old programme');
INSERT INTO public.tv_schedule_revision(id,variant_id,local_date,status,published_at) VALUES
('d8000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001',
'2025-01-01','STAGING',NULL),
('d8000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000001',
CURRENT_DATE,'STAGING',NULL);
INSERT INTO public.tv_airing(revision_id,programme_id,source_id,starts_at,ends_at,fingerprint) VALUES
('d8000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',
'd5000000-0000-4000-8000-000000000001','2025-01-01 20:00+00','2025-01-01 21:00+00','old-retention'),
('d8000000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000001',
'd5000000-0000-4000-8000-000000000001',now(),now()+interval '1 hour','new-retention');
UPDATE public.tv_schedule_revision SET status='PUBLISHED',published_at=now()
WHERE id IN ('d8000000-0000-4000-8000-000000000001',
             'd8000000-0000-4000-8000-000000000002');
SELECT pg_try_advisory_lock(241024,85) AS acquired \gset
\if :acquired
\else
\quit 1
\endif
INSERT INTO public.parser_write_epoch(singleton_id,owner_token,lock_backend_pid)
VALUES(1,'d9000000-0000-4000-8000-000000000001',pg_backend_pid())
ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,
lock_backend_pid=EXCLUDED.lock_backend_pid;
SET LOCAL app.tv_writer_owner='d9000000-0000-4000-8000-000000000001';
DO $test$
DECLARE denied BOOLEAN;
BEGIN
  denied:=FALSE;
  BEGIN
    DELETE FROM public.tv_airing WHERE fingerprint='old-retention';
  EXCEPTION WHEN check_violation THEN denied:=TRUE;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'SCRUM117: old published content deleted WITHOUT retention mode'; END IF;
END $test$;
SELECT set_config('app.tv_retention','true',true);
DO $test$
DECLARE denied BOOLEAN;
BEGIN
  denied:=FALSE;
  BEGIN
    DELETE FROM public.tv_airing WHERE fingerprint='new-retention';
  EXCEPTION WHEN check_violation THEN denied:=TRUE;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'SCRUM117: recent publication deleted'; END IF;
END $test$;
DELETE FROM public.tv_airing WHERE fingerprint='old-retention';
DELETE FROM public.tv_schedule_revision WHERE id='d8000000-0000-4000-8000-000000000001';
DO $test$
BEGIN
 IF EXISTS (SELECT 1 FROM public.tv_schedule_revision
     WHERE id='d8000000-0000-4000-8000-000000000001')
   THEN RAISE EXCEPTION 'SCRUM117: expired row was not removed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tv_airing WHERE fingerprint='new-retention')
   THEN RAISE EXCEPTION 'SCRUM117: recent content was removed'; END IF;
END $test$;
ROLLBACK;
\echo 'SCRUM117_RETENTION_PASS'
