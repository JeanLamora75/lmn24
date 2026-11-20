# LMN24 — Guide TV mondial — Murat / Winston — Contrôles de sécurité et de compatibilité

**Date :** 2026-11-20  
**Statut :** **PASS** pour les essais isolés effectivement réalisés. **NO GO** pour une migration officielle ou une exposition publique.  
**SHA exact testé :** `a11ca582c969620ce0d6e734221320a5dd6f6beb`  
**CI probante :** https://github.com/JeanLamora75/lmn24/actions/runs/44825073699  
**Workflow :** [tv-guide-isolated-validation.yml](../../.github/workflows/tv-guide-isolated-validation.yml)  
**Tests :** [concurrence](../../scripts/tv-guide-concurrency-isolated.cjs) et [sécurité](../../scripts/tv-guide-security-isolated.cjs).

## 1. Contexte et limites d'exécution

Tests réalisés sur PostgreSQL 17 en conteneur GitHub Actions jetable, utilisant le bootstrap public du dépôt `database/schema.sql`, quelques données de référence fictives et le prototype TV situé sous `docs/BMAD`. Les bases et rôles sont créés pour cette campagne seulement. Aucune connexion ou migration vers la production LMN24, aucun `prisma migrate deploy`, aucune modification des routes publiques.

Le schéma de production n'a pas été extrait ni comparé à cette base reconstruite. La compatibilité constatée concerne **le bootstrap de la branche main**, non toutes les installations et combinaisons historiques de migrations. Une copie anonymisée/isolée de l'état réellement déployé reste requise avant une migration officielle.

## 2. Résultats du workflow au SHA de preuve

| Étape | Résultat |
|---|---|
| Prisma validate + generate sur modèle assemblé de 19 tables TV | PASS |
| Création du prototype SQL puis second passage | PASS |
| Intégrité des FK, pointeur de révision, immutabilité, owner fencing | PASS |
| Bootstrap entier LMN24 du dépôt + fixtures non-TV | PASS |
| Application du prototype sur bootstrap entier | PASS |
| Comparaison des données métier initiales | PASS |
| C1-C5 : sessions parallèles, CAS, exclusion et reprise | PASS |
| SEC1 : rôles de test limités + current_user vérifié | PASS |
| SEC2 : pg_terminate_backend sur la session du propriétaire du verrou, puis relève | PASS |
| Dump avant migration (pg_dump -Fc) et restauration propre | PASS |
| Dump après migration, restauration propre, pointeur TV et tables vérifiés | PASS |

### SEC1 — moindre privilège

Les rôles temporaires `tv_reader_ci` et `tv_writer_ci` sont créés sans droits de superutilisateur. Le script vérifie la session effective `current_user` après authentification. Une requête SELECT autorisée passe. Les modifications du pointeur `tv_schedule_current` et de `parser_write_epoch`, et la lecture de `tv_translation_provider` par le compte de lecture sont rejetées (SQLSTATE 42501).

**Portée :** cela valide l'exemple de politique restrictive **du test**, pas les privilèges du compte applicatif réel. Le dépôt contient déjà `database/migrations/20261017_scheduler_application_grants.sql` qui autorise notamment `lmn24_app` à écrire sur `parser_write_epoch`. **Avant production :** inventorier les GRANT réels et définir un rôle d'import distinct du rôle d'API public afin qu'une API compromise ne puisse usurper un writer. Tester aussi un writer légitime non-superuser de bout en bout après fixation des GRANT.

### SEC2 — terminaison brutale de la connexion

La connexion qui détient l'advisory lock `(241024,85)` et le `owner_token` est terminée avec `pg_terminate_backend`. Le test attend/observe l'erreur client 57P01, acquiert le verrou avec une nouvelle session, renouvelle l'epoch et vérifie le rejet de l'ancien token (SQLSTATE P0001). Le pointeur vers la dernière révision validée reste intact après l'échec.

**Portée :** ce scénario démontre récupération d'un verrou après terminaison de session PostgreSQL. **Non couvert :** coupure TCP prolongée, séparation réseau, crash OS, interruption pendant transaction d'import active, long traitement annulé par AbortSignal. Prévoir ces scénarios plus tard dans la campagne d'intégration du véritable parser TV.

## 3. Compatibilité avec le système de migrations LMN24

Le dépôt possède **deux voies historiques** :
- `database/schema.sql` et migrations SQL `database/migrations/001…011` / extensions scheduler ;
- `packages/database/migrations` (Prisma), avec précautions explicites de baseline dans `packages/database/README.md`.

Certains scripts SQL, notamment `009_video_aggregation.sql`, sont décrits comme équivalents à une migration Prisma et **ne doivent pas être rejoués conjointement**. `006_category_home_display.sql` est prévu pour les bases anciennes. Le bootstrap actuel inclut déjà des évolutions récentes. Les exécuter en bloc sur une base bootstrap ne reconstitue **pas** fidèlement une base historique.

**Constats prouvés :** prototype TV additif sur `database/schema.sql` exécuté deux fois ; données de référence conservées ; sauvegardes et restauration vérifiées.

**Restent nécessaires avant migration** :
1. Identifier le chemin effectivement appliqué sur la base LMN24 de déploiement (historique `_prisma_migrations`, migrations SQL et extensions, version PostgreSQL, privilèges).
2. Tester le prototype futur sur une **copie isolée anonymisée du schéma et des données réelles**, sans accès en écriture à la production.
3. Construire la migration canonique SQL/Prisma et le bootstrap neuf compatibles ; interdire le double-apply d'équivalents.
4. Prouver un rollback sur cette copie réelle, y compris dépendances, indexes, trigger et rétention ; contrôler tous les objets métier, pas uniquement 4 fixtures.
5. Réaliser un audit de privilèges effectifs de l'API/parser et des fonctions de fencing.
6. Contrôler la mise en page/backoffice, les APIs et le gate de release côté serveur avant tout développement public.

## 4. Points de sécurité spécifiques à corriger avant exploitation

- **Séparation des rôles** : définir un rôle d'exécution de parser TV avec droits d'écriture limités et un rôle de lecture API ; n'accorder aucun contrôle sur `parser_write_epoch` au rôle HTTP public. Préciser le modèle de connexion actuel de LMN24 avant changement.
- **Function EXECUTE / search_path** : réviser les fonctions PostgreSQL sensibles, les droits PUBLIC, leur invocateur/définisseur et les objets qualifiés. Vérifier qu'aucun utilisateur sans autorisation ne peut publier par un chemin indirect.
- **Contrainte de licence EPG** : une valeur de droits APPROVED doit être vérifiée lors de la publication, en plus du modèle de données.
- **Embargo TV** : vérification serveur sur toute route publique, API, sitemap ; le booléen initial false ne suffit pas à protéger de futures routes si elles ne l'utilisent pas.
- **Sécurité des flux EPG** : défense SSRF, entités XML externes, bombes de décompression, tailles/temps maximaux.

## 5. Décision QA Murat

- **GO pour préparer la migration finale et compléter les tests : OUI.**
- **GO pour migrer la base réelle : NON**, faute d'inventaire et de répétition sur copie fidèle de production, d'audit des rôles effectifs et d'essais du véritable moteur TV.
- **GO pour ouvrir le Guide TV : NON**, autorisation du propriétaire toujours absente.

Cette validation ne prétend pas résoudre les risques de licences EPG ou d'exposition publique et ne garantit pas la sécurité de l'API TV encore non développée.
