-- LMN24 / Winston & Murat — isolated PostgreSQL smoke tests ONLY.
-- Prereqs: a new throwaway DB with public.country(id uuid), existing
-- parser_write_epoch fencing SQL, and TV schema prototype applied.
-- This file creates fixtures inside a transaction and always ROLLBACKs.
BEGIN;
INSERT INTO public.country(id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002');
INSERT INTO public.tv_country(country_id,reference_timezone,is_active)
VALUES ('10000000-0000-4000-8000-000000000001','Europe/Paris',TRUE),
       ('10000000-0000-4000-8000-000000000002','America/New_York',TRUE);
INSERT INTO public.tv_channel(id,slug,name) VALUES
 ('20000000-0000-4000-8000-000000000001','smoke-a','Smoke A'),
 ('20000000-0000-4000-8000-000000000002','smoke-b','Smoke B');
INSERT INTO public.tv_channel_country(id,channel_id,country_id,is_active,manual_number)
VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',TRUE,2),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',FALSE,2);
INSERT INTO public.tv_channel_variant(id,channel_id,code,name,timezone,is_default)
VALUES ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','main','Primary','Europe/Paris',TRUE);
INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id)
VALUES ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');

INSERT INTO public.tv_source(id,name,source_url,format,is_active,rights_status)
VALUES ('50000000-0000-4000-8000-000000000001','EPG Demo','https://invalid.example/epg.xml','XMLTV',TRUE,'APPROVED');
INSERT INTO public.tv_programme(id,title) VALUES ('60000000-0000-4000-8000-000000000001','Programme');
INSERT INTO public.tv_schedule_revision(id,variant_id,local_date,status,published_at)
VALUES ('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-11-20','STAGING',NULL),
       ('70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','2026-11-20','PUBLISHED',now());
INSERT INTO public.tv_airing(id,revision_id,programme_id,source_id,starts_at,ends_at,fingerprint)
VALUES ('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','2026-11-20 20:00+01','2026-11-20 21:00+01','first');

-- Set a real test-only parser lease in this same PostgreSQL session.
SELECT pg_try_advisory_lock(241024,85) AS lease_acquired \gset
\if :lease_acquired
\else
  \echo 'Could not acquire isolated test lease'
  \quit 1
\endif
INSERT INTO public.parser_write_epoch(singleton_id,owner_token,lock_backend_pid)
VALUES (1,'90000000-0000-4000-8000-000000000001',pg_backend_pid())
ON CONFLICT(singleton_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,lock_backend_pid=EXCLUDED.lock_backend_pid;
SET LOCAL app.tv_writer_owner = '90000000-0000-4000-8000-000000000001';
INSERT INTO public.tv_schedule_current(variant_id,local_date,revision_id)
VALUES ('40000000-0000-4000-8000-000000000001','2026-11-20','70000000-0000-4000-8000-000000000002');

DO $test$
DECLARE rejected BOOLEAN;
BEGIN
  -- Same channel/pays enforced by composite FK.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id)
    VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN foreign_key_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: variant-country cross-channel'; END IF;

  rejected := FALSE;
  BEGIN
    INSERT INTO public.tv_channel_country(channel_id,country_id,manual_number)
    VALUES ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',2);
  EXCEPTION WHEN unique_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: effective number uniqueness'; END IF;

  rejected := FALSE;
  BEGIN
    INSERT INTO public.tv_channel_variant(channel_id,code,name,timezone,is_default)
    VALUES ('20000000-0000-4000-8000-000000000001','other','Other','Europe/Paris',TRUE);
  EXCEPTION WHEN unique_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: second default variant'; END IF;

  rejected := FALSE;
  BEGIN
    INSERT INTO public.tv_airing(revision_id,programme_id,source_id,starts_at,ends_at,fingerprint)
    VALUES('70000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','2026-11-20 22:00+01','2026-11-20 23:00+01','second');
  EXCEPTION WHEN check_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: insert on published revision'; END IF;

  rejected := FALSE;
  BEGIN
    DELETE FROM public.tv_airing WHERE id='80000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: delete on published revision'; END IF;

  rejected := FALSE;
  BEGIN
    UPDATE public.tv_schedule_revision SET status='STAGING'
    WHERE id='70000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN check_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: published revision immutable'; END IF;

  rejected := FALSE;
  BEGIN
    UPDATE public.tv_schedule_current SET revision_id='70000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: current cannot target STAGING'; END IF;

  -- Test token rejected even if valid published revision is supplied.
  PERFORM set_config('app.tv_writer_owner','90000000-0000-4000-8000-000000000009',TRUE);
  rejected := FALSE;
  BEGIN
    UPDATE public.tv_schedule_current SET revision_id='70000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN OTHERS THEN rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Failed: stale parser owner accepted'; END IF;
  PERFORM set_config('app.tv_writer_owner','90000000-0000-4000-8000-000000000001',TRUE);
  IF (SELECT revision_id FROM public.tv_schedule_current LIMIT 1) <> '70000000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Failed: current revision was changed by rejected writes';
  END IF;
END $test$;
SELECT 'TV isolation smoke suite succeeded' AS result;
ROLLBACK;
-- Session closes, releasing the advisory lock; fixture data is rolled back.
