-- SCRUM-69 - LMN24 world weather; additive/replayable on historical PostgreSQL.
-- This is also mirrored under packages/database/migrations/ for Prisma schema parity.
-- IMPORTANT: run ONE migration SQL path, not both. Back up LMN24 first.
-- Compatible with an existing weather_city table created by lmn24_weather_city_66.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.weather_city (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  country_iso2 CHAR(2) NOT NULL,
  continent_code CHAR(2) NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  display_order SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT weather_city_country_iso2_format_chk CHECK (country_iso2 ~ '^[A-Z]{2}$'),
  CONSTRAINT weather_city_continent_chk CHECK (continent_code IN ('EU','AS','AF','NA','SA','OC')),
  CONSTRAINT weather_city_latitude_chk CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT weather_city_longitude_chk CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT weather_city_display_order_chk CHECK (display_order > 0),
  CONSTRAINT weather_city_continent_order_uq UNIQUE (continent_code, display_order)
);

CREATE INDEX IF NOT EXISTS idx_weather_city_active_continent_order
  ON public.weather_city (continent_code, display_order) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_weather_city_country_iso2
  ON public.weather_city (country_iso2);

CREATE TABLE IF NOT EXISTS public.weather_current (
  city_id UUID PRIMARY KEY
    CONSTRAINT weather_current_city_id_fkey REFERENCES public.weather_city(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  temperature_c NUMERIC(5,2) NOT NULL,
  apparent_temperature_c NUMERIC(5,2),
  humidity_pct SMALLINT,
  wind_speed_kmh NUMERIC(6,2),
  weather_code SMALLINT NOT NULL,
  is_day BOOLEAN NOT NULL,
  observed_at TIMESTAMPTZ(6) NOT NULL,
  fetched_at TIMESTAMPTZ(6) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'OPEN_METEO',
  CONSTRAINT weather_current_humidity_chk CHECK (humidity_pct IS NULL OR humidity_pct BETWEEN 0 AND 100),
  CONSTRAINT weather_current_wind_chk CHECK (wind_speed_kmh IS NULL OR wind_speed_kmh >= 0),
  CONSTRAINT weather_current_provider_chk CHECK (provider IN ('OPEN_METEO'))
);
CREATE INDEX IF NOT EXISTS idx_weather_current_observed_at
  ON public.weather_current (observed_at);

CREATE TABLE IF NOT EXISTS public.weather_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
  continent_code CHAR(2),
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ(6),
  status VARCHAR(16) NOT NULL DEFAULT 'RUNNING',
  total_cities INTEGER NOT NULL DEFAULT 0,
  processed_cities INTEGER NOT NULL DEFAULT 0,
  successful_cities INTEGER NOT NULL DEFAULT 0,
  failed_cities INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  CONSTRAINT weather_run_trigger_chk CHECK (trigger IN ('MANUAL','AUTOMATIC')),
  CONSTRAINT weather_run_continent_chk CHECK (continent_code IS NULL OR continent_code IN ('EU','AS','AF','NA','SA','OC')),
  CONSTRAINT weather_run_status_chk CHECK (status IN ('RUNNING','SUCCESS','PARTIAL','ERROR','INTERRUPTED')),
  CONSTRAINT weather_run_dates_chk CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT weather_run_counts_chk CHECK (
    total_cities >= 0 AND processed_cities >= 0 AND
    successful_cities >= 0 AND failed_cities >= 0 AND
    processed_cities <= total_cities AND
    successful_cities + failed_cities <= processed_cities
  )
);
CREATE INDEX IF NOT EXISTS idx_weather_run_started_at
  ON public.weather_run (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_run_status
  ON public.weather_run (status);

COMMENT ON TABLE public.weather_city IS 'Selected cities for LMN24 worldwide weather.';
COMMENT ON TABLE public.weather_current IS 'One current observation per city, refreshed by weather parser.';
COMMENT ON TABLE public.weather_run IS 'Persistent history of weather parser launches.';

COMMIT;
