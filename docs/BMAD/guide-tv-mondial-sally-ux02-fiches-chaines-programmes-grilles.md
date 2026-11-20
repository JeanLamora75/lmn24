# LMN24 — Guide TV mondial — Sally — UX-02 : fiches chaînes, programmes et grilles

**Date :** 2026-11-20  
**Version :** UX-02 v1.0 — spécification fonctionnelle UI, wireframes desktop/mobile, scénarios de recette. **Rendu haute fidélité encore à valider.**  
**Statut :** étude UX publiée sur `main`, aucun développement/route publique activé.  
**Références :** [Mary — cadrage fonctionnel](./guide-tv-mondial-mary-cadrage-fonctionnel.md), [Sally — UX-01 accueil](./guide-tv-mondial-sally-ux01-accueil-responsive.md), [Winston — contrats API](./guide-tv-mondial-winston-contrats-api-fusion-epg.md).  
**Embargo :** aucun accès public, aucune entrée de navigation, résultat indexable ou URL accessible avant **GO explicite du propriétaire LMN24**. Les maquettes utilisent exclusivement des chaînes et émissions fictives.

## 1. Objectifs et périmètre du lot

L'utilisateur doit pouvoir :
1. Depuis **Chaînes**, ouvrir la fiche d'une chaîne et la grille du **jour courant J0** (décision Mary), quel que soit J+N sélectionné sur l'accueil.
2. Depuis une **carte de programme réel**, ouvrir la fiche de **cette diffusion précise**, en conservant pays, chaîne, variante, heure et date d'origine.
3. Sur la page chaîne, consulter la **grille complète sur J0–J+6**, défiler verticalement dans la journée et passer d'une variante nationale à une autre.
4. Comprendre ce qui est connu ou non de la grille, sans programmation inventée.
5. Utiliser **Heure de la chaîne** ou **Mon heure locale**, sans modifier les horaires réels ni la sélection des programmes.
6. Ouvrir la page officielle de streaming **uniquement depuis la page chaîne**, si une URL officielle est disponible.

Hors périmètre de ce lot : recherche mondiale UX-03, création/import de données et administration UX-04, player vidéo embarqué, traductions automatiques des titres/synopsis EPG.

## 2. Architecture de navigation

```
Accueil Guide TV
  ├─ onglet « Chaînes » -> carte chaîne -> Page chaîne [J0]
  │                                          ├─ date J0…J+6
  │                                          ├─ variante (si > 1)
  │                                          ├─ grille chronologique
  │                                          │     └─ émission réelle -> Fiche diffusion
  │                                          └─ Regarder en direct -> site OFFICIEL
  ├─ onglet « En ce moment » -> carte émission -> Fiche diffusion
  ├─ onglet « Ce soir » -> carte émission -> Fiche diffusion
  └─ onglet « 2ème partie » -> carte émission -> Fiche diffusion

Fiche diffusion -> lien « Voir la grille de cette chaîne » -> page chaîne
Retour navigateur -> restituer contexte précédent si l'URL / historique le permet
```

Les liens internes ne portent jamais vers un programme fictif. Les routes internes proposées restent **indicatives** et doivent être validées avec Winston, en conservant le schéma i18n/canonical déjà utilisé dans LMN24.

### Contexte minimal de navigation

| Situation | Date à l'ouverture | Variante | Retour attendu |
|---|---|---|---|
| Carte depuis « Chaînes » | J0 du pays, même si accueil J+4 | Défaut de cette chaîne | Retour sur l'accueil J+4 |
| Carte émission depuis « Ce soir » J+3 | Date/instant de l'émission sélectionnée | Variante réelle de cette diffusion | Retour à « Ce soir » J+3 |
| Carte émission depuis « En ce moment » | J0 ; instant réellement diffusé | Variante réelle | Retour à « En ce moment » si encore applicable |
| Lien grille depuis la fiche émission | Jour local de diffusion dans le fuseau de sa variante | Variante de la diffusion | Positionnement sur l'émission |
| Ouverture directe de la page chaîne | J0 du pays, variante par défaut | Variante par défaut | Pas de dépendance à un historique préalable |

**Arbitrage à obtenir :** la « date locale de l'émission » peut différer de la date du pays de référence autour de minuit. La page chaîne utilise la journée de **la variante sélectionnée** ; le lien émis depuis la fiche doit préciser explicitement la `localDate` calculée à partir de cette variante.

## 3. UX de la fiche chaîne — desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [< Retour au Guide TV]                     LMN24 > Programme TV > Chaîne      │
│                                                                              │
│ ┌───────┐   EXEMPLE TV                              [Regarder en direct ↗] │
│ │ LOGO  │   n° 2 • France • Français                                         │
│ └───────┘   Description éditoriale si connue...                              │
│             [Site officiel ↗] [YouTube ↗] [Instagram ↗] ...                 │
│                                                                              │
│ Programmation                                                              │
│ [Variante : Principale (Europe/Paris) ▾]   [Heure de la chaîne ▾]           │
│                     [‹] Vendredi 20 novembre 2026 [›]                       │
│                                                                              │
│ 00:00 ─┬─────────────────────────────────────────────────────────────         │
│        │ Programme précédent encore en cours (23:40–00:30)                 │
│ 00:30 ─┼─ Programme non disponible (lacune, pas d'émission fictive)         │
│ 01:15 ─┼─ [01:15] Émission fictive              [Catégorie] [image]          │
│ 02:10 ─┼─ [02:10] Autre émission...                                        │
│ ...     │                                                                   │
│ 20:45 ─┼─ [20:45] Programme sélectionné                                     │
│ 23:59 ─┴─────────────────────────────────────────────────────────────         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **En-tête identitaire** : logo accessible ou avatar de remplacement, nom H1, n° national et pays côte à côte, langue(s) de diffusion. Les éléments secondaires sont affichés seulement s'ils existent.
- **Description** : langue UI si disponible, sinon description d'origine avec signal discret « Description dans la langue d'origine » ; ne jamais inventer de traduction.
- **Liens officiels** : icônes + noms accessibles, URLs vérifiées et normalisées côté serveur. Ouvrir en nouvel onglet avec protection `noopener noreferrer`. Pas de bouton grisé lorsqu'aucune URL n'existe.
- **Regarder en direct** : uniquement ici, placé dans l'en-tête si `officialLiveUrl` connu et validé ; renvoie vers le site officiel. Ne pas confondre le bouton et une vidéo intégrée.
- **Informations de programme** : grille chronologique verticale, avec borne « Début de journée » et « Fin de journée » ; la hauteur des lignes reste lisible, sans tenter de proportionner exactement 24 h sur une très longue frise.
- **Action d'une émission** : carte entière sélectionnable quand elle correspond à une diffusion réelle ; survol, focus visible, titre complet dans une destination sémantique.
- **Lacune** : panneau sobre « Programme non disponible de 00:30 à 01:15 », uniquement si bornes connues ; ne pas créer de fiche programme ni de faux identifiant.
- **Navigation** : date centrée, mêmes contrôles que UX-01. Si la chaîne n'a qu'une variante, aucun contrôle de variante ne prend de place.

## 4. UX de la fiche chaîne — mobile (390 px, jusqu'à 320 px)

```
┌────────────────────────────────┐
│ [‹ Guide TV]                   │
│ [LOGO] Exemple TV              │
│        n° 2 · France           │
│ [Description…]                 │
│ [Site officiel ↗]              │
│ [Regarder en direct ↗]         │
│                                │
│ Programmation                  │
│ [Variante principale ▾]        │
│ [Heure de la chaîne ▾]         │
│ [‹]  Ven. 20 nov. 2026  [›]  │
│                                │
│ ● 00:00  Programme en cours... │
│ │                              │
│ ○ 00:30  Programme indisponible│
│ │                              │
│ ● 01:15  Titre de l'émission   │
│ │         Catégorie · 55 min   │
│ ● 02:10  Autre émission        │
└────────────────────────────────┘
```

- En-tête compact avec identité visible avant les réseaux sociaux.
- Afficher description tronquée à un nombre raisonnable de lignes avec « Lire la suite » **si elle est réellement longue** ; ne pas ajouter de bloc vide si elle manque.
- Les liens sociaux peuvent être dans une ligne de boutons avec retour à la ligne : **aucun scroll horizontal du document**.
- Les sélecteurs variante et mode horaire restent des contrôles distincts avec libellé explicite.
- **Timeline** sur une colonne, heure toujours visible au début d'un item ; description optionnelle et image plus discrète que sur desktop.
- Contrôles 44×44 px, titres jusqu'à deux lignes en listing mais lecture intégrale sur fiche émission ; ordre clavier du haut vers le bas.
- L'horaire local d'une émission la veille ou le lendemain pour le visiteur inclut une mention de décalage de date (« la veille » / « le lendemain ») ; ne pas dissimuler le changement de jour.

## 5. Variantes et fuseaux horaires

### Présentation des variantes
- Une seule carte de chaîne dans tout le Guide, même si plusieurs variantes « Est/Ouest ».
- Le sélecteur apparaît seulement si la chaîne compte **plus d'une variante nationale disponible pour le pays**. Étiquette par exemple : « Variante de diffusion — Est (America/New_York) ».
- Ne pas choisir de variante uniquement sur l'IP du visiteur ; ouvrir la variante marquée par défaut pour cette chaîne/pays. Si aucune variante par défaut valide n'est publiée, fallback déterministe à spécifier avec Winston et état informatif.
- Lors d'un changement de variante : conserver si possible l'offset J+N de navigation, recalculer la journée locale dans le fuseau de la nouvelle variante ; le mode « Mon heure locale » reste inchangé.
- Si la variante n'a aucune donnée EPG, afficher l'état lacunaire de cette variante, jamais silencieusement une grille d'une autre variante.

### Modèle temporel
- Base : `startsAt`, `endsAt` en UTC ; `timeZone` IANA de la variante ; `referenceTimeZone` IANA du pays.
- Date sélectionnée sur l'accueil : **jour civil du pays**, à partir de `referenceTimeZone`.
- Date de la grille de chaîne : **jour civil de la variante sélectionnée**. Pour la navigation J0…J+6, la correspondance exacte des offsets à travers les fuseaux demande validation Mary/Winston.
- Bornes : demi-ouvertes `[00:00 locale, 00:00 locale jour suivant)` converties en UTC ; les jours de changement d'heure contiennent réellement **23 ou 25 h**, sans horaires inventés.
- Une émission recoupant la journée est affichée si `startsAt < endOfDayUtc && endsAt > startOfDayUtc` ; on affiche son début réel en plus de l'indication « commencée la veille » si besoin.
- Mode **Heure de la chaîne** : horaires dans IANA de la variante.
- Mode **Mon heure locale** : formatage de ces mêmes UTC dans le fuseau IANA du navigateur, avec un indice de décalage de jour. Aucun changement de classement ou d'onglet provoqué par l'affichage.

### Cas DST particuliers
- À l'automne, deux occurrences de 02:30 peuvent représenter deux instants distincts ; associer l'offset ou une précision accessible à chaque occurrence pour les distinguer.
- Au printemps, un créneau civil inexistant ne doit jamais être inventé pour combler une lacune.
- Les durées sont calculées avec les instants UTC, pas en soustrayant naïvement les heures affichées.
- Toutes les traductions d'heures utilisent `Intl.DateTimeFormat` et IANA ; aucune constante en minutes pour les décalages.

## 6. Fiche émission — desktop et mobile

### Desktop
```
┌────────────────────────────────────────────────────────────────────┐
│ Programme TV > Exemple TV > Émission                              │
│ [← Retour à la grille]                                             │
│                                                                    │
│ [IMAGE OU ILLUSTRATION GÉNÉRIQUE]   TITRE DU PROGRAMME             │
│                                     Exemple TV · n° 2 · France     │
│                                     Ven. 20 nov. · 20:45–22:15    │
│                                     Durée : 1 h 30                 │
│                                     Catégorie : Documentaire       │
│                                     Saison 2 · Épisode 4           │
│                                     Synopsis si disponible...      │
│                                                                    │
│ [Voir la grille de cette chaîne]                                   │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile
```
┌──────────────────────────────┐
│ [← Retour]                   │
│ [IMAGE / catégorie]          │
│ TITRE COMPLET                │
│ Exemple TV · n° 2            │
│ 20:45–22:15 · 1 h 30         │
│ Documentaire                 │
│                              │
│ Synopsis...                  │
│ [Voir la grille de la chaîne]│
└──────────────────────────────┘
```

**Contenu :** nom de chaîne, pays, numéro dans ce pays, variante si plusieurs, date locale, plage horaire réelle, durée calculée, titre original et titres alternatifs **s'ils existent et sont autorisés à publier**, synopsis, catégorie, saison/épisode, image si droits approuvés. Ne pas afficher un champ vide comme une valeur informative.

**Images :** si image programme indisponible/usage non autorisé, image générique locale correspondant à la catégorie, sinon illustration TV générale ; le texte alternatif ne doit pas attribuer faussement cette illustration à l'émission. Pas de lien vers « Regarder en direct » sur cette page ni sur une carte émission (décision Mary).

**Disponibilité de la diffusion :** si la grille a été mise à jour entre la carte et la fiche, conserver l'identité de la diffusion **ou** donner l'état « Ce programme n'est plus disponible dans la grille actuelle » avec retour à la chaîne, sans substituer silencieusement un autre programme.

**SEO :** toute fiche de diffusion a une directive `noindex`, y compris après GO ; avant GO, 404/no-store côté serveur, sans metadata TV publique. La fiche chaîne peut être indexable seulement après GO et qualification des droits/contenus.

## 7. États de la grille

| État | Rendu | Interaction |
|---|---|---|
| Chaîne active, grille disponible | Timeline réelle avec horaires | Emissions cliquables |
| Chaîne active, EPG totalement inconnu | « Programme non disponible pour cette journée » | Navigation dates disponible |
| Grille partiellement couverte | Programmes connus + blocs de lacunes | Lacunes non cliquables |
| Journée couverte sans émission annoncée | « Aucune émission programmée sur cette journée » uniquement si couverture confirmée | Navigation dates |
| Source EPG momentanément en erreur | Dernière grille valide si elle est conservée, indication d'actualisation selon provenance | Réessayer |
| Changement de variante en chargement | Skeleton neutre de même taille | Aucune ancienne grille présentée sous nouveau label |
| Chaîne désactivée ou pays désactivé | Page publique non accessible | 404 générique |
| Date hors J0–J+6 | Date non sélectionnable | Flèches disabled, 404/422 si URL invalide |
| Informations émission facultatives absentes | Blocs non affichés | Aucun libellé vide |
| Aucun lien officiel | Bouton/icone absents | Aucun lien factice |
| Visiteur autre fuseau | Horaires convertis + précision du jour local | Même émission, même UTC |
| Image non publiable juridiquement | Illustration locale générique | Aucun appel image externe non autorisé |

## 8. Composants candidats et responsabilités

| Composant UX | Responsabilité |
|---|---|
| `TvChannelHero` | Identité, pays, langues, description et liens officiels |
| `TvOfficialLiveLink` | Lien externe officiel conditionnel, page chaîne uniquement |
| `TvVariantSelector` | Sélection explicite, masqué si variante unique |
| `TvChannelDayNavigation` | Date locale de la variante, fenêtre J0…J+6 |
| `TvScheduleTimeline` | Liste chronologique accessible, bornes et lacunes |
| `TvAiringTimelineItem` | Horaires, titre, durée et image d'une vraie diffusion |
| `TvUncoveredInterval` | Lacune dans une grille sans objet programme inventé |
| `TvProgrammeDetail` | Détail de la diffusion et métadonnées optionnelles |
| `TvProgrammeImage` | Source autorisée ou illustration locale catégorie/TV |
| `TvTimeZoneLabel` | Explicitation du fuseau et du changement de date |
| `TvBackNavigation` | Retour contextuel et fallback stable |
| `TvScheduleLoadState` | Loading/error/stale/empty sans fausses données |

## 9. Recette UX-02 — critères testables

| ID | Scénario | Résultat attendu |
|---|---|---|
| UX02-01 | Depuis Chaînes, cliquer à J+4 | Fiche chaîne ouverte sur J0 |
| UX02-02 | Depuis Ce soir J+3, ouvrir émission | Bonne diffusion, pays, variante, heure et date |
| UX02-03 | Depuis fiche émission, « Voir la grille » | Bonne chaîne, variante, jour local et item ciblé |
| UX02-04 | Retour navigateur après visite | Contexte accueil conservé autant que possible |
| UX02-05 | Chaîne nationale à deux variantes | Une seule carte accueil, sélecteur sur fiche |
| UX02-06 | Chaîne à une seule variante | Aucun sélecteur inutile |
| UX02-07 | Changer de variante | Aucune émission ancienne présentée avec mauvais fuseau |
| UX02-08 | Basculer CHANNEL -> VISITOR | Horaires convertis seulement, identités inchangées |
| UX02-09 | Émission traversant minuit | Visible les jours intersectés, heure de début réelle |
| UX02-10 | Journée DST 23 h ou 25 h | Pas d'heures fantômes, durées UTC correctes |
| UX02-11 | Heure répétée au changement d'heure | Deux émissions différenciées par l'offset / contexte |
| UX02-12 | Absence totale EPG | Message vrai, aucun lien faux |
| UX02-13 | Lacune partielle | Bloc de lacune distinct, non cliquable |
| UX02-14 | Image absente ou non licenciée | Illustration locale honnête et responsive |
| UX02-15 | Absence d'URL officielle streaming | Pas de bouton « Regarder en direct » |
| UX02-16 | URL streaming disponible | Lien uniquement sur page chaîne, nouvel onglet |
| UX02-17 | Saisons/épisodes/synopsis absents | Champs omis, pas de tirets inutiles |
| UX02-18 | Chaîne et pays inactifs | 404 public, mais entrée admin conservée |
| UX02-19 | Fiche émission supprimée de grille | État indisponible explicite sans substitution |
| UX02-20 | 320,390,768,1440 px | Pas de débordement, grille lisible, focus et cibles tactiles |
| UX02-21 | 8 langues UI dont russe | Libellés complets, date locale, troncatures non trompeuses |
| UX02-22 | Avant GO explicite | Aucun accès direct aux fiches, metadata, sitemap ou API TV |

## 10. Points de décision transverses

1. **Mary + Winston :** convention exacte pour la plage J0…J+6 d'une chaîne dont la variante est dans un autre jour civil que le pays d'accueil ; préciser navigation directe et bouton retour.
2. **Winston :** pour les variantes diffusées dans plusieurs pays, la « variante par défaut » pourrait dépendre du couple chaîne/pays plutôt que de la chaîne globale ; l'UX doit respecter le contrat final.
3. **Winston + Murat :** règles de couverture EPG permettant d'affirmer « Aucune émission programmée », politique d'affichage des grilles périmées.
4. **Mary :** faut-il afficher un lien « Afficher la description d'origine » lorsqu'une traduction langue UI existe ?
5. **Sally + Murat :** décision de maquette visuelle haute fidélité, longueurs de textes en huit langues, clavier, contraste et mobile 320 px.
6. **John :** après validation, prévoir des US séparées pour page chaîne, timeline, fiche diffusion, zone horaire/variantes, lien officiel et états EPG.

**Statut UX-02 : spécification terminée ; reste à valider la maquette graphique et les arbitrages listés. Aucun code applicatif ni migration exécutés. Aucune recherche web externe lancée.**
