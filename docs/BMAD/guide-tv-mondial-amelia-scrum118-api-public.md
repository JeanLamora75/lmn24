# LMN24 — Guide TV mondial — Amelia / Winston / Murat — SCRUM-118

**Date :** 21 novembre 2026  
**Story :** [SCRUM-118](https://lmn24.atlassian.net/browse/SCRUM-118)  
**État :** implémentation backend candidate sur `main`, non exposée au public. **Aucun GO** de publication ou de migration.

## Implémentation

- Contrôleur `apps/backend/src/tv/tv-public.controller.ts`, exclu de Swagger, routes proposées :
  - `GET /public/tv/countries?locale=fr` — pays actifs, libellés `Intl.DisplayNames`, huit langues annoncées sans prétendre que le contenu est traduit ;
  - `GET /public/tv/schedule?country=FR&localDate=YYYY-MM-DD&tab=TONIGHT&page=1&pageSize=50` — onglets CHANNELS, NOW, TONIGHT, LATE ;
  - `GET /public/tv/channels/:channelId?country=FR` — fiche chaîne, variantes du pays, langues ;
  - `GET /public/tv/channels/:channelId/airings?country=FR&variantId=UUID&localDate=YYYY-MM-DD` — diffusions authentiques, écarts calculés mais jamais stockés comme fausses émissions ;
  - `GET /public/tv/airings/:airingId` — fiche de la diffusion exacte.
- Le garde global **SCRUM-113** bloque encore ces préfixes dans NestJS par **404 générique / no-store / noindex avant le contrôleur** ; le contrôleur lui-même effectue une seconde vérification des deux paramètres `TV_PUBLIC_ENABLED` et `TV_PUBLIC_RELEASE_APPROVED`, tous deux non activés dans ce développement. Les portes Next.js SCRUM-113 demeurent inchangées. Un code sur `main`, une CI verte ou un déploiement ne valent jamais GO.
- `tv-public.service.ts` utilise uniquement la révision pointée par `tv_schedule_current` avec statut `PUBLISHED`, les pays TV actifs, les associations chaîne/pays actives et revues, les sources et associations de sources actives et le droit **programme APPROVED + preuve**. Les synopsis et les illustrations sont indépendamment masqués si leur propre droit n'est pas approuvé et documenté. Les chaînes restent dans le catalogue même sans EPG.
- Pour **les logos**, la migration candidate ne contient pas de traçabilité fiable du logo à sa source : ils sont délibérément `null`, même si une autre source du pays dispose d'un droit logo. Les liens de direct sont également `null` jusqu'à validation du propriétaire et du lien officiel ; l'interface ne doit jamais inventer d'URL ni embarquer un lecteur.
- `tv-public-policy.ts` : J0 à J+6 dans le fuseau du pays sur l'accueil ; fuseau IANA de la variante sur les fiches ; NOW uniquement J0 ; plage TONIGHT **20:30:00–21:30:00** et LATE **22:30:00–23:30:00** avec deux bornes inclusives à la milliseconde ; aucun début plus tardif ni programme commencé avant la fenêtre, même s'il joue encore. L'instant UTC original n'est jamais altéré ; les journées DST 23/25 heures et les diffusions traversant minuit sont conservées.
- **D04 fail-closed :** `AVAILABLE` seulement si un airing authentique est retrouvé. `NO_START_IN_WINDOW` exige une preuve de couverture indépendante, approuvée et couvrant intégralement la fenêtre ; sinon réponse `EPG_UNAVAILABLE`. **La migration à 19 tables ne stocke pas encore les attestations vérifiées de couverture** ; pour éviter de fabriquer cette garantie, `coverage()` ne renvoie aucune attestation, et la réponse inclut `coverageState: UNKNOWN`. Il est donc volontairement impossible de produire actuellement `NO_START_IN_WINDOW` à partir de la seule base candidate. Ce sous-critère **reste ouvert** avant DoD.
- Pagination bornée `page >=1`, `pageSize 1..100`, `hasNext` sans total fabriqué ; vérification de country ISO2, UUID, dates et langues, validation du fuseau IANA visiteur sans aucune inférence IP ; 400 filtre invalide, 422 NOW futur et jour hors horizon, 404 ressource inactive/introuvable. `Cache-Control: no-store` sur toutes les réponses de routes publiques.

## Recette Murat

- `tv-public-policy.test.ts` : règles D01/D04/D05, secondes et millisecondes des bornes, NOW demi-ouvert, refus de `NO_START` sans couverture, plages 23h/25h et émissions traversant minuit.
- `tv-public.controller.test.ts` : embargo 404 avant toute lecture de DB, tous les endpoints, filtres 400, pages bornées, 422, fuseau invalide, pays et langues.
- `docs/BMAD/guide-tv-mondial-scrum118-public-read-isolated-smoke.sql` : contrôle PostgreSQL jetable, avec droits d'émission approuvés/refusés et désactivation pays. Le workflow `.github/workflows/tv-guide-isolated-validation.yml` exécute ces tests sur la base synthétique, **pas sur la vraie base**.
- Contrôler le verdict des workflows : [CI générale](https://github.com/JeanLamora75/lmn24/actions/workflows/ci.yml) et [Validation TV isolée](https://github.com/JeanLamora75/lmn24/actions/workflows/tv-guide-isolated-validation.yml). Ne pas affirmer PASS sans résultat effectivement constaté sur le SHA.

## Écarts bloquants / à finaliser

1. **SCRUM-114** — migration candidate toujours hors des migrations canonique et sans base de production qualifiée, donc pas de recette de requête HTTP sur schéma réel.
2. **D04 / D12** — stockage auditable des intervalles de couverture avec provenance, licence, validation et fraîcheur, suivi de requêtes et preuves de comportement `NO_START_IN_WINDOW` sur la vraie base ; ne pas dériver de couverture d'un import SUCCESS.
3. **Provenance des assets** — logo et URL officielle autorisés au niveau d'un bien identifiable, pas une licence globale d'une autre source.
4. **Recette intégrée HTTP DB** — valider toutes les combinaisons variantes/pays, NOW à minuit, DST, 2 pages en mutation concurrente, absence d'exposition avec gates désactivées et contrôles de performance sous charge.
5. **SCRUM-125** — revue SEO, sécurité et licences puis GO humain explicitement distinct de la CI. Le code ne doit pas lever le moindre embargo.
6. **D09** — distinction des airings identiques entre deux variantes conservée via les identifiants d'airing et de variante, sous revue sur données réelles.

**Verdict :** code backend et tests d'isolation livrés, **pas d'homologation opérationnelle**. SCRUM-118 reste ouverte tant que ces gates et les preuves d'intégration ne sont pas levés. Aucune consultation ni écriture de production, aucun fournisseur EPG réel contacté, aucune page TV publique publiée.
