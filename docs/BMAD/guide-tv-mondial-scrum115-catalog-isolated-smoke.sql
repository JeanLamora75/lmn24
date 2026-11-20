-- SCRUM-115: catalogue / per-country default variant regression.
-- Disposable tv_guide_isolated database ONLY. Everything rolls back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.country(id) VALUES
('a1000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000002');
INSERT INTO public.tv_country(country_id,reference_timezone,is_active) VALUES
('a1000000-0000-4000-8000-000000000001','Europe/Paris',TRUE),
('a1000000-0000-4000-8000-000000000002','America/New_York',TRUE);
INSERT INTO public.tv_channel(id,slug,name) VALUES
('a2000000-0000-4000-8000-000000000001','scrum115-main','Test channel'),
('a2000000-0000-4000-8000-000000000002','scrum115-other','Second channel');
INSERT INTO public.tv_channel_country(id,channel_id,country_id,official_number,assigned_number) VALUES
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',2,5),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',2,5),
('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',3,6);
INSERT INTO public.tv_channel_variant(id,channel_id,code,name,timezone) VALUES
('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','east','Eastern','America/New_York'),
('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','west','Western','America/Los_Angeles'),
('a4000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000002','other','Other','Europe/Paris');
INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id) VALUES
('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
('a4000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
('a4000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001'),
('a4000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000002');
UPDATE public.tv_channel_country SET default_variant_id='a4000000-0000-4000-8000-000000000001'
WHERE id='a3000000-0000-4000-8000-000000000001';
UPDATE public.tv_channel_country SET default_variant_id='a4000000-0000-4000-8000-000000000002'
WHERE id='a3000000-0000-4000-8000-000000000002';

DO $assert$
DECLARE rejected BOOLEAN;
BEGIN
  -- Country B cannot select country A's east variant even though same channel.
  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_channel_country
       SET default_variant_id='a4000000-0000-4000-8000-000000000001'
     WHERE id='a3000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN foreign_key_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM115: cross-country variant was accepted'; END IF;

  -- Country A cannot select another channel's variant.
  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_channel_country
       SET default_variant_id='a4000000-0000-4000-8000-000000000003'
     WHERE id='a3000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN foreign_key_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM115: cross-channel variant was accepted'; END IF;

  -- The default numbering order is manual > official > assigned.
  IF (SELECT coalesce(manual_number,official_number,assigned_number)
      FROM public.tv_channel_country WHERE id='a3000000-0000-4000-8000-000000000001')<>2 THEN
      RAISE EXCEPTION 'SCRUM115: official number not respected';
  END IF;
  UPDATE public.tv_channel_country SET manual_number=9
  WHERE id='a3000000-0000-4000-8000-000000000001';
  UPDATE public.tv_channel_country SET official_number=8
  WHERE id='a3000000-0000-4000-8000-000000000001';
  IF (SELECT coalesce(manual_number,official_number,assigned_number)
      FROM public.tv_channel_country WHERE id='a3000000-0000-4000-8000-000000000001')<>9 THEN
      RAISE EXCEPTION 'SCRUM115: manual correction overwritten';
  END IF;

  -- A different channel cannot take the corrected number in the same country.
  rejected:=FALSE;
  BEGIN
    UPDATE public.tv_channel_country SET official_number=9
    WHERE id='a3000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN unique_violation THEN rejected:=TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SCRUM115: same-country number collision accepted'; END IF;

  -- Different countries may use the same channel number.
  IF (SELECT count(*) FROM public.tv_channel_country WHERE official_number=2)<>1 THEN
    RAISE EXCEPTION 'SCRUM115: cross-country uniqueness invalid';
  END IF;

  -- Disabling a country never disables or deletes its channel associations.
  UPDATE public.tv_channel_country SET is_active=TRUE, needs_review=FALSE
    WHERE id='a3000000-0000-4000-8000-000000000001';
  UPDATE public.tv_country SET is_active=FALSE
    WHERE country_id='a1000000-0000-4000-8000-000000000001';
  IF (SELECT count(*) FROM public.tv_channel_country
    WHERE id='a3000000-0000-4000-8000-000000000001' AND is_active AND NOT needs_review)<>1 THEN
    RAISE EXCEPTION 'SCRUM115: disabled country erased channel status';
  END IF;
END $assert$;
-- Imported discoveries start inactive and requiring review even in active country.
INSERT INTO public.tv_channel_country(channel_id,country_id) VALUES
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002');
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tv_channel_country
    WHERE channel_id='a2000000-0000-4000-8000-000000000002'
      AND country_id='a1000000-0000-4000-8000-000000000002'
      AND is_active=FALSE AND needs_review=TRUE) THEN
    RAISE EXCEPTION 'SCRUM115: discovery not inactive and needs review';
  END IF;
END $check$;
ROLLBACK;
\echo 'SCRUM115_CATALOG_PASS'
