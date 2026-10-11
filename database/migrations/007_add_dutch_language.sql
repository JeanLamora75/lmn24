-- LMN24 / SCRUM-28 — Ajouter le néerlandais aux bases existantes.
-- À exécuter une fois (réexécution sans risque) sur la base du projet.
-- Migration de données uniquement : aucune colonne/table/contrainte modifiée.
BEGIN;

INSERT INTO language (iso_code2, is_active)
VALUES ('nl', TRUE)
ON CONFLICT (iso_code2)
DO UPDATE SET
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;
