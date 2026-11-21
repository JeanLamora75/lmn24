# LMN24 — Guide TV mondial — Winston — Modèle physique et migrations v0.3

**Date :** 2026-11-20  
**Statut :** étude d'architecture, **aucun SQL exécuté, aucune modification de schéma appliquée**.  
**Prérequis :** [cadrage Mary](./guide-tv-mondial-mary-cadrage-fonctionnel.md), [architecture Winston v0.2](./guide-tv-mondial-winston-architecture-detaillee.md).  
**Règle impérative :** Guide TV public **interdit jusqu'au GO explicite du propriétaire LMN24**.

## 1. Constats vérifiés dans le code

- `Country.id` est un UUID ; `Country.isActive` sert au catalogue éditorial. La TV aura sa propre activation `tv_country.is_active`, **indépendante**.
- `Language.isoCode2` est en `CHAR(2)` : les huit langues actuelles sont supportables mais les variantes BCP 47 ne doivent pas être artificiellement écrasées ; prévoir une colonne de langue TV normalisée si nécessaire, sans changer le modèle existant.
- `Source`, `Feed` et `Article` concernent les actualités : aucune FK chaîne TV vers article/source actualité.
- Le parser existant utilise `PARSER_INTERNAL_URL` et `PARSER_SHARED_SECRET`, possède une gestion d'exécution, une journalisation et un bail global d'exclusion.
- `database/migrations/011_weather_data_model.sql` montre le patron SQL transactionnel, additif, `CREATE TABLE IF NOT EXISTS`, contraintes `CHECK`, indexes partiels et smoke tests dans `database/tests/`.
- `packages/database/README.md` avertit que les bases historiques ne sont pas nécessairement baselinées Prisma ; **ne pas lancer aveuglément `prisma migrate deploy` sur une base existante**.
- `database/migrations/20261017_parser_write_fence.sql` protège les écritures du parser via un *owner token* et verrou transactionnel. L'import TV devra réutiliser l'invariant de fencing, sans le contourner.
- Le scheduler actuel limite son énumération aux catégories existantes ; l'ajout d'un job TV quotidien exige une évolution coordonnée des validations, configs, exécuteurs et tests, désactivée par défaut.

## 2. Modèle logique corrigé pour éviter les anomalies

Deux choix du modèle v0.2 sont affinés :

1. **Identité et numérotation d'une chaîne** : le numéro et l'activation sont propres au **pays de diffusion**, non à la chaîne mondiale ; seule `tv_channel_country` porte ces paramètres. Le numéro manuel et celui issu de la source sont séparés afin de conserver le choix administrateur.
2. **Version des grilles** : pas de diffusion publiquement visible sans `tv_schedule_revision` publiée. Les versions sont immuables : on ne doit pas réutiliser une diffusion en la modifiant en place dans une ancienne révision. L'index courant pointe sur la dernière révision validée de chaque variante et journée.

### Entités et contraintes cibles

| Table | Identifiant et principales colonnes | Unicité et règles |
|---|---|---|
| `tv_country` | `country_id` FK `country.id`, `is_active`, `reference_timezone` | `country_id` PK ; IANA validé dans le service et à l'installation |
| `tv_channel` | `id` UUID, `slug`, `name`, `logo_url`, `website_url`, réseaux, `live_url`, `created_at` | `slug` unique ; ne pas désactiver globalement un canal multi-pays par erreur |
| `tv_channel_country` | `id`, `channel_id`, `country_id`, `is_active`, `official_number`, `manual_number`, `assigned_number`, `needs_review` | unique `(country_id,channel_id)` ; numéro effectif dérivé et **unique par pays** |
| `tv_channel_language` | `channel_id`, `language_code` | PK composite |
| `tv_channel_variant` | `id`, `channel_id`, `code`, `timezone`, `is_default` | unique `(channel_id,code)`, au plus un défaut par chaîne |
| `tv_source` | `id`, `name`, `url`, `format`, `is_active`, `rights_status`, `rights_reference` | seules sources explicitement autorisées peuvent contribuer au public |
| `tv_source_country` | `source_id`, `country_id`, `priority`, `is_active` | PK composite ; unicité des priorités si l'UX la garantit |
| `tv_channel_external_id` | `source_id`, `external_id`, `channel_id`, `variant_id`, `mapping_status` | unique `(source_id,external_id)` ; association ambiguë suspendue |
| `tv_channel_description` | `channel_id`, `language`, `text`, `origin`, `reviewed_at` | unique `(channel_id,language)` ; MANUAL protégé |
| `tv_programme` | `id`, `title`, `description`, `category`, `image_url`, `season`, `episode` | champs descriptifs optionnels ; aucune normalisation par titre seul |
| `tv_schedule_revision` | `id`, `variant_id`, `local_date`, `run_id`, `status`, `published_at` | révision immuable après publication |
| `tv_airing` | `id`, `revision_id`, `programme_id`, `starts_at`, `ends_at`, `source_id`, `fingerprint` | `starts_at < ends_at`; unicité `(revision_id,fingerprint)` |
| `tv_schedule_current` | `variant_id`, `local_date`, `revision_id` | PK `(variant_id,local_date)` ; une seule révision courante |
| `tv_import_run` | `id`, `trigger`, `requested_days`, `status`, `started_at`, `finished_at` | garde-fou jour 1..7, statut borné |
| `tv_import_scope` | `id`, `run_id`, `country_id`, `source_id`, `status`, compteurs | reprise ciblée |
| `tv_import_event` | `id`, `run_id`, `scope_id`, `timestamp`, `level`, `message` | rétention 30 jours |
| `tv_translation_provider` | `id`, `provider_type`, `endpoint`, `credential_ref`, `is_active`, `is_selected`, `approved_free_at` | au plus un `is_selected=TRUE` ; fournisseur non validé inéligible |
| `tv_translation_attempt` | `id`, `channel_id`, `provider_id`, `language`, `status`, `occurred_at` | journal minimal ; **pas** de quotas |

### Cas à traiter explicitement
- La même chaîne dans deux pays a deux entrées `tv_channel_country`, donc **deux numéros potentiellement différents**.
- La relation `tv_channel_variant` doit intégrer le périmètre pays si une variante n'est diffusée que dans certains pays : préférer une table `tv_variant_country` si les premières données réelles le justifient.
- Numéro effectif : `COALESCE(manual_number,official_number,assigned_number)`. Une simple unicité de ces trois colonnes séparées est **insuffisante**. Définir index unique d'expression `(country_id, COALESCE(...))` et verrou d'attribution par pays. Toute collision officielle doit être soumise à validation ou donner lieu à un numéro attribué alternatif sans écrasement du choix manuel.
- Les dates et la zone horaire de la variante s'appliquent aux diffusions ; la date sélectionnée de l'accueil appartient au fuseau de référence du pays. Le calcul des jours traversant minuit doit suivre une règle testée, sans double comptage.
- `tv_schedule_current` doit référencer une révision de **la même variante et de la même date** ; utiliser contrainte composite ou trigger SQL, pas seulement une FK sur ID.
- Ne pas publier une chaîne tant que son pays est inactif et/ou tant que la chaîne est désactivée, même si elle possède des programmes.
- Une source au statut des droits non approuvé n'alimente pas les endpoints publics ; les données importées restent en quarantaine ou en back-office.

## 3. Patrons de contraintes SQL (exemples de conception, non déployables tels quels)

```sql
-- Illustrations à intégrer dans une migration complète après revue des tables.
CREATE UNIQUE INDEX uq_tv_effective_number_per_country
  ON tv_channel_country(country_id,
    COALESCE(manual_number, official_number, assigned_number));

CREATE UNIQUE INDEX uq_tv_one_default_variant
  ON tv_channel_variant(channel_id)
  WHERE is_default = TRUE;

CREATE UNIQUE INDEX uq_tv_one_selected_translation_provider
  ON tv_translation_provider(is_selected)
  WHERE is_selected = TRUE;

ALTER TABLE tv_airing
  ADD CONSTRAINT tv_airing_positive_span CHECK (ends_at > starts_at);
```

**Attention :** l'index sur le numéro effectif n'impose pas l'unicité des NULL ; la migration doit ajouter `CHECK (COALESCE(...) IS NOT NULL)` avant activation d'une chaîne publiée. Les numéros historiques non entiers positifs / règles officielles particulières sont à évaluer avant fixation du type SQL.

## 4. Invariants transactionnels du changement de grille

- Les candidats importés et les versions de préparation ne sont jamais retournés par la lecture publique.
- Un worker qui perd son bail ne peut ni modifier ni publier une révision : vérifier le `ownerToken` dans la **même transaction** PostgreSQL que le pointeur `tv_schedule_current`, avec la protection existante `assert_parser_write_epoch` (si son contrat convient au module).
- Identifier le périmètre `(variant_id,local_date)` et verrouiller ce périmètre pendant le basculement, pour éviter les écrasements entre import manuel et automatique.
- Valider la révision (absence d'overlaps illégitimes, intervalles valides, provenance source, droit de diffusion), écrire la révision immuable, puis changer le pointeur courant atomiquement.
- En cas d'échec, ROLLBACK ; le pointeur courant conserve la révision précédente ; le scope run passe à ERROR ou PARTIAL avec motif.
- Si les nouvelles données valides sont moins complètes, une politique de qualité doit décider si elles remplacent l'ancien : cette politique fait encore l'objet d'une revue métier ; ne jamais remplacer silencieusement par une grille vide.
- Gestion des imports successifs : les suppressions ou décalages réels doivent être pris en compte, **sans préserver indéfiniment une émission annulée**. Le calcul diff/ancien est nécessaire.
- La rétention après J-7 doit supprimer les anciennes révisions/diffusions par lots, sans suppression en cascade de chaîne ni des corrections manuelles.

## 5. Plan des migrations sans toucher à la production

1. **Inventaire préalable** : schéma effectivement installé en préproduction / production, table `_prisma_migrations`, scripts SQL historiques appliqués, extensions (`pg_trgm` à valider).
2. **Sauvegarde** : export vérifié, restauration testée sur cluster isolé, horodatage et empreinte de l'état initial.
3. **Migration additive** : nouveau script SQL versionné sous `database/migrations/`, transaction `BEGIN/COMMIT`, création des entités TV et indexes, zéro UPDATE/DELETE des tables métier existantes.
4. **Prisma** : mise à jour `packages/database/schema.prisma` et génération du client sur la même révision ; si base historique non baselinée, appliquer **le chemin SQL contrôlé**, sans double exécution de la migration équivalente Prisma.
5. **Bootstrap installation neuve** : ajouter l'équivalent aux scripts d'initialisation des bases nouvelles, pour éviter deux schémas divergents.
6. **Contrôles** : `database/tests/tv_guide_schema_smoke.sql` en transaction avec `ROLLBACK` : FK, numéros pays, activation, variantes, contrôle horaires, une seule révision courante, sélection unique fournisseur, refus de changement après perte de bail.
7. **Rehearsal** : deux essais sur la base isolée, avec données de test ; comparer les inventaires des tables LMN24 non TV avant/après, puis valider une procédure de restauration.
8. **Déploiement contrôlé** : planifier avec sauvegarde, indisponibilité éventuelle des writes, migration, healthchecks, vérification pas de nouvelles routes TV publiques, tests sur SHA unique.
9. **Rollback** : si uniquement schéma additif et sans nouveaux writes TV, restauration du backup ou neutralisation des modules ; **ne pas supprimer les nouvelles tables** contenant des données sans décision explicite et sauvegarde dédiée.

## 6. Indices pour les performances et le dimensionnement

Sans échantillon EPG validé, aucun chiffre de capacité ne peut être considéré comme mesuré.
- Estimer `N` chaînes × `V` variantes × `D=7` jours × `P` émissions/jour et mesurer octets/ligne avec index + TOAST + WAL.
- Mesurer temps de streaming XML, décompression, normalisation et publication ; consommation mémoire en pics, limites réseau et temps de verrou.
- Requêtes critiques : `country + effective_number`, `variant + start`, `schedule_current (variant,date)`, recherche titre/alias, pages pays et révision par date.
- Index recommandés : BTREE `(variant_id,starts_at)`, `(country_id,is_active)`, `(source_id,external_id)`, GIN `pg_trgm` sur noms et titres uniquement après évaluation.
- Prévoir purge par lots, VACUUM/ANALYZE et observabilité ; envisager partitionnement temporel **uniquement si mesures le justifient**.

## 7. Contrôles d'accès et risque de publication

**Aucun GO n'a été donné.** Le gate `TV_GUIDE_PUBLIC_ENABLED=false` doit être respecté par tous les futurs endpoints/API, pages publiques, menus et sitemaps. Il faut l'appliquer **côté serveur**, vérifier le 404/403 même en accès URL directe, interdire le cache partagé de réponses protégées, et ajouter une suite de tests prouvant l'absence de fuite avant GO.

Les accès back-office doivent être réservés à ADMIN au niveau API. L'existence du layout protégé Next.js ne constitue pas un contrôle suffisant.

## 8. Reste à concevoir avant US / développement

- Trancher la représentation des variantes diffusées dans plusieurs pays, clé et état de `tv_schedule_revision`, mécanisme de concurrence des deux pipelines existants.
- Préparer le **SQL exécutable** et le schéma Prisma, revue de conformité sur les deux chemins de base.
- Compléter les contrats JSON et erreurs HTTP ; préciser cadence journalière, backlog et retry.
- Faire réviser l'architecture au regard des maquettes Sally, puis définir critères Murat.
- Examiner sur sources **autorisées** la licence, la couverture EPG et les règles de publication ; aucune recherche externe de sources n'a été lancée pour cette phase.

**Cette version v0.3 est un dossier de conception, pas un changement du runtime, de la base ou du statut de publication.**


---

## Mise à jour validée — 21/11/2026 — GTV-EPG-GLOBAL-01

**Cet arbitrage prévaut sur toute mention antérieure imposant une source EPG par pays.** Une source EPG est mondiale par défaut : création et activation sans association géographique obligatoire, inspection de son flux entier et conservation des IDs externes inconnus en `PENDING_REVIEW`. Une ligne facultative dans `tv_source_country` ne vaut qu'exception nationale explicite (priorité ou désactivation) et ne constitue plus une liste blanche.

Les imports restent partitionnés par pays/variante/date **au stade publication**, pas au stade téléchargement. Chaque source est téléchargée et décodée une seule fois par worker/run, même lorsqu'elle alimente plusieurs pays. La source ne sera publiée que si droits programmes approuvés et justifiés, mapping vérifié, attestation de couverture et protections transactionnelles existantes. Les pays ne pouvant être établis de manière fiable restent à vérifier ; ne pas en déduire une publication automatique.

**Transition technique :** le schéma candidat des 19 tables est conservé ; `tv_import_scope.country_id` reste obligatoire pour le traitement/publication national. La découverte indépendante des pays sans aucun pays TV configuré requiert une itération/migration ultérieure ; aucun drapeau réseau ni public n'a été ouvert automatiquement.

Référence normative : [BMAD — Décision de collecte EPG globale](./guide-tv-mondial-epg-collecte-globale-decision-2026-11-21.md). Traces Jira : [SCRUM-116](https://lmn24.atlassian.net/browse/SCRUM-116), [SCRUM-117](https://lmn24.atlassian.net/browse/SCRUM-117), [SCRUM-122](https://lmn24.atlassian.net/browse/SCRUM-122).
