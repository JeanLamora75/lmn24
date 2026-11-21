-- Allow administrative activation without a national channel number.
-- Number uniqueness and positivity constraints remain unchanged.
-- Idempotent for installations with or without the candidate TV schema.
DO $$
BEGIN
 IF to_regclass('public.tv_channel_country') IS NOT NULL THEN
  ALTER TABLE public.tv_channel_country
   DROP CONSTRAINT IF EXISTS tv_channel_country_active_number;
 END IF;
END
$$;
