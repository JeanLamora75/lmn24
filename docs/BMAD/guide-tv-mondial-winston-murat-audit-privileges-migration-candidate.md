# LMN24 — Guide TV mondial — Winston + Murat — Audit de privilèges et migration candidate

**Date :** 2026-11-20  
**Statut :** candidate **non déployable tant que la copie fidèle de production n'est pas contrôlée** ; PASS sur le laboratoire GitHub Actions.  
**Preuve GitHub Actions / SHA de référence :** https://github.com/JeanLamora75/lmn24/actions/runs/44825860065 — `15c97f7a9c98a12f436b3cd3a457f08f1e213153`.  
**Candidate SQL :** [guide-tv-mondial-winston-migration-candidate.sql](./guide-tv-mondial-winston-migration-candidate.sql) ; **audit SQL en lecture seule** : [guide-tv-mondial-winston-audit-privileges.sql](./guide-tv-mondial-winston-audit-privileges.sql).  
**Règle de sortie :** le Guide TV est interdit au public jusqu'au GO explicite du propriétaire LMN24. Le succès de cette CI ne constitue pas un GO.

## 1. Audit des privilèges — preuves et risques

### A. Constat statique sur le dépôt
- `apps/backend/src/database/database.service.ts` utilise la connexion `DATABASE_URL` fournie à Prisma ; le fichier ne distingue pas ici un rôle de lecture TV d'un rôle d'écriture EPG.
- `database/migrations/20261017_scheduler_application_grants.sql` accorde à `lmn24_app` `SELECT, INSERT, UPDATE, DELETE` sur `scheduler_config`, `scheduler_job` **et `parser_write_epoch`**, ainsi que `EXECUTE` sur `assert_parser_write_epoch(uuid)`.
- Le verrou `parser_write_epoch` est partagé avec le parser général. Retirer ses droits dans une migration Guide TV sans revue de l'existant pourrait dégrader la collecte RSS/vidéos/météo.
- Il faut inventorier les rôles et GRANT *réellement déployés* avant toute modification. Le dépôt ne garantit pas que le script ci-dessus a été appliqué à la production telle quelle.

### B. Vérifications en base isolée, et non sur la production
- Le workflow crée `tv_reader_ci` / `tv_writer_ci` non-superusers, vérifie `current_user`, les accès autorisés, les refus d'UPDATE/DELETE sur `tv_schedule_current`, d'UPDATE sur `parser_write_epoch` et de SELECT sur `tv_translation_provider`.
- L'audit `pg_roles / pg_class / pg_proc / ACL` s'exécute en **lecture seule**, avant et après la répétition.
- Le catalogue a révélé que les nouvelles fonctions TV recevaient initialement `EXECUTE` via PUBLIC, suivant le comportement par défaut de PostgreSQL. **Correction apportée au candidat** : REVOKE EXECUTE FROM PUBLIC sur les quatre nouvelles fonctions trigger, avec assertion dédiée CI réussie.
- `assert_parser_write_epoch(uuid)`, fonction historique, conserve `PUBLIC EXECUTE` dans la copie de test. Ne pas changer silencieusement un contrat du parser général ; prévoir une revue transversale des GRANT et du modèle d'appartenance des tokens.
- Les essais ne prouvent **pas** que `lmn24_app` en production est limité, ni qu'un véritable rôle parser d'exploitation ne peut être usurpé depuis une API. Ces deux points restent bloquants.

### C. Politique cible proposée (non déployée)
- **tv_public_reader** : SELECT strict sur des vues sécurisées et filtrées par les états pays/chaîne et droits des sources, aucune écriture, aucun accès aux secrets.
- **tv_admin_catalog** : opérations de catalogue autorisées par service admin authentifié ; pas de modification du bail parser.
- **tv_epg_writer** : écriture restreinte à tables TV, publication du pointeur uniquement avec token vérifié dans transaction, secret non accessible au frontend.
- Le modèle de **connexion(s)** devra permettre cette séparation. Si le backend et le parser utilisent aujourd'hui le même rôle DB, une évolution applicative et des credentials distincts sont nécessaires avant de réduire les GRANT.
- Interdire l'élévation des privilèges via GUC de session, rôle propriétaire de fonction, schéma public et search_path. Le token n'est pas une preuve suffisante si le rôle API peut écrire `parser_write_epoch` ou usurper le propriétaire de session.
- Exiger des tests `SET ROLE`, `current_user`, `has_*_privilege`, accès direct SQL et traitements end-to-end avant migration officielle.

## 2. Migration canonique non destructive — état

La candidate est dans **docs/BMAD**, et non dans `database/migrations` ou le dossier Prisma. Elle ne modifie donc aucune base tant qu'elle n'est pas explicitement reprise dans un processus de migration contrôlé.

Garanties documentées/testées :
1. `BEGIN/COMMIT`, verrou transactionnel dédié `pg_advisory_xact_lock(241024,192)`.
2. Préflight pour `public.country` et `assert_parser_write_epoch(uuid)`; refus d'un sous-ensemble TV partiellement présent (0 ou 19 tables attendues).
3. Création additive des 19 tables TV, contraintes et index, sans UPDATE/DELETE des tables métier LMN24.
4. Triggers de cohérence des grilles publiées et de protection transactionnelle par owner token.
5. `REVOKE EXECUTE FROM PUBLIC` sur les fonctions TV créées.
6. Postflight de présence des 19 tables, puis commit transactionnel.
7. Deuxième passage effectué dans PostgreSQL 17 isolé.

**Important** : `CREATE TABLE IF NOT EXISTS` ne certifie pas à lui seul qu'une table déjà existante possède la bonne structure. Un environnement avec exactement 19 tables TV mais un schéma divergent nécessite encore une détection explicite de *drift* par catalogue/empreintes. Cette vérification doit être ajoutée avant de déclarer la candidate officiellement idempotente sur une base arbitraire. Les sauvegardes et déploiements doivent être coordonnés avec les deux voies de migrations SQL/Prisma du dépôt.

## 3. Validation sur une copie représentative

Le workflow de preuve construit `tv_guide_rehearsal` avec **database/schema.sql** provenant de `main`, ajoute quelques lignes métier fictives, sauvegarde avant la candidate, applique le SQL puis le rejoue, teste concurrence et sécurité, sauvegarde après, et restaure les deux snapshots dans deux bases distinctes. Les empreintes des lignes initiales Pays, Langues, Catégories et Sources restent identiques.

| Vérification | Résultat sur SHA probant |
|---|---|
| Prisma validate et Prisma generate du schéma assemblé | PASS |
| Préflight de la candidate sur bootstrap LMN24 du dépôt | PASS |
| Candidate créée et réexécutée | PASS |
| Tests de contraintes et de révisions immuables | PASS |
| Concurrence multi-session, relève du verrou | PASS |
| Permissions des rôles de test + interruption du parser | PASS |
| Audit PostgreSQL des rôles/tableaux/fonctions | PASS |
| Interdiction PUBLIC EXECUTE des fonctions TV | PASS |
| Deux pg_dump, deux pg_restore et contrôle des données métier initiales | PASS |

**Limite déterminante** : cette copie est représentative du **schéma d'installation versionné** et de quelques données synthétiques, **pas** une copie de la base déployée et de ses migrations/GRANT réels. Aucune lecture ou écriture de production n'a eu lieu. Les résultats ne constituent pas une preuve de migration sur l'état effectif de production.

## 4. Prérequis avant le passage à une migration officielle

- [ ] Obtenir un **inventaire en lecture seule** de la base effectivement déployée : version PostgreSQL, `pg_dump --schema-only` ou équivalent sécurisé, extensions, rôles/GRANT, table `_prisma_migrations`, table de migrations historiques si présente.
- [ ] Reconstituer une **copie anonymisée / isolée fidèle** sans publier de données sensibles sur GitHub ; comparer objets non TV et index avant/après.
- [ ] Tester la candidate et son rollback sur **cette copie**, avec snapshot/restauration, isolation stricte et relevé des divergences.
- [ ] Définir la séparation des rôles backend/parser, préserver les autres parsers, supprimer les droits superflus après audit et tests bout en bout.
- [ ] Ajouter détection de drift détaillée même lorsque 19 tables TV sont présentes.
- [ ] Préparer et approuver la voie **unique** de migration officielle et le bootstrap neuf, ainsi que la synchronisation Prisma, sans double-apply SQL/Prisma.
- [ ] Ajouter validation des licences EPG, du gate côté serveur et des sitemaps avant toute exposition.

## 5. Décision Murat

**GO pour poursuivre l'ingénierie de migration et les tests sur copie fidèle : OUI.**  
**GO pour appliquer sur la base réelle : NON.**  
**GO pour afficher le Guide TV : NON, accord explicite du propriétaire requis.**

La campagne isolée verte ne remplace ni l'inventaire réel de la base ni un processus de déploiement contrôlé.
