# LMN24 — Guide TV mondial — Amelia + Winston + Murat — SCRUM-114

**Date :** 20 novembre 2026  
**Jira :** [SCRUM-114](https://lmn24.atlassian.net/browse/SCRUM-114)  
**Statut :** renforcement des contrôles sur `main`, **homologation de la migration toujours bloquée**. Ni migration de production, ni lecture de ses rôles/historique effectuées.  
**Garde-fou :** aucune publication TV publique sans GO explicite indépendant.

## 1. Livrables implémentés

1. **Migration candidate conservée exclusivement dans `docs/BMAD`** : [SQL candidate](./guide-tv-mondial-winston-migration-candidate.sql). Aucun fichier migratoire officiel n'a été créé sous `database/migrations` ou `packages/database/migrations`. Préflight auparavant limité au nombre 0/19 de tables : il refuse désormais un schéma TV déjà présent dont manque le nom d'une table attendue, l'une des **41 contraintes nommées** du candidat, un **trigger de publication/ownership** actif ou un type de colonne critique. Toutes ces vérifications précèdent `CREATE TABLE IF NOT EXISTS` et les remplacements de fonctions.
2. **Audit PostgreSQL lecture seule** : [inventaire catalogue](./guide-tv-mondial-winston-catalog-inventory.sql) : version du serveur, extensions, schémas, noms/rôles pertinents, types d'objets, inventaire des tables TV et présence du ledger Prisma, sans lire une ligne de données métier. Complète [l'audit des ACL](./guide-tv-mondial-winston-audit-privileges.sql). À utiliser uniquement sur **copie isolée explicitement autorisée** ; sa présence ne vaut pas permission de connexion production.
3. **Tests négatifs jetables** ajoutés au [workflow TV isolé](../../.github/workflows/tv-guide-isolated-validation.yml) : trois clones restaurés depuis une base de répétition, suppression d'une contrainte TV, élargissement du type d'une colonne critique, désactivation du trigger de contrôle de propriété. On attend une exception préflight claire et aucune mutation partielle de la candidate. Les tests positifs préexistants vérifient le bootstrap complet synthétique, 19 tables, replay, Prisma isolé, les privilèges, les écritures avec token, concurrence, deux dumps `pg_dump -Fc` et restores séparés.
4. Aucune mutation de `database/schema.sql`, de `packages/database/schema.prisma` ou des scripts SQL métier existants, pour éviter toute dérive prématurée avec le mécanisme d'installation.

## 2. Limites importantes

- **AC01** pas intégralement vérifié : absence d'autorisation et de connexion à l'instance PostgreSQL déployée. Le contenu réel de `_prisma_migrations`, des GRANT, extensions et versions de production demeure inconnu.
- **AC02** pas intégralement vérifié : la base du workflow provient de `database/schema.sql` + **fixtures synthétiques**, pas d'une **copie fidèle anonymisée** de l'instance de production. Une telle copie doit être fournie/validée dans un environnement isolé avant toute conclusion sur la compatibilité réelle.
- **AC03** renforcé mais **non exhaustif** : contrôle 19 tables, 41 contraintes nommées, 4 triggers et six types de colonnes critiques ; il ne compare pas encore l'intégralité des signatures de colonnes, règles, fonctions, indices, privilèges ou modèles Prisma. Une empreinte complète et une comparaison de drift sont nécessaires avant d'autoriser la migration réelle.
- **AC04** : les backups/restores isolés préexistants et comparaisons de fixtures prouvent la mécanique, pas un rollback représentatif de la base de production. Aucun effacement ni rollback destructif ne doit être tenté sur production.
- **AC05** : la voie canonique devra être choisie avec le responsable de déploiement, la candidate restant dans `docs/BMAD`. Les scripts SQL et migrations Prisma présentent des chevauchements historiques ; **ne jamais appliquer une migration deux fois** en empruntant les deux chemins. L'intégration au bootstrap des nouvelles installations n'est pas encore réalisée.
- **AC06** respecté : aucune application ni accès à la production autorisé ; le Guide TV reste non public.

## 3. Protocole proposé pour la phase de préproduction, **à approuver séparément**

1. Dans un contexte autorisé par le propriétaire et l'exploitant, établir inventaire schéma/ACL et historique des migrations **sans extraire les données métier dans le rapport**.
2. Préparer une copie anonymisée fidèle, déconnectée de toute ressource externe (jobs, e-mails, parsers automatiques et secrets).
3. Capturer avant-copie : version PG, extension, états et lignes par famille de tables, rôles, ACL, empreinte schema-only et dump complet avec restauration vérifiée.
4. Appliquer **une seule voie** canonique sur copie, comparer structure et empreintes de données métier préexistantes, exécuter tests SQL et scenarios en concurrence.
5. Restaurer indépendamment copie avant/après, vérifier la procédure de rollback en particulier la réversibilité sans toucher à la production.
6. Revoir les privilèges `lmn24_app` et `parser_write_epoch`, puis autoriser éventuellement une *migration officielle distincte*, uniquement après validation explicite.

## 4. Verdict conditionnel de Murat

**GO pour la qualification technique sur environnements jetables ; NO GO pour migration production, NO GO pour publication publique.**

Référence CI : workflow [TV isolated architecture validation](https://github.com/JeanLamora75/lmn24/actions/workflows/tv-guide-isolated-validation.yml). Pour déclarer un résultat « PASS » sur les nouveaux tests, il faut une exécution **complète et verte sur un SHA unique** ; une exécution en attente ou annulée ne suffit pas.  
