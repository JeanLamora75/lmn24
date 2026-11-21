-- SCRUM-118 — Public read permission and publication invariants.
-- Disposable isolated TV PG schema ONLY, transaction rolled back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.country(id)
VALUES ('e1000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_country(country_id,reference_timezone,is_active)
VALUES ('e1000000-0000-4000-8000-000000000001','Europe/Paris',TRUE);
INSERT INTO public.tv_channel(id,slug,name)
VALUES ('e2000000-0000-4000-8000-000000000001','scrum118-channel','Fixture TV');
INSERT INTO public.tv_channel_country(id,channel_id,country_id,is_active,needs_review,manual_number)
VALUES ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',
'e1000000-0000-4000-8000-000000000001',TRUE,FALSE,2);
INSERT INTO public.tv_channel_variant(id,channel_id,code,name,timezone)
VALUES ('e4000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',
'default','Paris','Europe/Paris');
INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id) VALUES
 ('e4000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
 'e2000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_source(id,name,source_url,format,is_active,
 programme_rights_status,programme_rights_reference,
 synopsis_rights_status,synopsis_rights_reference,
 image_rights_status,image_rights_reference) VALUES
 ('e5000000-0000-4000-8000-000000000001','Approved fixture','https://example.org/epg','JSON',TRUE,
 'APPROVED','https://example.org/licence','REJECTED',NULL,'UNREVIEWED',NULL),
 ('e5000000-0000-4000-8000-000000000002','Unlicensed fixture','https://example.org/epg2','JSON',TRUE,
 'UNREVIEWED',NULL,'UNREVIEWED',NULL,'UNREVIEWED',NULL);
INSERT INTO public.tv_source_country(source_id,country_id,priority,is_active) VALUES
 ('e5000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',1,TRUE),
 ('e5000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',2,TRUE);
INSERT INTO public.tv_programme(id,title,synopsis,image_url) VALUES
 ('e6000000-0000-4000-8000-000000000001','Licensed title','Protected synopsis','https://example.org/image.jpg');
INSERT INTO public.tv_import_run(id,trigger,requested_days,status) VALUES
 ('e7000000-0000-4000-8000-000000000001','MANUAL',1,'SUCCESS');
INSERT INTO public.tv_schedule_revision(id,variant_id,local_date,run_id,status) VALUES
 ('e8000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001',
 '2026-11-21','e7000000-0000-4000-8000-000000000001','STAGING');
INSERT INTO public.tv_airing(revision_id,programme_id,source_id,starts_at,ends_at,fingerprint) VALUES
 ('e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001',
 'e5000000-0000-4000-8000-000000000001',
 '2026-11-21T19:30:00Z','2026-11-21T20:30:00Z','approved'),
 ('e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001',
 'e5000000-0000-4000-8000-000000000002',
 '2026-11-21T21:30:00Z','2026-11-21T22:30:00Z','unapproved');
UPDATE public.tv_schedule_revision SET status='PUBLISHED',published_at=now()
WHERE id='e8000000-0000-4000-8000-000000000001';
SELECT pg_try_advisory_lock(241024,85) AS acquired \gset
\if :acquired
\else
\quit 1
\endif
INSERT INTO public.parser_write_epoch(singleton_id,owner_token,lock_backend_pid)
VALUES (1,'e9000000-0000-4000-8000-000000000001',pg_backend_pid())
ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,
lock_backend_pid=EXCLUDED.lock_backend_pid,updated_at=now();
SET LOCAL app.tv_writer_owner='e9000000-0000-4000-8000-000000000001';
INSERT INTO public.tv_schedule_current(variant_id,local_date,revision_id) VALUES
 ('e4000000-0000-4000-8000-000000000001','2026-11-21',
 'e8000000-0000-4000-8000-000000000001');
DO $qa$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.tv_airing a
  JOIN public.tv_schedule_revision r ON r.id=a.revision_id
  JOIN public.tv_schedule_current cur ON cur.revision_id=r.id
  JOIN public.tv_source src ON src.id=a.source_id
  JOIN public.tv_source_country sc ON sc.source_id=src.id
  JOIN public.tv_variant_country vc ON vc.variant_id=r.variant_id
  JOIN public.tv_channel_country cc ON cc.id=vc.channel_country_id
    AND cc.country_id=sc.country_id
  JOIN public.tv_country tc ON tc.country_id=cc.country_id
  JOIN public.country c ON c.id=tc.country_id
  WHERE r.status='PUBLISHED' AND src.is_active AND sc.is_active
    AND tc.is_active AND c.is_active AND cc.is_active AND NOT cc.needs_review
    AND src.programme_rights_status='APPROVED'
    AND nullif(btrim(src.programme_rights_reference),'') IS NOT NULL;
  IF n<>1 THEN RAISE EXCEPTION 'SCRUM118: unlicensed airing leaked (count %)',n; END IF;
  UPDATE public.tv_country SET is_active=FALSE WHERE country_id='e1000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO n FROM public.tv_channel_country cc
    JOIN public.tv_country tc ON tc.country_id=cc.country_id
    WHERE tc.is_active AND cc.is_active AND NOT cc.needs_review;
  IF n<>0 THEN RAISE EXCEPTION 'SCRUM118: disabled country remains visible'; END IF;
END $qa$;
ROLLBACK;
\echo 'SCRUM118_PUBLIC_FILTERS_PASS'
