# SCRUM-98 — Audit des performances LMN24

## Objectif et méthode

Le workflow GitHub Actions `LMN24 performance audit (lab)` exécute Lighthouse dans Chrome Headless sur l'environnement OVH `https://www.lmn24.com` en modes **mobile** et **desktop**. Il enregistre un rapport JSON par page et un `summary.json`. Les fichiers sont conservés 30 jours dans l'artefact `lmn24-performance-lighthouse`.

- Workflow : [performance-audit.yml](../.github/workflows/performance-audit.yml)
- Script : [performance-audit.mjs](../scripts/performance-audit.mjs)
- Le workflow est déclenché manuellement ou lorsqu'on change le script/le workflow de mesure.
- Il mesure accueil, catégorie International, vidéos, météo, horoscope, et une **source réelle fournie en entrée** (`source_path`). Sans slug source confirmé, la ligne source porte le statut `unmeasured` ; aucun slug n'est inventé.
- Il s'agit d'une **seule mesure par page et profil** : comparer des exécutions avec la même configuration et, pour des conclusions robustes, répéter plusieurs fois par URL et utiliser la médiane. Un score ponctuel n'est pas une garantie.
- Les données de laboratoire comprennent LCP, CLS, TBT (proxy non équivalent à INP), Speed Index, TTFB, scores Lighthouse. L'INP exige des interactions réelles et/ou des données de terrain Chrome UX Report. Il n'est pas calculé dans cet audit (`inpMs=null`).
- Les mesures sont prises sans accepter les cookies d'analyse ; les effets GA4 **après** acceptation ne sont donc pas couverts. Il faudra une campagne distincte, consentement explicite, pour cet écart.
- Les pages 404, les pages sans données, les erreurs de mesure et les redirections apparaissent dans les résultats ; ne jamais interpréter un score sur une 404 comme celui de la page attendue.

## Baseline observée — 14 novembre 2026

Cette baseline provient du runner GitHub Actions [#43622156804](https://github.com/JeanLamora75/lmn24/actions/runs/43622156804). Elle mesure **la production OVH avant les correctifs SCRUM-98**, une seule exécution Lighthouse par page et profil, sans accepter les cookies.

| Page | Score mobile | LCP mobile | TBT mobile | CLS mobile | Score desktop | LCP desktop |
|---|---:|---:|---:|---:|---:|---:|
| Accueil `/fr` | 73 | 5 611 ms | 105 ms | 0 | 82 | 2 263 ms |
| `/fr/category/international` | 75 | 5 456 ms | 155 ms | 0 | 90 | 1 596 ms |
| `/fr/videos` | 92 | 2 881 ms | 49 ms | 0 | 89 | 1 714 ms |
| `/fr/weather` | 99 | 1 658 ms | 45 ms | 0 | 100 | 650 ms |
| `/fr/horoscope` | 96 | 2 727 ms | 93 ms | 0 | 100 | 626 ms |
| Source réelle | non mesurée | — | — | — | non mesurée | — |

Le TTFB Lighthouse mobile est d'environ 272 ms sur l'accueil, les catégories, les vidéos et la météo, et 145 ms sur l'horoscope. L'INP terrain n'a pas été mesuré. Ces scores ne sont ni un résultat CrUX ni une mesure après optimisation.

**Priorité mesurée :** améliorer le LCP mobile de l'accueil et des catégories en premier sans dégrader le CLS ni la météo.

## Seuils d'observation indicatifs

Ces valeurs sont des **repères à vérifier sur les données de terrain**, pas des résultats ni des engagements de performance :

- LCP ≤ 2,5 s ;
- INP ≤ 200 ms ;
- CLS ≤ 0,1 ;
- TTFB — à suivre en tenant compte du serveur et des conditions réseau.

Pour l'INP, ne pas le remplacer par TBT ; le TBT n'est qu'un indicateur labo complémentaire.

## Optimisations conservatrices déjà apportées

- Les cartes vidéo ont un ratio visuel CSS `16 / 9` et une image avec dimensions natives `480×270`, réservant un espace stable.
- Images de vignettes vidéo hors écran : `loading=lazy`, `decoding=async`, `fetchPriority=low`.
- Un seul média prioritaire par page initiale sur l’accueil et les listes catégorie : premier article avec `loading=eager` et `fetchPriority=high` ; toutes les autres images restent lazy. Cette hypothèse LCP est à confirmer par une nouvelle mesure après déploiement.
- Le lecteur vidéo reste chargé seulement lorsque la modale est ouverte (pas d'iframe YouTube au chargement de la galerie).
- Le tag Google Analytics reste bloqué avant consentement, sans requête à la librairie Google lors de la première navigation.
- Les images d'articles RSS externes sont actuellement en `next/image unoptimized` ; l'optimisation de serveurs tiers nécessite un modèle de confiance (proxy, cache et licences) **avant** de modifier ce comportement.

## Recette après déploiement

1. Déployer le commit de changement sur OVH.
2. Exécuter à nouveau le workflow sur les mêmes URLs, avec un chemin de source réelle vérifié.
3. Comparer les rapports `summary.json`, idéalement avec plusieurs exécutions en conditions similaires.
4. Vérifier mobile (360–390px), tablette et desktop : navigation, carrousels, chargement progressif, modale YouTube, consentement GA4, erreurs réseau, contrastes et focus.
5. Recueillir les données Core Web Vitals **réelles** dans Search Console/CrUX après disponibilité.
6. Garder la Story ouverte tant que la campagne avant/après, INP terrain et validation OVH ne sont pas documentées.

Le workflow n'exécute aucune action d'administration ni aucun déploiement.
