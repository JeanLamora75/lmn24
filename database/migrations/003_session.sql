-- LMN24 - Migration 003
-- Création de la table Session pour les sessions d'administration persistées

BEGIN;

CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT session_token_hash_unique UNIQUE (token_hash),

    CONSTRAINT session_user_fk
        FOREIGN KEY (user_id)
        REFERENCES app_user(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_session_user_id
    ON session(user_id);

CREATE INDEX idx_session_expires_at
    ON session(expires_at);

CREATE INDEX idx_session_revoked_at
    ON session(revoked_at);

DROP TRIGGER IF EXISTS trg_session_updated_at ON session;
CREATE TRIGGER trg_session_updated_at
BEFORE UPDATE ON session
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
