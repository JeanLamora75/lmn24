-- SCRUM-117 — transaction, fencing and old-grid preservation.
-- Isolated CI database only, all fixtures rolled back. Never production.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.country(id) VALUES ('c1000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_country(country_id,reference_timezone,is_active)
VALUES('c1000000-0000-4000-8000-000000000001','Europe/Paris',TRUE);
INSERT INTO public.tv_channel(id,slug,name) VALUES
 ('c2000000-0000-4000-8000-000000000001','scrum117-smoke','Smoke');
INSERT INTO public.tv_channel_country(id,channel_id,country_id,is_active,assigned_number,needs_review)
VALUES('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001',
'c1000000-0000-4000-8000-000000000001',TRUE,3,FALSE);
INSERT INTO public.tv_channel_variant(id,channel_id,code,name,timezone)
VALUES('c4000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001',
'main','Main','Europe/Paris');
INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id) VALUES
 ('c4000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',
 'c2000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_source(id,name,source_url,format,rights_status,
 programme_rights_status,programme_rights_reference)
VALUES('c5000000-0000-4000-8000-000000000001','Smoke source','https://example.org/epg','JSON',
'UNREVIEWED','APPROVED','https://example.org/terms');
INSERT INTO public.tv_programme(id,title) VALUES('c6000000-0000-4000-8000-000000000001','Existing');
INSERT INTO public.tv_import_run(id,trigger,requested_days,status) VALUES
 ('c7000000-0000-4000-8000-000000000001','MANUAL',1,'RUNNING');
INSERT INTO public.tv_import_scope(run_id,country_id,source_id,status) VALUES
 ('c7000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
 'c5000000-0000-4000-8000-000000000001','SUCCESS');
INSERT INTO public.tv_schedule_revision(id,variant_id,local_date,run_id,status) VALUES
 ('c8000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001',
 '2026-11-21','c7000000-0000-4000-8000-000000000001','STAGING'),
 ('c8000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000001',
 '2026-11-21','c7000000-0000-4000-8000-000000000001','STAGING');
INSERT INTO public.tv_airing(revision_id,programme_id,source_id,starts_at,ends_at,fingerprint) VALUES
 ('c8000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
 'c5000000-0000-4000-8000-000000000001','2026-11-21 20:00+01','2026-11-21 21:00+01','old-airing'),
 ('c8000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001',
 'c5000000-0000-4000-8000-000000000001','2026-11-21 21:00+01','2026-11-21 22:00+01','new-airing');
UPDATE public.tv_schedule_revision SET status='VALIDATED' WHERE id IN
 ('c8000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000002');
UPDATE public.tv_schedule_revision SET status='PUBLISHED',published_at=now()
 WHERE id='c8000000-0000-4000-8000-000000000001';
SELECT pg_try_advisory_lock(241024,85) AS acquired \gset
\if :acquired
\else
\echo 'Failed acquiring isolated global lease'
\quit 1
\endif
INSERT INTO public.parser_write_epoch(singleton_id,owner_token,lock_backend_pid)
VALUES(1,'c9000000-0000-4000-8000-000000000001',pg_backend_pid())
ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,
lock_backend_pid=EXCLUDED.lock_backend_pid;
SET LOCAL app.tv_writer_owner='c9000000-0000-4000-8000-000000000001';
INSERT INTO public.tv_schedule_current(variant_id,local_date,revision_id) VALUES
 ('c4000000-0000-4000-8000-000000000001','2026-11-21',
 'c8000000-0000-4000-8000-000000000001');

DO $tests$
DECLARE rejected BOOLEAN;
BEGIN
  -- Unknown/unfinished revision is denied and old pointer stays.
  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_schedule_current
      SET revision_id='c8000000-0000-4000-8000-000000000002'
      WHERE variant_id='c4000000-0000-4000-8000-000000000001'
        AND local_date='2026-11-21';
  EXCEPTION WHEN check_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM117: unpublished revision became current'; END IF;
  IF (SELECT revision_id FROM public.tv_schedule_current
     WHERE variant_id='c4000000-0000-4000-8000-000000000001'
       AND local_date='2026-11-21') <>
       'c8000000-0000-4000-8000-000000000001' THEN
       RAISE EXCEPTION 'SCRUM117: old current lost after rejected switch'; END IF;

  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_airing SET fingerprint='destroy-old'
    WHERE fingerprint='old-airing';
  EXCEPTION WHEN check_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM117: published airing mutated'; END IF;

  -- Switch only after a validated new revision is published, with fenced owner.
  UPDATE public.tv_schedule_revision SET status='PUBLISHED',published_at=now()
  WHERE id='c8000000-0000-4000-8000-000000000002';
  UPDATE public.tv_schedule_current
   SET revision_id='c8000000-0000-4000-8000-000000000002'
   WHERE variant_id='c4000000-0000-4000-8000-000000000001' AND local_date='2026-11-21'
     AND revision_id='c8000000-0000-4000-8000-000000000001';
  IF NOT FOUND THEN RAISE EXCEPTION 'SCRUM117: fenced CAS switch failed'; END IF;
  IF (SELECT count(*) FROM public.tv_airing WHERE fingerprint IN ('old-airing','new-airing'))<>2
   THEN RAISE EXCEPTION 'SCRUM117: prior published snapshot deleted'; END IF;
END $tests$;
ROLLBACK;
\echo 'SCRUM117_ATOMIC_IMPORT_PASS'
