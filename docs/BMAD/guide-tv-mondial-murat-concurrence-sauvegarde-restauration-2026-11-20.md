# LMN24 — Guide TV mondial — Murat / Winston — Validation concurrence et répétition de migration

**Date :** 2026-11-20  
**Statut :** **PASS** de la campagne ciblée isolée ; **pas de GO migration officielle ni publication publique**.  
**SHA testé :** `13b0a65e1d1d0493154c4593f80277547495fc7a`  
**CI probante :** https://github.com/JeanLamora75/lmn24/actions/runs/44824290864  
**Workflow :** [.github/workflows/tv-guide-isolated-validation.yml](../../.github/workflows/tv-guide-isolated-validation.yml)  
**Script de concurrence :** [scripts/tv-guide-concurrency-isolated.cjs](../../scripts/tv-guide-concurrency-isolated.cjs)

## Environnement et nature exacte des données

- GitHub Actions, runner Ubuntu, PostgreSQL 17 éphémère (conteneur), Node 24, pnpm 12, Prisma 7.
- Deux bases indépendantes sur la même instance jetable : une base minimale pour les tests SQL historiques, et `tv_guide_rehearsal` initialisée avec **database/schema.sql** (schéma complet du bootstrap historique LMN24 du dépôt) et quelques **données métier fictives**, puis tables TV additionnelles. Ces données **ne proviennent pas de la production**.
- Pas d'accès au PostgreSQL réel, pas de déploiement, pas de migration officielle. Le prototype demeure dans `docs/BMAD`, hors répertoire des migrations applicatives.
- Sauvegardes `pg_dump -Fc` **avant** et **après** la simulation ; vérification par `pg_restore -l`, empreintes SHA-256 imprimées dans les logs GitHub ; restauration dans les bases neuves `tv_guide_pre_restore` et `tv_guide_post_restore`. Les fichiers des sauvegardes ne sont pas conservés comme artefacts persistants de la CI.

## Résultats constatés dans les étapes GitHub Actions

| Vérification | Résultat |
|---|---|
| Assemblage et validation du schéma Prisma incluant 19 modèles TV | **PASS** |
| Génération Prisma isolée | **PASS** |
| Installation et deuxième passage du prototype SQL sur la base minimale | **PASS** |
| Contrôles FK, immutabilité PUBLISHED et owner-token obsolète | **PASS** |
| Bootstrap intégral issu de `database/schema.sql` | **PASS** |
| Migration TV additive et répétition sur le bootstrap intégral | **PASS** |
| Sauvegarde pré-migration contrôlée | **PASS** |
| Scénarios de concurrence entre plusieurs connexions PostgreSQL | **PASS (5 scénarios)** |
| Sauvegarde post-migration contrôlée | **PASS** |
| Restauration de la sauvegarde pré-migration | **PASS** |
| Restauration de la sauvegarde post-migration (19 tables TV et pointeur courant) | **PASS** |
| Comparaison des empreintes des **lignes métier initiales** (pays, langues, catégories, sources) | **PASS** |

### Détails du contrôle de concurrence

1. **C1 — Exclusivité** : la connexion B ne peut acquérir le verrou `(241024,85)` détenu par A.
2. **C2 — Publication autorisée** : un writer avec le token valide `ownerA` et une révision PUBLISHED crée le pointeur courant.
3. **C3 — Deux écritures simultanées** : la première transaction met à jour la révision ; la deuxième attend le verrou de ligne, puis retourne `rowCount=0` grâce à la condition de comparaison avec l'ancienne révision (*compare-and-swap*). Elle ne peut réécrire une valeur obsolète.
4. **C4 — Mauvais token et token absent** : les triggers SQL refusent les deux opérations.
5. **C5 — Relève du propriétaire** : le verrou A est libéré, B l'obtient et renouvelle `parser_write_epoch`; A est alors rejeté, B peut publier une révision autorisée.

Ces contrôles utilisent **des connexions PostgreSQL séparées**, pas uniquement une simulation des états.

### Détails de sauvegarde/restauration

- Une base existante factice est créée depuis `database/schema.sql`, avec les lignes fictives `baseline-britain`, `fr`, `baseline` et `baseline-news`.
- Les modifications EPG sont ajoutées sans mise à jour/suppression de ces lignes métier de référence.
- La restauration pré-migration confirme l'**absence** de tables TV et la présence des données initiales.
- La restauration post-migration confirme les **19 tables TV**, le pointeur courant de programmation et les données de référence.
- Le contrôle final compare les **hashs des lignes métier initiales** au lieu des comptes globaux : les tests de concurrence ajoutent volontairement de nouvelles fixtures TV après la sauvegarde initiale, ce qui augmente légitimement le nombre total de pays.

## Défauts corrigés pendant la campagne

- Le premier script CI utilisait des marqueurs GitHub Actions incorrectement échappés : corrigé.
- La première comparaison d'égalité comparait les comptes globaux avant/après alors que le test ajoutait un pays fictif ; corrigé par comparaison d'empreintes des **données préexistantes**.
- Les anomalies Prisma et SQL des campagnes précédentes restent corrigées ; tests de validation et de rejouabilité réussis sur le SHA cité.

## Risques toujours ouverts — pas de feu vert à la migration officielle

1. **Représentativité limitée** : schéma d'installation historique et quelques lignes fictives, **pas** une copie anonymisée d'une base réelle et de son histoire migratoire. Il faudra examiner la structure déployée et son baseline de migration sur copie isolée.
2. **Pannes réseau / crash du parser** : le test prouve l'exclusion, la relève et le rejet de l'ancien owner mais ne provoque pas de partition TCP brutale ni de kill du processus pendant une transaction en cours.
3. **Modèle d'autorisations** : les essais utilisent le compte PostgreSQL privilégié de test ; vérifier les rôles backend/parser réels, leurs GRANT et l'impossibilité de contourner les triggers/procédures.
4. **Intégration ORM** : Prisma valide/génère mais un `prisma migrate` officiel et l'intégration dans le vrai `schema.prisma` n'ont pas été effectués.
5. **Sauvegardes** : restauration logique de snapshots réussie ; pas de simulation de bascule d'exploitation, PITR/WAL, ni de sauvegarde/retour arrière d'une instance de production.
6. **Données EPG et droits** : aucun import sur données fournisseur réelles, pas de dimensionnement ni de validation de licence.
7. **Embargo public** : le Guide TV n'a toujours pas de routes publiques ; le gate devra être branché serveur Next.js/NestJS et aux sitemaps avant développement visible.

## Avis Murat

- **GO pour poursuivre la conception et les essais isolés : OUI.**
- **Les blocages de concurrence de base et de restauration du prototype sont levés dans le périmètre testé.**
- **GO pour migration sur une vraie base LMN24 : NON**, tant que les risques 1, 2, 3, 4 ne sont pas instruits.
- **GO pour affichage du Guide TV : NON** — le propriétaire doit toujours donner un accord explicite et séparé.

Ce document consigne des preuves de CI réelle et les limites exactes de leur portée ; il ne certifie pas la production.
