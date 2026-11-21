# LMN24 — Guide TV mondial — Amelia / Winston / Murat — SCRUM-116

**Date :** 21 novembre 2026  
**Jira :** [SCRUM-116](https://lmn24.atlassian.net/browse/SCRUM-116)  
**Statut :** développement backend et tests sur `main`, **recette de bout en bout et activation bloquées par SCRUM-114** ; droits réels des fournisseurs non homologués. Aucune migration PostgreSQL de production.

## 1. Réalisation

### Données : migration **candidate seulement**
Le schéma candidate (toujours dans `docs/BMAD`, hors migration officielle) et le fragment Prisma portent désormais, **pour chaque source**, les droits de republication séparés pour quatre familles :
- `programme_rights_status` et `programme_rights_reference` ;
- `synopsis_rights_status` et `synopsis_rights_reference` ;
- `image_rights_status` et `image_rights_reference` ;
- `logo_rights_status` et `logo_rights_reference`.

États : `UNREVIEWED / APPROVED / REJECTED / EXPIRED`, `UNREVIEWED` par défaut. Le champ global historique `rights_status` reste pour compatibilité mais **ne doit pas décider à lui seul de la republication**. L'autorisation effective est **APPROVED + référence justificative non vide**, **pour la famille concernée**, dans la couche métier ; les contrôles SQL limitent les valeurs autorisées.

La table d'association pays/source utilise désormais une contrainte `UNIQUE(country_id,priority)` en plus de l'unicité du couple source/pays. Les priorités sont modifiées par une transaction avec verrou du pays et refus des ensembles incomplets (pas de perte/suppression silencieuse de source). Le modèle conserve 19 tables TV.

### Domaine/backend
- `apps/backend/src/tv/tv-epg-source-policy.ts` : filtre de contenu publiable au niveau de chaque famille, provenance des droits obligatoire, ordre des sources par priorité et pays, interdiction de confirmer une correspondance EPG sans `channelId`, validation des URL des sources.
- `tv-epg-sources.service.ts` : liste des sources et dernier import, création source (3 formats XMLTV, XMLTV_GZIP et JSON), édition de sa configuration (nom, URL, format, statut) sans effacer les preuves de droits, mise à jour des droits, liste des mappings par source, priorités transactionnelles par pays, création de proposition `PENDING_REVIEW` sur identifiant externe exact, validation/rejet explicite du mapping. Toutes les requêtes sont liées à des paramètres SQL.
- `tv-epg-sources.controller.ts` : endpoints `/admin/tv/epg-sources`, contrôle **session + rôle ADMIN** sur chaque opération, contrôle additionnel `TV_CATALOG_ADMIN_ENABLED=true` (**non activé**) et exclusion de Swagger. Aucune route publique.
- `tv-catalog.module.ts` : intégration au module d'administration existant. Aucune interface frontend admin ajoutée : elle dépend de SCRUM-122.

### Sécurité de téléchargement — préparation SCRUM-117
- `tv-epg-download.ts` : téléchargement borné (12 Mio compressé, 48 Mio décompressé, 15 s), DNS résolu et IP publique IPv4 **épinglée sur la socket** pour empêcher le rebinding entre contrôle et connexion, refus des IP littérales, IPv6 non admis, hôtes internes, credentials et ports non standards, **aucune redirection suivie**, refus des réponses compressées HTTP inattendues, décompression GZIP en flux bornée, JSON parse préliminaire et rejet des `DOCTYPE` / `ENTITY` XML.
- Ce code n'est **pas appelé** depuis une route HTTP ni depuis un scheduler. C'est une première défense à tester en réseau isolé avant activation ; le parseur XMLTV final doit également désactiver DTD/résolution d'entités (SCRUM-117). Jamais d'écriture de secrets/URL credentialisées dans les logs.

### Éligibilité éditoriale
La qualification **chaînes nationales gratuites hertziennes** dépend du contrôle des sources, des fiches nationales et de la vérification manuelle des preuves ; aucun fournisseur n'a été déclaré juridiquement admissible par cette story. Le fait de pouvoir importer techniquement une source ne confère aucun droit de republier textes, images ou logos.

## 2. Vérifications

- Vitest `tv-epg-source-policy.test.ts` : droits autonomes, preuve manquante, filtrage par famille, priorité, identité externe vérifiée, URL/SSRF.
- Vitest `tv-epg-sources.controller.test.ts` : 401 sans session, 403 éditeur, 503 drapeau désactivé, 400 justificatif absent / mapping auto-vérifié ; ADMIN valide.
- SQL jetable `docs/BMAD/guide-tv-mondial-scrum116-epg-sources-isolated-smoke.sql` : droits indépendants et CHECK SQL, priorités uniques, mapping externe PENDING_REVIEW puis vérification seulement avec cible. Transaction de test avec `ROLLBACK`.
- Workflow [Validation TV PostgreSQL isolée](https://github.com/JeanLamora75/lmn24/actions/workflows/tv-guide-isolated-validation.yml) ; **ne citer comme PASS que les runs terminés avec succès**, sur SHA exact.
- CI générale [LMN24 CI](https://github.com/JeanLamora75/lmn24/actions/workflows/ci.yml) : contrôles typecheck, lint, tests, build et suites existantes sur SHA unique requis pour clôture.

## 3. Points restant ouverts avant DoD

1. **SCRUM-114** : schéma TV candidat non installé sur DB réelle, pas de copie fidèle qualifiée, rôles/privileges et rollback pas homologués. Ne pas lancer de migration de prod.
2. **SCRUM-122** : pages/admin sources EPG, modale création/édition, preuves juridiques, priorités et écran de rapprochement non branchés.
3. **SCRUM-117** : parsing XMLTV/JSON complet, tests d'intégration HTTP réseau jetable, protection de décompression et XML sous parseur réel, imports techniques puis contrôle de publication par champ. Aucun service EPG réel ne doit être contacté sans autorisation et revue de licence.
4. **D12 / Mary** : preuves de droits séparées par pays et contenu à vérifier. Une source « APPROVED » dans un fixture ne constitue pas un droit légal réel.
5. **Traitement des erreurs des SQL dynamiques** : tester les codes Prisma de collisions de priorité et mapping sur une base réellement migrée, puis convertir en réponses métier HTTP 409. Les fixtures SQL vérifient les contraintes, pas encore toute la surface HTTP réelle.
6. **Revue Murat** : exécuter les checks CI sur un même SHA, tests sécurité/fuzz des sources (DNS privées, ZIP/GZIP bomb, entity expansion), et audits de non-régression.

**Conclusion :** implémentation backend et modèle candidats livrés, interface et activation non réalisées. **Aucun GO de publication publique ni de migration réelle n'a été donné.**
