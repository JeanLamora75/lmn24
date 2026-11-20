# LMN24 — Guide TV mondial — Amelia + Winston + Murat — SCRUM-115

**Date :** 21 novembre 2026  
**Jira :** [SCRUM-115](https://lmn24.atlassian.net/browse/SCRUM-115).  
**Statut :** implémentation du domaine et des APIs admin sur `main`, **mise en service bloquée** par SCRUM-114 et validation des droits/CI. Pas de migration de production ni d'ouverture publique.

## 1. Implémentation

- **Règles domaine** : `apps/backend/src/tv/tv-catalog-policy.ts` et tests, sélection du pays (préférence -> locale -> ISO2), priorité des numéros `MANUAL > OFFICIAL > ASSIGNED`, allocation au plus petit numéro libre, détection de collision, découverte inactive/review, variante par pays, contrôle du fuseau IANA et URLs officielles optionnelles.
- **Schéma SQL CANDIDAT** : `docs/BMAD/guide-tv-mondial-winston-migration-candidate.sql` et prototype documentaire. Ajout de `tv_channel_country.default_variant_id` avec contrainte FK composite `(default_variant_id,id) -> tv_variant_country(variant_id,channel_country_id)`. Impossible de choisir une variante qui n'est pas disponible dans le pays ou qui appartient à une autre chaîne.
- **Prisma FRAGMENT** (pas le schéma canonique) : `docs/BMAD/guide-tv-mondial-winston-prisma-proposition.prisma`, champ `defaultVariantId` et note sur la contrainte composite SQL.
- **Backend admin** : `tv-catalog.module.ts`, `tv-catalog.controller.ts` et `tv-catalog.service.ts` dans `apps/backend/src/tv`. Opérations : liste/configuration de pays, liste d'associations chaîne/pays, découverte d'une chaîne inactive nécessitant revue, édition explicite de l'association/n°/variante, allocation numérique transactionnelle, profil officiel, langues de diffusion, ajout d'une variante et affectation à un pays.
- **Protection forte** : session serveur + rôle exact `ADMIN`, `TV_CATALOG_ADMIN_ENABLED=true` explicitement nécessaire **en plus** du contrôle de présence des tables. Désactivé par défaut : aucune nouvelle opération catalogue admin ne doit fonctionner sur la production actuelle. Contrôleurs exclus de Swagger. La gate publique Next/Nest de SCRUM-113 est inchangée.
- Aucune nouvelle page frontend, route publique, job automatique, sitemaps ni schéma PostgreSQL réel n'a été installé.

## 2. Tests

- Tests Vitest `tv-catalog-policy.test.ts` : fallback ISO, corrections manuelles, numéros occupés, pays désactivé, nouvelles chaînes inactives, variantes Est/Ouest, IANA, URLs.
- Tests Vitest `tv-catalog.controller.test.ts` : anonymes 401, éditeurs 403, admin sans flag 503, payloads malformés 400 et admin autorisé.
- Test SQL jetable `docs/BMAD/guide-tv-mondial-scrum115-catalog-isolated-smoke.sql` (transaction `BEGIN/ROLLBACK`) : deux pays, deux chaînes, trois variantes, FK D10 inter-pays et inter-chaînes, numéro manuel dominant même après changement du numéro officiel, collision bloquée dans le même pays, pays désactivé sans perte de l'association, nouvelle association inactive/needs_review.
- Intégré dans `.github/workflows/tv-guide-isolated-validation.yml`, sur PG17 synthétique **non représentatif de la base réelle**.

## 3. Limites et revue de risque

- **SCRUM-114 demeure bloquante** : tables TV toujours **non déployées** sur la vraie base, accès au catalogue TV refusé par défaut ; la répétition de migration sur copie fidèle reste obligatoire avant intégration canonique au bootstrap et au vrai schéma Prisma.
- Les endpoints admin JSON ont une protection par session et rôle, mais leur **recette HTTP sur environnement réel utilisant le schéma TV** est encore nécessaire. Aucune page UX d'admin n'a été branchée ; la création des interfaces dépend aussi de SCRUM-122.
- Le flag `TV_CATALOG_ADMIN_ENABLED` est une protection d'exploitation additionnelle : il **ne doit pas être activé en production** tant que la migration et les droits DB ne sont pas qualifiés, et son activation ne publie jamais les routes publiques.
- Les URL officielles sont validées pour stockage/affichage ; leur utilisation ultérieure pour **fetch serveur** exige en plus un contrôle SSRF complet et indépendant (SCRUM-116).
- La table SQL candidate a encore un champ `tv_channel_variant.is_default` hérité de la conception initiale. **Il n'est plus la source de vérité** : seul `tv_channel_country.default_variant_id` donne la variante par défaut selon D10. Son nettoyage et la mise en cohérence Prisma/schémas doivent être intégrés à SCRUM-114 avant migration officielle.
- Le modèle national actuel utilise des nombres int32 **strictement positifs**. L'arbitrage D07 sur les recherches du numéro `0` reste théorique : aucun numéro TV officiel 0 n'est représentable par le schéma actuel ; aligner précisément D07/D10 avant mise en production s'il existe un pays qui l'exige.
- La mise en pause des imports automatiques pour pays inactif relève de SCRUM-117 (scheduler et ingestion), pas de ces endpoints catalogue ; aucun job n'est activé par SCRUM-115.
- Gestion des collisions concurrentes par index d'expression PostgreSQL et verrou transactionnel global pour allocation automatique. Le retour d'erreur sur certaines violations de contrainte doit être vérifié avec les codes Prisma natifs sur véritable fixture d'API.
- Les vrais contenus de chaînes, logos, descriptions et liens sont facultatifs ; ne rien inventer et ne jamais publier un contenu sans droits.

## 4. Critères de fin et suite

**Partie domaine/API implémentée ; SCRUM-115 doit rester ouverte** jusqu'à validation de la CI sur un SHA unique, recette HTTP/admin, intégration du schéma canonique et vérification des exigences d'activation/import automatique avec SCRUM-117. Éviter de présenter les tests isolés comme homologation de production.

**Aucune connexion/écriture dans la production et aucun GO public n'ont eu lieu.**
