# LMN24 — SCRUM-121 / GTV-08 — Recherche TV mondiale

Date : 2026-11-21. Implémentation sur `main`, derrière le verrou de publication TV.

## Fichiers réalisés
- `apps/backend/src/tv/tv-public.service.ts` : recherche des chaînes par pays actif et numéro, et des diffusions réelles de J0 à J+6 dans le fuseau IANA de leur variante. Recherche indépendante des filtres d'accueil.
- `apps/backend/src/tv/tv-public.controller.ts` : GET `/public/tv/search?q=&channelsPage=1&programmesPage=1&pageSize=30&section=all|channels|programmes`, validation stricte, 404 avant GO, no-store.
- `apps/frontend/src/app/api/public/tv/[...path]/route.ts` : proxy autorisé uniquement derrière le gate TV.
- `apps/frontend/src/app/[locale]/tv/search/page.tsx` : page serveur avec contrôle de gate et noindex.
- `apps/frontend/src/components/tv/TvWorldSearch.tsx` et CSS : saisie explicite, erreurs et pagination par section, réponses périmées ignorées, clavier et 320 px.
- `apps/frontend/src/components/tv/TvGuideHome.tsx` : lien depuis la recherche de l'accueil.
- `apps/backend/src/tv/tv-world-search-policy.ts` et tests : distinction ASCII numérique entier exact / texte.

## Invariants
1. `002` recherche le numéro entier 2 ; `12` ne matche jamais le 2. Les chiffres non ASCII et les requêtes mixtes sont du texte.
2. Ordre : ISO2 croissant, numéro national, nom et identifiant ; une chaîne par pays et association nationale, jamais une carte par variante.
3. Les émissions sont les vrais airings publiés, autorisés par source et distincts par ID/variante. Le jour est calculé dans le fuseau IANA de chaque variante, y compris autour de DST.
4. Une section peut échouer et laisser l'autre disponible. Pagination et réessai ciblés via `section` ; aucun total inventé.
5. Avant GO, le contrôleur, le proxy et la route Next.js restent fermés ; aucun changement de variables de publication, de base ou de migration n'a été réalisé.

## Vérifications nécessaires avant clôture
- Obtenir une **CI verte sur le même commit**, puis revue QA Murat (notamment SQL sur schéma isolé représentatif, recherche mondiale, accents et DST).
- **Limitation du schéma candidat actuel :** `tv_programme` ne possède que `title`, aucun titre alternatif persistant. AC02 (titres alternatifs) reste bloqué jusqu'à extension du modèle autorisée et migration testée en environnement isolé. Aucune migration de production sans GO distinct.
- La normalisation de recherche sans extension PostgreSQL utilise une table de translittération des accents latins courants ; compléter la recette sur toutes les écritures ciblées, sans déclarer la prise en charge universelle avant preuve.
- Poursuivre UX03-01…26 et maquettes hautes fidélités SCRUM-127. Ni décision de publication ni migration n'est accordée par cette réalisation.

Références : [SCRUM-121](https://lmn24.atlassian.net/browse/SCRUM-121), [Décisions D06–D09](./guide-tv-mondial-mary-winston-arbitrages-d01-d15.md).
