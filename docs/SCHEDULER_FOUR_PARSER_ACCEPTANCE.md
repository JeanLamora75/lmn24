# LMN24 — Chantier 2 : recette intégrée des quatre parsers

Mise à jour : 2026-10-17. Branche consolidée : PR #109.

## Matrice de validation automatisée

| Domaine | Preuve | Validation |
|---|---|---|
| Planificateur (4 types) | `scheduler-four-engine-process.test.ts` : quatre jobs, priorité, transitions/ownerToken, absence de RUNNING | PostgreSQL réel |
| Planificateur désactivé | Aucune exécution si `scheduler_config.is_enabled=false` | PostgreSQL réel |
| Conflit manuel/automatique | Verrou exclusif, état BUSY et absence de consommation de tentative | PostgreSQL réel |
| Résilience | Réessais plafonnés à trois et passage en ERROR terminal | PostgreSQL réel |
| Articles RSS | `parser-content-e2e-process.test.ts` : moteur ParserEngine réel, flux RSS/XML local, article persisté, deuxième extraction sans doublon | PostgreSQL réel |
| Vidéos YouTube | Moteur VideoParserEngine réel, Atom XML local, vidéo persistée, réimport sans doublon | PostgreSQL réel |
| Météo | Moteur WeatherParserEngine réel, JSON Open-Meteo déterministe, `weather_current` et `weather_run` persistés | PostgreSQL réel |
| Horoscope | `horoscope-persistence-process.test.ts` : service HoroscopeImportService réel, 96 combinaisons signe-langue, snapshot, audit SUCCESS puis SKIPPED, sans remplacement | PostgreSQL réel |
| Passerelle Horoscope | Réponses 200/SUCCESS, 404 fichier absent, 409 verrou occupé, 503 backend indisponible | Tests du client HTTP |
| Verrou et fencing | `scheduler-recovery-process`, `lease-loss-process`, `parser-write-fence-process` et SQL intersessions | PostgreSQL multi-processus |
| Adaptateurs moteurs | `existing-parser-adapters.test.ts` vérifie SUCCESS, ERROR, PARTIAL, batch manquant | Tests applicatifs |

## Environnement d'exécution

Les tests sont exécutés sur une **base PostgreSQL 17 éphémère dans GitHub Actions**, avec les véritables schémas SQL RSS, Vidéos, Météo, Horoscope et les trois migrations du scheduler. Le réseau externe est simulé par des réponses XML/JSON contrôlées, pour obtenir des résultats déterministes et ne pas dépendre des quotas/fournisseurs. Les traitements écrivent **réellement** en base ; leurs données de test sont supprimées après l'exécution.

Les tests du planificateur invoquent des exécuteurs instrumentés qui acquièrent les **vrais verrous et jobs PostgreSQL**. Les trois moteurs de collecte et le service réel Horoscope sont exercés dans leurs tests d'intégration distincts. La campagne couvre ainsi les composants bout à bout et leurs interfaces, sans prétendre à un unique parcours HTTP complet à travers quatre services démarrés simultanément.

## Limites et décisions de déploiement

- Ces tests ne valident ni la disponibilité en direct des flux RSS, de YouTube, d'Open-Meteo ou de la source des fichiers Horoscope, ni la configuration des secrets, ni les ports et services du VPS.
- Ils ne substituent pas une **recette de préproduction sur un processus déployé** ni la vérification de l'absence de double déclenchement avec les anciens cron.
- Le planificateur reste **désactivé en production**. L'activation nécessite le chantier de déploiement progressif, une sauvegarde PostgreSQL vérifiée, l'application des migrations et un mécanisme de retour arrière.
- Aucune opération de test n'écrit dans la base de production LMN24.
