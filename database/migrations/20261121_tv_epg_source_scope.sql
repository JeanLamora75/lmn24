-- LMN24 / SCRUM-121 — explicit EPG source geographic scope.
-- Existing sources default GLOBAL until an administrator assigns their country.
-- No inference from URLs or names, and no alteration of existing mappings.
BEGIN;
ALTER TABLE public.tv_source
  ADD COLUMN IF NOT EXISTS geographic_scope varchar(8) NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE public.tv_source
  ADD COLUMN IF NOT EXISTS scope_country_id uuid REFERENCES public.tv_country(country_id) ON DELETE RESTRICT;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conname='tv_source_geographic_scope_valid'
     AND conrelid='public.tv_source'::regclass) THEN
  ALTER TABLE public.tv_source
   ADD CONSTRAINT tv_source_geographic_scope_valid
   CHECK (
     (geographic_scope='GLOBAL' AND scope_country_id IS NULL) OR
     (geographic_scope='COUNTRY' AND scope_country_id IS NOT NULL)
   );
 END IF;
END $$;
COMMIT;
