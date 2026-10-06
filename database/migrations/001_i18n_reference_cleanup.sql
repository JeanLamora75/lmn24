-- LMN24 - Migration i18n des référentiels
-- À exécuter UNE FOIS sur une base créée avec l'ancien schema.sql.
-- Cette migration suppose que la table language/feed ne contient pas encore de données à conserver.

BEGIN;

ALTER TABLE country
    DROP COLUMN IF EXISTS name;

ALTER TABLE category
    DROP COLUMN IF EXISTS name;

ALTER TABLE feed
    DROP CONSTRAINT IF EXISTS feed_language_fk;

ALTER TABLE feed
    DROP COLUMN IF EXISTS language_id;

DROP TABLE IF EXISTS language;

CREATE TABLE language (
    iso_code2 CHAR(2) PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT language_iso_code2_format CHECK (iso_code2 ~ '^[a-z]{2}$')
);

DROP TRIGGER IF EXISTS trg_language_updated_at ON language;
CREATE TRIGGER trg_language_updated_at
BEFORE UPDATE ON language
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE feed
    ADD COLUMN language_iso_code2 CHAR(2);

ALTER TABLE feed
    ADD CONSTRAINT feed_language_fk
    FOREIGN KEY (language_iso_code2)
    REFERENCES language(iso_code2)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_feed_language_iso_code2
    ON feed(language_iso_code2);

COMMIT;
