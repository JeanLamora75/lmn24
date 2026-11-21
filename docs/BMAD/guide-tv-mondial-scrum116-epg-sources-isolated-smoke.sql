-- SCRUM-116: disposable PostgreSQL TV schema only; all changes rolled back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.country(id) VALUES ('b1000000-0000-4000-8000-000000000001');
INSERT INTO public.tv_country(country_id,reference_timezone,is_active) VALUES
 ('b1000000-0000-4000-8000-000000000001','Europe/Paris',TRUE);
INSERT INTO public.tv_source(id,name,source_url,format,is_active,rights_status,
 programme_rights_status,programme_rights_reference, synopsis_rights_status,
 image_rights_status,logo_rights_status) VALUES
 ('b2000000-0000-4000-8000-000000000001','EPG A','https://epg-a.example.org/feed.xml','XMLTV',TRUE,'UNREVIEWED',
  'APPROVED','https://licensing.example.org/terms','UNREVIEWED','REJECTED','EXPIRED'),
 ('b2000000-0000-4000-8000-000000000002','EPG B','https://epg-b.example.org/feed.gz','XMLTV_GZIP',TRUE,'UNREVIEWED',
  'UNREVIEWED',NULL,'UNREVIEWED','UNREVIEWED','UNREVIEWED');
INSERT INTO public.tv_source_country(source_id,country_id,priority,is_active) VALUES
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',1,TRUE),
 ('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',2,TRUE);
INSERT INTO public.tv_channel(id,slug,name) VALUES
 ('b3000000-0000-4000-8000-000000000001','epg-smoke','EPG Smoke');
INSERT INTO public.tv_channel_external_id(source_id,external_id) VALUES
 ('b2000000-0000-4000-8000-000000000001','source#epg-smoke');
DO $qa$
DECLARE rejected BOOLEAN;
BEGIN
  -- No name-only auto approval; mappings begin PENDING_REVIEW.
  IF (SELECT mapping_status FROM public.tv_channel_external_id
     WHERE external_id='source#epg-smoke') <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'SCRUM116: mapping auto-approved';
  END IF;
  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_channel_external_id SET mapping_status='VERIFIED'
    WHERE external_id='source#epg-smoke';
  EXCEPTION WHEN check_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM116: verified mapping without channel'; END IF;
  UPDATE public.tv_channel_external_id SET mapping_status='VERIFIED',
   channel_id='b3000000-0000-4000-8000-000000000001'
   WHERE external_id='source#epg-smoke';

  IF NOT EXISTS (SELECT 1 FROM public.tv_source WHERE
    id='b2000000-0000-4000-8000-000000000001'
    AND programme_rights_status='APPROVED'
    AND synopsis_rights_status='UNREVIEWED'
    AND image_rights_status='REJECTED'
    AND logo_rights_status='EXPIRED') THEN
    RAISE EXCEPTION 'SCRUM116: independent rights lost'; END IF;

  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_source SET image_rights_status='INVALID'
    WHERE id='b2000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM116: invalid rights accepted'; END IF;

  rejected:=FALSE;
  BEGIN
    INSERT INTO public.tv_source_country(source_id,country_id,priority)
    VALUES('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',1);
  EXCEPTION WHEN unique_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM116: duplicate source-country unexpectedly accepted'; END IF;
  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_source_country SET priority=1
      WHERE source_id='b2000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN unique_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM116: duplicate national priority accepted'; END IF;
END $qa$;
ROLLBACK;
\echo 'SCRUM116_EPG_SOURCES_PASS'
