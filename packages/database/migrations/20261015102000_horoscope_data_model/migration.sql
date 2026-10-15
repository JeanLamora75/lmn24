-- SCRUM-62: additive horoscope data model, no existing data removed.
BEGIN;
CREATE TABLE public.horoscope_astronomy_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL CONSTRAINT horoscope_astronomy_date_unique UNIQUE,
  generated_at TIMESTAMPTZ(6) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  astronomy JSONB NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  source_fingerprint VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT horoscope_astronomy_timezone_check CHECK (timezone = 'Europe/Paris'),
  CONSTRAINT horoscope_astronomy_fingerprint_check CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT horoscope_astronomy_object_check CHECK (jsonb_typeof(astronomy) = 'object')
);
CREATE TABLE public.horoscope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  sign VARCHAR(20) NOT NULL,
  language_iso_code2 CHAR(2) NOT NULL REFERENCES public.language(iso_code2) ON DELETE RESTRICT ON UPDATE CASCADE,
  general TEXT NOT NULL,
  love TEXT NOT NULL,
  work TEXT NOT NULL,
  finance TEXT NOT NULL,
  disclaimer TEXT NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  source_fingerprint VARCHAR(64) NOT NULL,
  astronomy_snapshot_id UUID NOT NULL REFERENCES public.horoscope_astronomy_snapshot(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT horoscope_date_sign_language_unique UNIQUE (date,sign,language_iso_code2),
  CONSTRAINT horoscope_sign_check CHECK (sign IN ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')),
  CONSTRAINT horoscope_language_check CHECK (language_iso_code2 IN ('fr','en','de','es','it','pt','ru','nl')),
  CONSTRAINT horoscope_text_check CHECK (
    length(btrim(general)) > 0 AND length(btrim(love)) > 0 AND
    length(btrim(work)) > 0 AND length(btrim(finance)) > 0 AND
    length(btrim(disclaimer)) > 0
  ),
  CONSTRAINT horoscope_fingerprint_check CHECK (source_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_horoscope_language_sign_date ON public.horoscope(language_iso_code2,sign,date);
CREATE INDEX idx_horoscope_astronomy_snapshot_id ON public.horoscope(astronomy_snapshot_id);
CREATE TABLE public.horoscope_import_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(16) NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  file_fingerprint VARCHAR(64),
  target_date DATE,
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ(6),
  status VARCHAR(16) NOT NULL DEFAULT 'RUNNING',
  items_expected INTEGER NOT NULL DEFAULT 96,
  items_valid INTEGER NOT NULL DEFAULT 0,
  items_inserted INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0,
  items_errored INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  triggered_by_user_id UUID REFERENCES public.app_user(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT horoscope_run_source_check CHECK (source_type IN ('REPOSITORY','UPLOAD','SERVER')),
  CONSTRAINT horoscope_run_status_check CHECK (status IN ('RUNNING','SUCCESS','PARTIAL','ERROR','SKIPPED')),
  CONSTRAINT horoscope_run_counter_check CHECK (items_expected >= 0 AND items_valid >= 0 AND items_inserted >= 0 AND items_skipped >= 0 AND items_errored >= 0),
  CONSTRAINT horoscope_run_dates_check CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT horoscope_run_fingerprint_check CHECK (file_fingerprint IS NULL OR file_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_horoscope_import_run_started_at ON public.horoscope_import_run(started_at DESC);
CREATE INDEX idx_horoscope_import_run_date_started ON public.horoscope_import_run(target_date,started_at DESC);
CREATE INDEX idx_horoscope_import_run_status ON public.horoscope_import_run(status);
CREATE INDEX idx_horoscope_import_run_user ON public.horoscope_import_run(triggered_by_user_id);
COMMIT;
