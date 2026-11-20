# LMN24 — Guide TV mondial — Winston / Murat — Résultats de validation isolée

**Date :** 2026-11-20  
**Statut :** **PASS** sur la campagne isolée limitée ci-dessous ; **PAS DE GO** pour appliquer une migration officielle ni pour rendre le Guide TV public.  
**Exécution probante :** https://github.com/JeanLamora75/lmn24/actions/runs/44823374962  
**SHA exact testé :** `36227a575a1acd4b0947e90659ee1c86942ce83a`  
**Workflow :** [TV Guide isolated architecture validation](../../.github/workflows/tv-guide-isolated-validation.yml)

## 1. Environnement de test
GitHub Actions Ubuntu, Node 24.21.0, pnpm 12.10.0, Prisma CLI 7.10.0, PostgreSQL 17 (conteneur service jetable). Aucune connexion vers la base LMN24, aucune table de production créée ou modifiée. Le référentiel `country` a été réduit à un stub `(id UUID PRIMARY KEY)` dans une base éphémère ; la preuve n'est donc pas une répétition de migration sur copie complète de la production.

## 2. Résultats réels

| Étape | Résultat | Preuve |
|---|---|---|
| Assemblage du vrai schéma Prisma existant avec 19 modèles TV | PASS | Workflow, fichier temporaire `.tv-guide-isolated.prisma` créé uniquement dans runner |
| `prisma validate` (schéma complet) | PASS | Étape `Prisma validate isolated complete schema` |
| `prisma generate` | PASS | Étape `Prisma generate in isolated workspace` |
| Baseline de test et fonction de fencing existante | PASS | Étape disposable baseline |
| Application du SQL prototype (documentation) à PostgreSQL 17 | PASS | Étape create isolated TV schema |
| Second passage du SQL de prototype | PASS | Étape replay; ne remplace pas test migration sur base historique |
| Contraintes / immutabilité / refus stale-owner | PASS | Étape smoke SQL en transaction ROLLBACK |

## 3. Corrections prouvées par les premières exécutions rouges
- **Prisma P1012** : la relation composite `TvScheduleCurrent -> TvScheduleRevision` exige une unicité explicite sur les champs de relation ; `@@unique([revisionId,variantId,localDate])` et SQL `UNIQUE` correspondante ajoutés. La validation Prisma complète a ensuite passé.
- **Fixture SQL incorrecte** : première campagne créait une révision déjà PUBLISHED avant d'y insérer un programme. Le refus était **normal**, le test a été corrigé pour remplir la grille d'abord, publier ensuite. La suite SQL est ensuite passée.
- **Fencing** : un trigger sur `tv_schedule_current` vérifie le jeton `app.tv_writer_owner` dans la même transaction et appelle la fonction existante `assert_parser_write_epoch`; le test simule un token caduc et confirme son refus. Cela ne teste pas encore une panne réseau ni deux sessions concurrentes.
- **Immutabilité** : triggers protègent le statut de révision publiée et interdisent les écritures (INSERT/UPDATE/DELETE) d'une diffusion dans une révision déjà publiée.
- **Intégrité relationnelle** : FK composites pour variante/pays et alias/chaîne, complétées par checks et indexes.

## 4. Couverture et limites — avis Murat

**Levés dans le périmètre de la campagne :** QA-TV-06 (validation Prisma), QA-TV-07 (création, second passage SQL et assertions), QA-TV-05 **partiellement** (preuve de rejet du token obsolète dans une seule session transactionnelle).

**Toujours bloquants pour une migration officielle** :
1. Test réel de concurrence entre **deux connexions PostgreSQL**, perte de bail, reprise et absence de changement du pointeur sous ancien propriétaire.
2. Vérification des privilèges de comptes SQL (le compte d'administration/test superuser ne démontre pas le principe de moindre privilège).
3. Test de migration additive sur une copie anonyme représentative de la vraie base existante, schéma bootstrap neuf, inventaire/baseline et restauration.
4. Validation métier des index et qualité EPG, suivi des sources autorisées et suivi des modifications SQL au fil des itérations.
5. Contrôle de sécurité de l'API publique et du gate côté backend/frontend avant toute mise en ligne (actuellement pas de routes Guide TV publiées).
6. Test de performance et volumétrie EPG réelle seulement après autorisation des recherches externes et qualification des licences.
7. Examen fonctionnel/UX Sally et critères finaux Murat avant Epic/US définitifs.

## 5. Verdict QA

- **GO pour poursuivre les essais isolés et compléter le modèle : OUI.**
- **GO pour migration de la base LMN24 : NON.**
- **GO pour Guide TV visible au public : NON, uniquement après GO explicite du propriétaire.**

Les tests passent dans une base PostgreSQL 17 jetable. **Aucune migration officielle exécutée** et aucune donnée EPG externe récupérée. Les fichiers SQL restent exclusivement dans `docs/BMAD` jusqu'à revue et autorisation.
