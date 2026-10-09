-- LMN24 - Paramètres par défaut
-- Paramètres fonctionnels modifiables depuis l'administration.
-- Les paramètres spécifiques à une catégorie ou à un feed seront créés
-- uniquement lorsqu'une surcharge est nécessaire.

BEGIN;

INSERT INTO setting ("key", value, type, scope, scope_id, description)
VALUES
    (
        'defaultLanguage',
        'fr',
        'STRING',
        'GLOBAL',
        NULL,
        'Langue utilisée par défaut lorsque aucune langue utilisateur valide n''est disponible.'
    ),
    (
        'parserCronExpression',
        '0 * * * *',
        'STRING',
        'GLOBAL',
        NULL,
        'Fréquence d''exécution automatique du parser. Valeur par défaut : toutes les heures.'
    ),
    (
        'parser.feed_timeout_seconds',
        '5',
        'INTEGER',
        'GLOBAL',
        NULL,
        'Timeout HTTP en secondes pour la récupération d''un flux RSS/XML.'
    ),
    (
        'parser.feed_retry_count',
        '2',
        'INTEGER',
        'GLOBAL',
        NULL,
        'Nombre de nouvelles tentatives après l''échec d''un flux RSS/XML.'
    ),
    (
        'parserMaxConcurrency',
        '5',
        'INTEGER',
        'GLOBAL',
        NULL,
        'Nombre maximal de feeds pouvant être traités simultanément.'
    ),
    (
        'articleRetentionDays',
        '3',
        'INTEGER',
        'GLOBAL',
        NULL,
        'Nombre de jours de conservation des articles avant suppression automatique.'
    ),
    (
        'articleRetentionReference',
        'createdAt',
        'STRING',
        'GLOBAL',
        NULL,
        'Champ utilisé comme référence pour calculer la durée de conservation : createdAt ou publishedAt.'
    ),
    (
        'backendCacheTtlMs',
        '60000',
        'DURATION',
        'GLOBAL',
        NULL,
        'Durée du cache mémoire du backend en millisecondes.'
    ),
    (
        'articlesPerCategory',
        '20',
        'INTEGER',
        'GLOBAL',
        NULL,
        'Nombre d''articles affichés par défaut pour une catégorie.'
    )
ON CONFLICT ("key") WHERE scope = 'GLOBAL'
DO UPDATE SET
    value = EXCLUDED.value,
    type = EXCLUDED.type,
    description = EXCLUDED.description,
    updated_at = NOW();

COMMIT;
