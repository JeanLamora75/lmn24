# LMN24 — Guide TV mondial — Sally — UX-03 : recherche mondiale et états particuliers

**Date :** 2026-11-20  
**Version :** UX-03 v1.0 — étude UX/UI fonctionnelle, wireframes et critères de recette, **non validée visuellement**  
**Statut :** document BMAD seulement. Aucune route, aucun écran, aucune API et aucun référencement Guide TV activés.  
**Références :** [Mary — cadrage fonctionnel](./guide-tv-mondial-mary-cadrage-fonctionnel.md) · [Sally UX-01](./guide-tv-mondial-sally-ux01-accueil-responsive.md) · [Sally UX-02](./guide-tv-mondial-sally-ux02-fiches-chaines-programmes-grilles.md) · [Winston — contrats API](./guide-tv-mondial-winston-contrats-api-fusion-epg.md).  
**Règle impérative :** avant le GO explicite du propriétaire de LMN24, aucune recherche TV accessible publiquement, même via URL directe, préchargement, endpoints NestJS, métadonnées, sitemap ou navigation.

## 1. Objectif du lot

Offrir un point d'entrée réellement **mondial** : chercher une chaîne ou une émission dans tous les pays TV actifs de LMN24, sans être limité par le pays ou la langue de diffusion sélectionnés sur l'accueil. Permettre de différencier rapidement les résultats portant le même numéro ou le même nom dans plusieurs pays, puis ouvrir la fiche chaîne ou la **diffusion exacte**.

En parallèle, formaliser les états UX sans résultat, en cours de chargement, en erreur, partiellement disponibles, données EPG manquantes ou hors périmètre — avec un langage juste, sans émission fictive.

## 2. Contrat de recherche — règles fonctionnelles non négociables

| Entrée | Interprétation | Résultat |
|---|---|---|
| `2` | Numéro de chaîne **égal exactement à 2** dans chaque pays TV actif | Les n° 2, jamais les n° 12/20/200 |
| `002` | Saisie numérique normalisée vers l'entier 2 **si validé** | Pas de correspondance sur « 002 » comme sous-chaîne ; normalisation à clarifier |
| `France 2` | Recherche textuelle (pas exclusivement numérique) | Correspondances partielles sur noms de chaînes et titres |
| `journal` | Recherche textuelle | Chaînes, titres originaux et titres alternatifs existants uniquement |
| `été` | Recherche textuelle | Correspondances insensibles aux accents et à la casse |
| `abc` | Recherche textuelle sans traduction | Ne pas inventer d'équivalent traduit ; les titres alternatifs enregistrés sont interrogeables |
| Saisie vide/espaces | Pas de recherche | Message d'aide à la saisie, sans API inutile |

**Recherche indépendante** du pays affiché et de son filtre de langues. Les pays et chaînes inactifs ne produisent jamais de résultat, même par ID direct. Les variantes horaires d'une même chaîne **et d'un même pays** sont fusionnées dans une seule carte/ligne ; si une chaîne existe dans plusieurs pays actifs, afficher une ligne distincte par pays pour que numéro, pays et destination restent explicites.

Les **programmes** recherchables se limitent aux diffusions publiques connues de J0 à J+6 dans la référence du pays/variante telle que définie par Winston. Un résultat représente une **diffusion identifiable** (chaîne, variante, instant de début), pas un titre isolé dépourvu d'horaire.

## 3. Parcours desktop — wireframe structurel

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER LMN24                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Programme TV > Recherche mondiale                                            │
│ Rechercher parmi toutes les chaînes et émissions des pays disponibles.       │
│                                                                              │
│ [ 🔎 Chaîne, numéro ou titre de programme…                         ][Rechercher]│
│ Résultats pour « 2 » · recherche dans tous les pays actifs                    │
│                                                                              │
│ CHAÎNES (ex. 3 résultats)                                                     │
│ [LOGO]  n° 2  Exemple TV                       France   [Voir la grille  >] │
│ [LOGO]  n° 2  Example Channel                  Royaume-Uni [Voir la grille>]│
│ [LOGO]  n° 2  Canal de démonstration           Espagne  [Voir la grille  >] │
│ [Voir davantage de chaînes]                                                  │
│                                                                              │
│ PROGRAMMES (ex. 2 résultats)                                                 │
│ [LOGO]  n° 2 · France · 20:45  Titre fictif             [visuel] [Ouvrir  >]│
│ [LOGO]  n° 2 · Espagne · 21:00  Autre titre             [visuel] [Ouvrir  >]│
│ [Voir davantage de programmes]                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Toutes les chaînes/programmes ci-dessus sont **des exemples fictifs**, non des résultats EPG.

### Hiérarchie
1. H1 « Recherche mondiale » et explication courte : **tous les pays disponibles**.
2. Champ de recherche avec label visible, bouton de soumission, effacer accessible ; éviter les recherches implicites qui surprennent les connexions lentes.
3. Résumé de requête, répartition en deux sections **Chaînes** et **Programmes**, chacune avec son compteur si API fiable.
4. Dans chaque section : pays **avant** toute donnée potentiellement ambiguë, numéro national, logo/niveau descriptif ; titre et horaires pour les émissions.
5. Pagination indépendante pour les deux sections. Le bouton « Voir plus » ajoute les lignes sans remettre la page en haut et sans perdre le focus.
6. Chaque résultat est une destination sémantique unique, clairement nommée : « Voir la grille de Exemple TV, chaîne 2 en France » ou « Détails de Titre fictif, France, 20:45 ».

## 4. Parcours mobile — 390 px et 320 px

```text
┌────────────────────────────────┐
│ Recherche mondiale             │
│ Tous les pays disponibles      │
│ [ Rechercher chaîne ou émission]│
│ [          Rechercher         ]│
│ Résultats : « 2 »              │
│                                │
│ Chaînes                        │
│ ┌────────────────────────────┐ │
│ │[logo] France · n° 2        │ │
│ │       Exemple TV           │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │[logo] Royaume-Uni · n° 2   │ │
│ │       Example Channel      │ │
│ └────────────────────────────┘ │
│ [Voir plus de chaînes]         │
│                                │
│ Programmes                     │
│ ┌────────────────────────────┐ │
│ │ France · n° 2 · 20:45      │ │
│ │ Titre fictif              │ │
│ │ Exemple TV · ven. 20 nov.  │ │
│ └────────────────────────────┘ │
│ [Voir plus de programmes]      │
└────────────────────────────────┘
```

- Une colonne, jamais un tableau horizontal. Le nom du pays et le numéro restent **visibles** et ne sont pas réduits à un drapeau seul.
- Champ de recherche en pleine largeur ; bouton de soumission soit adjacent si largeur suffisante, soit en ligne suivante à 320 px ; cibles tactiles >= 44 px.
- Les résultats de programmes conservent heure **et date locale** ; si l'heure affichée est dans le fuseau visiteur et change le jour, afficher aussi le contexte de la chaîne et le décalage de date.
- Titres jusqu'à deux lignes dans les cartes ; texte complet accessible sur destination et via nom accessible. Descriptions secondaires coupées plutôt que réduire les tailles de caractères.
- Réserver une largeur constante aux logos ; fallback en cas de logo absent ; images de programmes facultatives et sans déformation.
- Pas de défilement horizontal de page ; sections et pagination restent au clavier.

## 5. Comportement du champ et navigation

### Soumission
- **Option UX recommandée pour v1** : recherche explicite par touche Entrée ou bouton « Rechercher », sur desktop **et** mobile, pour éviter les requêtes incontrôlées et améliorer la prévisibilité. Une suggestion en direct pourra être étudiée plus tard.
- Nettoyer les espaces en tête/fin, appliquer une limite technique de longueur côté API ; conserver la requête telle que saisie pour l'affichage et les annonces. Aucun envoi si vide.
- Définir le type de recherche d'après la requête complète normalisée : *numérique seule* vs *texte*. Ne jamais étendre les nombres en correspondances partielles.
- Quand une nouvelle requête démarre : annuler/ignorer la réponse obsolète (`AbortController` ou identifiant croissant de requête), réinitialiser **les deux paginations** et annoncer le chargement.
- Le bouton effacer revient à l'aide initiale ; ne doit pas afficher de faux « 0 résultat ».

### Navigation et retour
- Depuis résultat **chaîne**, ouvrir sa page dans le bon pays (pour numéro national) avec variante par défaut définie par l'architecture.
- Depuis résultat **programme**, ouvrir la fiche de la diffusion réelle, avec `airingId`, pays, variante et horaire UTC, conformément à UX-02.
- Retour navigateur : retrouver requête, scroll, section et page chargée quand l'historique/URL de la page le permet ; pas de sauvegarde dans les préférences visiteurs.
- **Après GO uniquement** : autoriser une URL de recherche contenant une requête encodée, mais **noindex,follow** et canonical défini avec Winston ; jamais indexer les variations illimitées de termes de recherche.
- Avant GO : backend, SSR/Next et API donnent un **404 neutre + no-store**, aucune recherche préchargée ou HTML révélateur, pas de lien de navigation.

## 6. Rendu des deux sections et état partiel

Les sections **Chaînes** et **Programmes** sont indépendantes : une section peut être vide lorsque l'autre possède des résultats. Éviter une phrase « Aucun résultat » globale si au moins une section en contient.

| Situation | Message recommandé | Comportement |
|---|---|---|
| 0 chaîne, 5 programmes | « Aucune chaîne correspondante » dans Chaînes | La section Programmes reste visible |
| 5 chaînes, 0 programme | « Aucun programme correspondant » dans Programmes | La section Chaînes reste visible |
| 0/0, recherche achevée | « Aucun résultat pour “…” dans les pays disponibles » | Proposer une autre requête |
| Section programmes en échec, chaînes OK | « Les programmes n'ont pas pu être chargés » | Afficher les chaînes ; réessai programmes seulement |
| Section chaînes en échec, programmes OK | « Les chaînes n'ont pas pu être chargées » | Afficher les programmes ; réessai chaînes seulement |
| Une page supplémentaire échoue | « Impossible de charger d'autres résultats » | Garder toutes les lignes déjà affichées ; bouton Réessayer |
| Réponse ancienne reçue après nouvelle saisie | Aucun affichage, requête obsolète ignorée | Ne pas mélanger les pays, heures, compteurs ou requêtes |
| Résultat devenu indisponible | « Cette chaîne / émission n'est plus disponible » sur destination | Retour vers recherche avec contexte |
| Nombre total inconnu | « Voir plus » sans compteur inventé | Ne pas promettre un total inexistant |

Si l'API globale `/public/tv/search` échoue entièrement, ne pas laisser une ancienne liste sembler correspondre à une nouvelle requête : afficher l'erreur et un réessai, éventuellement conserver l'ancienne liste **clairement étiquetée** comme résultat de la requête précédente.

## 7. Catalogue unifié des états particuliers UX-03

| État | Apparence et texte attendu | Accessibilité / sécurité |
|---|---|---|
| INITIAL | Prompt « Rechercher une chaîne, un numéro ou un titre dans tous les pays disponibles » | Aucune requête API automatique |
| LOADING | Skeleton simple ou indicateur, les résultats précédents non trompeurs | `aria-busy`, statut annoncé une fois |
| RESULTS | Sections séparées, identités et pays visibles | Résultats accessibles clavier |
| NO_MATCH | Aucune correspondance, pistes de nouvelle recherche | Ne pas suggérer une chaîne fictive |
| PARTIAL | Section réussie conservée, erreur sur l'autre | Réessai ciblé et statut explicite |
| PAGINATION_ERROR | Résultats actuels conservés | Lien de réessai, pas de scroll réinitialisé |
| NETWORK_ERROR | Message non alarmiste « Recherche indisponible pour le moment » | Bouton Réessayer |
| EMPTY_COUNTRY | Pays actif sans chaîne dans accueil/fiche | Expliquer absence de chaînes, pas EPG |
| EMPTY_LANGUAGE | Filtre langue exclut les chaînes sur accueil | Proposer « Toutes les langues » |
| EPG_UNAVAILABLE | « Programme non disponible » dans carte/grille | **Jamais** de fiche programme fictive |
| NO_START_IN_WINDOW | « Aucun programme débutant sur cette plage » **si couverture confirmée** | Ne pas substituer l'émission déjà en cours |
| INACTIVE | Pays ou chaîne désactivée | Ne jamais exposer les entrées publiques |
| STALE_DATA | Dernière grille connue, actualisation en échec | Afficher date/état de fraîcheur ; pas d'affirmation temps réel |
| LICENSE_MISSING | Description/image non autorisée | Omettre le contenu ; fallback local honnête |
| PRE_GO | Pas de contenu Guide TV sur routes publiques | 404 générique, no-store, exclusion sitemap |

## 8. Limites de fuseaux et de langues

- Recherche mondiale ne dépend **ni du pays**, ni de la **langue de diffusion** choisie dans l'accueil.
- Le texte peut correspondre à un titre original ou alternatif réellement stocké et permis ; aucune traduction automatique de requête ou des émissions.
- Les huit langues UI LMN24 (`fr,en,de,es,pt,it,ru,nl`) nécessitent des libellés localisés et des formats `Intl.DateTimeFormat`, sans confondre locale de l'UI et langue de l'émission.
- Un résultat programme affiche toujours **pays, chaîne, numéro, date et heure**, mais les heures se convertissent dans `CHANNEL` ou `VISITOR` selon préférence du mode d'affichage.
- Si la conversion provoque un changement de date, l'afficher explicitement ; le tri mondial reste déterministe par pays puis numéro national, non modifié par le fuseau visiteur.
- Une chaîne multivariante figure **une seule fois par pays** parmi les chaînes. Les émissions de variantes distinctes conservent leur identité d'airing ; les doublons d'émission identiques sur variantes sont une règle de dédup à formaliser avec Winston.

## 9. Composants UX proposés

| Composant | Responsabilité |
|---|---|
| `TvWorldSearchForm` | Saisie, soumission explicite, effacer, label accessible |
| `TvSearchStatus` | Résumé des résultats, chargement, erreur et annonce polie |
| `TvSearchSection` | Titre Chaînes/Programmes, compteur optionnel, pagination |
| `TvSearchChannelResult` | Pays, numéro, logo, nom et lien fiche chaîne |
| `TvSearchAiringResult` | Chaîne, pays, date, fuseau, titre et lien diffusion |
| `TvSearchLoadMore` | Pagination sans perte des lignes ni du focus |
| `TvSearchEmptyState` | Absence de résultats vraie, sans faux programme |
| `TvSearchErrorState` | Erreur globale ou partielle avec réessai |
| `TvLocalTimeHint` | Fuseau utilisé, date décalée et indication heure chaîne |
| `TvMissingEpgState` | Message EPG absent distinct de NO_START_IN_WINDOW |

Les composants doivent réutiliser couleurs Bootstrap/LMN24, le thème sombre public, la grille responsive et les pictogrammes existants ; éviter une bibliothèque visuelle indépendante.

## 10. Recette UX-03 — scénarios d'acceptation

| ID | Scénario | Attendu |
|---|---|---|
| UX03-01 | Rechercher `2` | Uniquement numéro exact 2 dans tous les pays actifs |
| UX03-02 | Rechercher `12` | Aucun numéro 2 par similarité |
| UX03-03 | Rechercher `002` | Normalisation à confirmer, sans résultat « contient 002 » |
| UX03-04 | Rechercher `France 2` | Recherche textuelle et non numéro isolé |
| UX03-05 | Saisie accents, casse, caractères internationaux | Texte partiel insensible aux accents/casse selon données disponibles |
| UX03-06 | Rechercher titre original/alternatif | Retrouver titres existants, sans traduction |
| UX03-07 | Changer le pays/filtre langue sur l'accueil | Recherche toujours mondiale |
| UX03-08 | Chaîne présente dans plusieurs pays | Une ligne par couple chaîne/pays, numéros corrects |
| UX03-09 | Plusieurs variantes d'une chaîne | Une seule ligne chaîne pour un pays |
| UX03-10 | Chaîne ou pays inactifs | Absence totale des résultats et 404 direct |
| UX03-11 | Cliquer un résultat chaîne | Page de la bonne chaîne/pays |
| UX03-12 | Cliquer une émission | Bonne diffusion, variante et horaires UTC |
| UX03-13 | Deux sections ont des résultats différents | Compteurs/états spécifiques, pas de « aucun résultat » global |
| UX03-14 | Erreur uniquement sur Programmes | Chaînes visibles ; retry ciblé |
| UX03-15 | Échec de la page 2 | Page 1 intacte ; bouton de réessai |
| UX03-16 | Réponse réseau obsolète après nouvelle requête | Aucun mélange des jeux de résultats |
| UX03-17 | Mode heure visiteur à la veille/lendemain | Date locale correcte, destination airing inchangée |
| UX03-18 | Résultat devenu indisponible après clic | Explication et retour, sans remplacement arbitraire |
| UX03-19 | Requête vide | Pas d'appel ni de faux 0 résultat |
| UX03-20 | Mobile 320/360/390 px | Une colonne, pas de débordement de document |
| UX03-21 | Desktop 768/1024/1440 px | Sections bien hiérarchisées et liens lisibles |
| UX03-22 | Navigation clavier / lecteur d'écran | Focus, annonces et labels non ambigus |
| UX03-23 | Huit locales LMN24 | Libellés localisés, pays/numéros persistants |
| UX03-24 | Aucune EPG / aucun départ connu | États différenciés sans diffusion fictive |
| UX03-25 | Avant GO public | Routes backend + frontend 404/no-store, aucune indexation ni fuite |
| UX03-26 | API annonce un total inconnu | Pas de compteur inventé, pagination vraie |

## 11. Dépendances et décisions encore ouvertes

1. **Mary + Sally — chiffres en tête** : normaliser `002` vers 2, rejeter les zéros seuls, prévoir les numéros comportant des suffixes (la règle validée ne couvre explicitement que les requêtes entièrement numériques). Proposition UX : numéro entier positif, zéros en tête acceptés et normalisés.
2. **Winston — contrat JSON** : préciser une réponse avec pagination et erreurs **indépendantes** Chaînes/Programmes, indication `hasNext`, `total` facultatif et statut `PARTIAL`. Si l'API ne peut renvoyer une section en cas d'erreur d'une autre, prévoir deux endpoints ou un agrégateur tolérant.
3. **Winston — déduplication programme** : définir le comportement d'une même émission présente sur plusieurs variantes et de ses occurrences multiples, sans supprimer de diffusions légitimement distinctes.
4. **Mary — tri** : ordre pays puis numéro croissant (validé), mais ordre des pays à trancher (ISO2 stable proposé vs nom localisé). Proposition Sally : nom localisé pour les visiteurs, clé ISO stable en pagination.
5. **Winston/Murat — sécurité** : filtrage droits des données EPG, rate limiting, taille maximum de `q`, protection injection et temps de réponse sur grands volumes mondiaux.
6. **Sally/Murat — performance perçue** : viser une première réponse perçue rapide sur mobile ; fixer des budgets chiffrés uniquement avec mesures de performance, pas inventer de métrique.
7. **Sally — maquettes visuelles** : reproduire recherche, résultats mixtes, erreurs partielles et 320 px en haute fidélité sur la charte LMN24 ; vérifier le parcours clavier.

**Suite :** UX-04 — administration des pays, chaînes, sources EPG, imports, traductions et statistiques. Puis UX-05 — revue croisée Mary/Winston/Sally/Murat et arbitrages avant transmission à John.

**Aucune implémentation, recherche web externe ni migration exécutée pour UX-03.**
