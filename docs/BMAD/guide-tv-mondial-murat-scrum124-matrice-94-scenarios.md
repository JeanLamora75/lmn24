# SCRUM-124 — Matrice Murat des 94 scénarios UX01–04

Date : 2026-11-21. T = test ciblé existant/ajouté, à confirmer par la CI ; P = partiel ; M = non prouvé, à recetter. Aucun P/M ne vaut acceptation.

| ID | Scénario | Couverture | Preuve / réserve |
|---|---|---|---|
| UX01-01 | Ouvrir sur mobile et ordinateur | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX01-02 | Changer de pays à locale différente | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-03 | Naviguer J0→J+6 | T | tv-guide-model.test.ts (dates J0–J+6) |
| UX01-04 | Ouvrir « Chaînes » sur J+4 | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX01-05 | Changer langue de diffusion | T | tv-guide-model.test.ts (langue diffusion) |
| UX01-06 | Changer mode d'heure | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX01-07 | Emission à 20:20 | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-08 | Emission à 20:30 et à 21:30 | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-09 | Grille manquante | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-10 | Pas de début dans fenêtre connue | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-11 | Image et logo absents | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX01-12 | Variante Est/Ouest | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-13 | 320,360,390 px | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-14 | 768,1024,1440 px | P | Test partiel/model-level, recette E2E insuffisante |
| UX01-15 | Clavier et lecteur d'écran | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX01-16 | Avant GO public | T | tv-guide-embargo.pw.ts (404) |
| UX02-01 | Depuis Chaînes, cliquer à J+4 | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-02 | Depuis Ce soir J+3, ouvrir émission | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-03 | Depuis fiche émission, « Voir la grille » | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-04 | Retour navigateur après visite | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-05 | Chaîne nationale à deux variantes | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-06 | Chaîne à une seule variante | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-07 | Changer de variante | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-08 | Basculer CHANNEL -> VISITOR | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-09 | Émission traversant minuit | T | tv-import-time.test.ts (minuit) |
| UX02-10 | Journée DST 23 h ou 25 h | T | tv-import-time.test.ts (DST 23/25 h) |
| UX02-11 | Heure répétée au changement d'heure | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-12 | Absence totale EPG | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-13 | Lacune partielle | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-14 | Image absente ou non licenciée | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-15 | Absence d'URL officielle streaming | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-16 | URL streaming disponible | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-17 | Saisons/épisodes/synopsis absents | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-18 | Chaîne et pays inactifs | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-19 | Fiche émission supprimée de grille | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX02-20 | 320,390,768,1440 px | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-21 | 8 langues UI dont russe | P | Test partiel/model-level, recette E2E insuffisante |
| UX02-22 | Avant GO explicite | T | tv-guide-embargo.pw.ts (404) |
| UX03-01 | Rechercher `2` | T | tv-world-search-policy.test.ts (chiffres) |
| UX03-02 | Rechercher `12` | T | tv-world-search-policy.test.ts (exact) |
| UX03-03 | Rechercher `002` | T | tv-world-search-policy.test.ts (zéros) |
| UX03-04 | Rechercher `France 2` | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-05 | Saisie accents, casse, caractères internationaux | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-06 | Rechercher titre original/alternatif | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-07 | Changer le pays/filtre langue sur l'accueil | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-08 | Chaîne présente dans plusieurs pays | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-09 | Plusieurs variantes d'une chaîne | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-10 | Chaîne ou pays inactifs | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-11 | Cliquer un résultat chaîne | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-12 | Cliquer une émission | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-13 | Deux sections ont des résultats différents | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-14 | Erreur uniquement sur Programmes | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-15 | Échec de la page 2 | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-16 | Réponse réseau obsolète après nouvelle requête | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-17 | Mode heure visiteur à la veille/lendemain | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-18 | Résultat devenu indisponible après clic | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-19 | Requête vide | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-20 | Mobile 320/360/390 px | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-21 | Desktop 768/1024/1440 px | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-22 | Navigation clavier / lecteur d'écran | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-23 | Huit locales LMN24 | P | Test partiel/model-level, recette E2E insuffisante |
| UX03-24 | Aucune EPG / aucun départ connu | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX03-25 | Avant GO public | T | tv-guide-embargo.pw.ts, route.test.ts |
| UX03-26 | API annonce un total inconnu | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-01 | Un visiteur anonyme ouvre l'admin TV | T | tv-translation-admin.controller.test.ts (401) |
| UX04-02 | Un utilisateur sans rôle ADMIN appelle l'API admin TV | T | tv-translation-admin.controller.test.ts (403) |
| UX04-03 | Ouvrir l'admin TV | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-04 | Filtrer une liste puis ouvrir/fermer la fiche | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-05 | Pays actif → inactif → actif | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-06 | Import manuel sur un pays inactif | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-07 | Modifier timezone d'un pays | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-08 | Importer une chaîne inconnue | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-09 | Activer une chaîne | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-10 | Collision sur numéro d'un pays | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-11 | Correction manuelle d'un numéro puis nouvel import | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-12 | Recherche automatique des liens | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-13 | Une seule variante / plusieurs variantes | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-14 | Source EPG sans autorisation de republication | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-15 | Modifier la priorité des sources par pays | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-16 | Import global sur 1–7 jours | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-17 | Double clic sur Lancer | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-18 | Echec d'une source/pays | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-19 | Relancer seulement les erreurs | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-20 | Consulter journal import | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-21 | Changer manuellement fournisseur de traduction | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-22 | Réussites et échecs de langues simultanés | T | tv-translation-workflow.service.test.ts (PARTIAL) |
| UX04-23 | Reprendre langues manquantes | T | tv-translation-policy.test.ts (MANUAL) |
| UX04-24 | Aucun fournisseur conforme gratuit | T | tv-translation-workflow.service.test.ts (fournisseur absent) |
| UX04-25 | Modification concurrente de fiche | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-26 | Stats insuffisantes | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-27 | 320/390/768/1440 px | P | Test partiel/model-level, recette E2E insuffisante |
| UX04-28 | Navigation clavier / lecteur d'écran | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-29 | Écrans en huit langues si admin localisée | M | Non prouvé; recette manuelle, fonctionnalité manquante ou arbitrage ouvert |
| UX04-30 | Avant GO explicite du propriétaire | T | tv-guide-embargo.pw.ts (404) |

## Synthèse

- 94 scénarios : 16 tests ciblés, 38 partiels, 40 sans preuve suffisante.
- Playwright SCRUM-124 vérifie **l'embargo pré-GO**, pas l'UX des écrans TV ouverts.
- Lecteur d'écran réel, contraste, focus des modales, écrans actifs, licence et données EPG fictives nécessitent une recette distincte.
- D01, D04, D12, D15 sont toujours ouverts ; aucune publication ni migration de production.
- Preuves : apps/frontend/e2e/tv-guide-embargo.pw.ts ; apps/frontend/src/app/api/public/tv/[...path]/route.test.ts ; apps/backend/src/tv/ ; .github/workflows/ci.yml ; .github/workflows/tv-guide-isolated-validation.yml.
