-- LMN24 Guide TV - production readiness inventory (READ ONLY).
-- Run against the target database BEFORE approving any TV DDL.
-- Does not create tables, change privileges or install seeds.
-- Fail closed if the legacy prerequisites are missing or a partial TV schema exists.
DO $preflight$
DECLARE
  tv_count integer;
  missing text;
BEGIN
  IF to_regclass('public.country') IS NULL THEN
    RAISE EXCEPTION 'TV preflight: public.country missing';
  END IF;
  IF to_regprocedure('public.assert_parser_write_epoch(uuid)') IS NULL THEN
    RAISE EXCEPTION 'TV preflight: parser write-fence function missing';
  END IF;
  SELECT count(*) INTO tv_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
    AND c.relname LIKE 'tv_%';
  IF tv_count NOT IN (0,19) THEN
    RAISE EXCEPTION 'TV preflight: unexpected partial TV schema (% tables)', tv_count;
  END IF;
  IF tv_count = 19 THEN
    SELECT string_agg(expected.name, ', ') INTO missing
    FROM unnest(ARRAY[
      'tv_country','tv_channel','tv_channel_country','tv_channel_language',
      'tv_channel_variant','tv_variant_country','tv_source','tv_source_country',
      'tv_channel_external_id','tv_channel_description','tv_programme',
      'tv_import_run','tv_import_scope','tv_import_event',
      'tv_schedule_revision','tv_airing','tv_schedule_current',
      'tv_translation_provider','tv_translation_attempt'
    ]::text[]) expected(name)
    WHERE to_regclass('public.' || expected.name) IS NULL;
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'TV preflight: missing tables: %', missing;
    END IF;
  END IF;
  RAISE NOTICE 'TV preflight prerequisites OK; TV tables present: %', tv_count;
END
$preflight$;

-- The application role must at least be present. Its actual privileges on
-- the newly installed TV objects must be proven in an isolated rehearsal.
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'lmn24_app';
SELECT to_regclass('public.country') AS legacy_country,
       to_regprocedure('public.assert_parser_write_epoch(uuid)') AS parser_writer_fence;
