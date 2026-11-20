# LMN24 — Guide TV mondial — Winston — Architecture détaillée v0.2

Date : 2026-11-20
Statut : proposition d'architecture technique pour revue, **pas une implémentation**
Références : [Mary — cadrage](./guide-tv-mondial-mary-cadrage-fonctionnel.md) ; [Winston — étude initiale](./guide-tv-mondial-winston-architecture-initiale.md)
Règle de lancement : **aucune mise à disposition publique avant un GO explicite du propriétaire**, quelle que soit l'avancée de la CI et des développements.

## 1. Inventaire du dépôt main constaté

| Brique | Existant identifié | Conséquence |
|---|---|---|
| Frontend | Next.js, routes localisées dans apps/frontend/src/app/[locale], navigation dans PublicHeader.tsx | Prévoir routes TV publiques et composants adaptatifs indépendants |
| Backend | NestJS, apps/backend/src/app.module.ts | Ajouter un TvGuideModule autonome |
| Parser | Service interne déjà utilisé par ParserGatewayService avec PARSER_INTERNAL_URL et PARSER_SHARED_SECRET | Ajouter des workers/adaptateurs EPG au service parser plutôt que créer un microservice supplémentaire |
| SQL | PostgreSQL, Prisma partagé packages/database/schema.prisma | Tables TV dédiées, relations et indexes spécialisés |
| Import | ParserBatchRun, ParserRunEvent, routines météo/horoscope | Réutiliser concepts de runs, heartbeat, reprise, logs; conserver entités TV séparées |
| Auth admin | Session/cookie, vérification rôle ADMIN côté NestJS, layout protégé Next.js | Réappliquer contrôles au niveau de chaque API et action |
| SEO | seo-sitemap.ts (routes permanentes explicites) | Interdire toute URL/sitemap TV avant GO et exclure émissions temporaires |
| Gate initial | tv-guide-release.ts, booléen false | Le raccorder aux routes/contrôleurs futurs; false seul ne suffit pas |
| Migrations | packages/database/README.md détaille les schémas historiques SQL non tous baselinés dans Prisma | Créer une migration additive SQL idempotente et stratégie de bootstrap, avec backup et smoke tests |

Un détail important : Country.isActive appartient au référentiel éditorial général. L'activation Guide TV doit être distincte de celle des actualités.

## 2. Découpage logique

- **Frontend public Next.js** : /[locale]/tv (ou slug localisé fixé par Sally), /[locale]/tv/[country], /[locale]/tv/[country]/[channel], /[locale]/tv/programme/[airingId]. Routes verrouillées serveur jusqu'au GO.
- **Frontend admin Next.js** : Pays TV, Chaînes, Sources EPG, Imports & historiques, Statistiques, Fournisseurs de traduction. Autorisation admin obligatoire.
- **Backend NestJS TvGuideModule** : Country/ChannelCatalogService, TvScheduleQueryService, TvSearchService, TvSourceService, TvImportOrchestrator, TvTranslationService, TvPublicationGate.
- **Worker parser existant** : TvEpgCollector et adaptateurs XmlTvAdapter, GzipXmlTvAdapter, JsonEpgAdapter ; validation/téléchargement par lot, génération d'événements.
- **Base PostgreSQL** : catalogue durable, snapshots validés par périmètre, programmes/diffusions, identifiants externes, sources autorisées, runs et événements.
- **Traitement par étapes** : collecter -> parser -> normaliser -> rapprocher -> fusionner -> contrôler -> publier un snapshot par pays/variante/journée -> purger l'ancien.

## 3. Modèle relationnel recommandé (noms logiques provisoires)

| Entité | Colonnes / clés principales | Règle / contrainte |
|---|---|---|
| TvCountry | countryId (FK Country), isActive, referenceTimeZone, createdAt, updatedAt | PK countryId ; activation TV séparée |
| TvChannel | id UUID, slug, name, logoUrl?, descriptionSourceLang?, isActiveGlobal?, createdAt | Identité nationale canonique et stable |
| TvChannelCountry | id, channelId FK, countryId FK, number, numberOrigin, isActive, approvedAt? | unique(countryId, channelId); unique(countryId, number) **seulement pour numéros actifs uniques**; ajuster pour chaînes multi-pays |
| TvChannelLanguage | channelId FK, languageCode FK | unique(channelId, languageCode) |
| TvChannelVariant | id, channelId FK, code, name, timeZone, isDefault | unique(channelId, code), une variante par défaut |
| TvChannelExternalId | id, sourceId FK, externalChannelId, channelVariantId?, channelId FK, status, confidence | unique(sourceId, externalChannelId) ; associations ambiguës mises en attente |
| TvChannelSocial | channelId FK, website, facebook?, instagram?, youtube?, x?, liveOfficialUrl? | URLs officielles, corrections manuelles protégées |
| TvChannelDescription | channelId FK, language, text, provenance, editedAt | unique(channelId, language), ne pas écraser MANUAL |
| TvEpgSource | id, name, url, format, priority?, isActive, rightsStatus, licenseEvidenceUrl?, lastCheckedAt? | rightsStatus APPROVED obligatoire pour exposition publique |
| TvEpgSourceCountry | sourceId FK, countryId FK, priority, isActive | unique(sourceId, countryId), priorités locales |
| TvProgramme | id, canonicalTitle, synopsis?, category?, imageUrl?, season?, episode? | Métadonnées communes facultatives ; pas de faux programmes |
| TvAiring | id, programmeId FK, variantId FK, startAt UTC, endAt UTC, sourceId, fingerprint | startAt < endAt, unicité par variante/identité de diffusion |
| TvScheduleRevision | id, countryId, variantId, localDate, status, publishedAt, runId | une révision publiée par périmètre ; version précédente conservée tant que nécessaire |
| TvRevisionAiring | revisionId FK, airingId FK | unique(revisionId, airingId) |
| TvImportRun | id, trigger, periodStart, days, status, counters, startedAt, endedAt | runs manuels/automatiques avec progression |
| TvImportScopeRun | id, runId FK, countryId, sourceId?, status, errors, attempts | reprise ciblée pays/source |
| TvImportEvent | id, runId FK, scopeId?, eventType, level, occurredAt, message | TTL 30 jours |
| TvTranslationProvider | id, type, endpoint, credentialRef?, fromEmail?, isActive, isSelected, freeApprovedAt?, commercialRightsReviewedAt? | un fournisseur actif choisi manuellement ; pas de quotas |
| TvTranslationAttempt | id, channelId, language, providerId, status, startedAt | historique minimal ; aucune tarification ni basculement automatique |

**Arbitrage à finaliser** : une chaîne peut être diffusée nationalement dans plusieurs pays et conserver un numéro propre à chacun ; cette relation justifie TvChannelCountry. Si le numéro officiel est absent, attribuer atomiquement le plus petit numéro positif disponible par pays, sans écraser les numéros manuels. Un numéro peut exister dans deux pays.

**Arbitrage à finaliser** : les grilles télévisées changent souvent de titre/métadonnées à chaque source ; la référence d'une diffusion doit tenir compte de l'identité source et de la variante, et ne pas se fonder sur le titre seul.

### Compatibilité SQL/Prisma
- Préparer des modèles Prisma et une migration SQL additive, transactionnelle et réexécutable pour les bases historiques LMN24.
- Contrôler d'abord le déploiement de baseline Prisma : ne pas utiliser aveuglément prisma migrate deploy sur une base historique non baselinée.
- Étendre aussi le bootstrap d'une **nouvelle** base dans le chemin canonique existant.
- Sauvegarde avant migration, tests de contraintes sur base isolée et plan de retour arrière **sans effacer les données**.

## 4. Contrats d'API proposés (v0.2)

Toutes les API publiques renvoient des IDs stables ; textes dans la langue disponible et fuseau IANA explicite. Avant GO : 404/403 sans fuite de catalogue pour toutes les routes publiques.

| Méthode / route indicative | Usage | Paramètres clés |
|---|---|---|
| GET /public/tv/countries | Pays activés et référence horaire | locale |
| GET /public/tv/channels | Onglet Chaînes | country, broadcastLanguage, date, page |
| GET /public/tv/schedule | Onglets En ce moment, Ce soir, 2ème partie | country, language, tab, localDate, timeDisplay |
| GET /public/tv/channels/:id | Fiche chaîne, variantes, réseaux | country, locale |
| GET /public/tv/channels/:id/airings | Grille complète 00h00–23h59 | country, variantId, localDate |
| GET /public/tv/airings/:id | Fiche émission | locale |
| GET /public/tv/search | Recherche mondiale | q, locale, page |
| GET /admin/tv/countries | Paramètres pays | filtres |
| PATCH /admin/tv/countries/:id | Activation, fuseau référence | isActive, referenceTimeZone |
| GET/POST/PATCH /admin/tv/channels... | Catalogue et corrections | chaîne, variante, numéro, descriptions |
| GET/POST/PATCH /admin/tv/sources... | Sources et priorités | format, URL, pays, rightsStatus |
| POST /admin/tv/import-runs | Démarrage import manuel | countries?, days 1..7 |
| GET /admin/tv/import-runs/:id | Suivi / résultats | runId |
| POST /admin/tv/import-runs/:id/retry | Relance ciblée | failedScopes? |
| GET /admin/tv/statistics | Synthèse globale/par pays | plage |
| GET/PATCH /admin/tv/translation-providers | Fournisseur actif | configuration |
| POST /admin/tv/channels/:id/translate | Traduire les manquantes | sourceLanguage, targetLanguages |

Les objets de réponse devront différencier : programme connu ; aucune diffusion démarrant dans la fenêtre ; aucune donnée exploitable. Les faux programmes n'ont jamais d'ID cliquable.

### Recherche
- q strictement numérique -> égalité sur numéro TvChannelCountry.number, dans tous les pays actifs ; une requête textuelle -> noms et titres alternatifs normalisés, correspondances partielles accent/casse-insensibles ; pagination pour les résultats internationaux.
- Grouper en sections Chaînes / Programmes, ordre pays puis numéro, réduire les variantes horaires à une carte chaîne.
- Évaluer pg_trgm et index GIN sous forme de migration SQL contrôlée ; traiter séparément le cyrillique et les variantes connues. Un chiffre dans une recherche textuelle mixte n'implique pas un numéro exact.

## 5. Pipeline d'import et fusion

1. **Planification** : à fréquence quotidienne seulement pour pays TV actifs ; en manuel pays actifs ou non, sélection 1 à 7 jours ; exclusivité par source/périmètre afin d'éviter imports concurrents.
2. **Collecte** : contrôler chaque URL (SSRF), limiter taille et ratio de décompression, télécharger de manière bornée, journaliser provenance et hash.
3. **Validation** : parser XML/JSON en flux ; rejeter dates illisibles, inversions début-fin, IDs invalides, doublons exacts ; conserver les métadonnées optionnelles valides.
4. **Résolution chaîne** : alias connu -> variante ; inconnu -> découverte chaîne désactivée et proposition admin ; alias ambigu -> quarantaine, pas de fusion automatique par nom.
5. **Normalisation** : UTC + timeZone de variante ; titres/tags, programme et airing distincts.
6. **Fusion** : classer candidats par priorité locale de source, remplissage des lacunes par secondaires, dédoublonnage (source id + variante + heures + similarités prudentes), signaler chevauchements.
7. **Snapshot de préparation** : par pays/variante/date avec indicateurs de couverture, anomalies et état source ; aucun effacement des données publiques avant validation.
8. **Publication atomique** : passer la révision courante à validée via transaction. Les autres pays restent sur leur dernière révision, journaliser PARTIAL.
9. **Reprise** : relancer uniquement scopes pays/source en échec, idempotence par clé de run/périmètre/contenu.
10. **Nettoyage** : purger programmes passés après 7 jours ; garder futures J0..J+6 ; journaux 30 jours ; ne jamais effacer catalogues/corrections.

**Point de contrôle** : lorsque la fusion secondaire comporte un chevauchement, préférer « programme non disponible » à une émission inventée. Un import qui ne trouve aucune émission peut être légitime pour une chaîne inconnue, mais ne doit pas automatiquement vider une grille précédemment valide : journaliser les raisons et requérir validation de périmètre.

## 6. Couverture temporelle

- Une date « Aujourd'hui » vient du fuseau de référence du pays, **pas** de l'appareil du visiteur.
- Pour une chaîne multi-fuseaux, garder une seule carte et proposer les variantes sur sa page.
- Grille journée 00:00..24:00 du fuseau de la variante ; une émission qui traverse minuit apparaît dans la journée par intersection.
- « Ce soir » = startTime local dans [20:30, 21:30] ; « 2ème partie » = [22:30, 23:30]. **Départ** strict, pas programme déjà en cours.
- « En ce moment » = startAt <= instant courant < endAt ; onglet inactif quand la date du pays n'est pas aujourd'hui.
- Affichage visiteur = formatage d'instants, sans modifier les filtres des onglets ; gestion DST avec timeZone IANA.

## 7. Publication, sécurité et SEO — condition absolue

Tant que le propriétaire n'a pas donné son GO explicite :
- Maintenir TV_GUIDE_PUBLIC_ENABLED=false ; **valider côté serveur dans Next.js et dans NestJS** (ne pas uniquement cacher le bouton).
- Refuser toutes les URLs directes publiques TV, y compris détail émission, API, preview/indexation ; ne fournir aucune entrée dans header/footer/accueil/sitemap/hreflang.
- Autoriser le back-office TV protégé pour les tests ; exiger session/rôle ADMIN sur **chaque** API d'administration, pas seulement le layout.
- Noindex n'est **pas** une barrière d'accès : 404/403 côté serveur et aucune fuite de réponse/caches.
- Après GO, sitemaps seulement pour homepage TV, pages pays et chaînes ayant contenu permanent substantiel ; fiches programmes toujours noindex.
- Procédure d'activation : accord explicite traçable -> revue droits sources et QA -> commit dédié modifiant le gate -> CI sur le même SHA -> contrôle des accès + SEO déployé. Ne jamais activer automatiquement sur simple livraison.

Sécurité imports : URL externes soumises à allowlist / DNS-IP contrôle (SSRF), redirects vérifiés, limites décompression (zip/gzip bomb), XML streaming sans entités externes, timeouts, validation données, anti-XSS, aucune clé API dans navigateur. Fournisseurs de traduction : données envoyées vers prestataire externe, vérification des conditions commerciales requise.

## 8. Vérifications / preuves à produire avant stories

- Tests migration vierge + existante, sauvegarde et restauration isolée, index, FK et unicité.
- Tests unitaires mapping EPG, alias, numérotation, fusion, priorités, diff d'import, grilles lacunaires.
- Tests temps : Europe/Paris, America/New_York, America/Los_Angeles, Pacific/Auckland, passages DST, minuit et dates de frontière.
- Tests de sécurité SSRF, données malveillantes, compression anormale, sessions admin.
- Tests publication : lien header/accueil/footer absent, routes directes/API 404/403, sitemaps sans TV, non-indexation émissions même après GO.
- Tests i18n des huit langues et absence d'écrasement des corrections manuelles.
- Dimensionnement sur échantillons autorisés : ingestion, volume DB, index, WAL, CPU, RAM, latence accueil/recherche. Aucun chiffre de capacité fourni sans mesures.

## 9. Points à faire valider et passage de relais

- **Mary** : règle exacte de repli si pays préféré indisponible, résolution de la date quand une variante diffère du pays, flux UX de « En ce moment » hors J0.
- **Sally** : accès admin imports, cartes état vide, sélecteur variantes/fuseau, langues et mobile.
- **Winston** : modèle définitif, index et publication révisionnelle, couverture EPG, reprise et parser interne.
- **Murat** : stratégie de qualité, sécurité des sources, tests du gate sur CI.
- **John** : Epic et US seulement après examen croisé ; aucune Story d'activation publique automatique.

**Pas de recherche Internet de fournisseurs/source externe menée dans cette étape. Aucun fichier de code applicatif ou schéma DB n'est modifié par cette note.**
