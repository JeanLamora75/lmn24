# LMN24 — Guide TV mondial — Sally — UX-01 : accueil responsive, cartes et interactions

**Date :** 2026-11-20  
**Version :** UX-01 v1.0 — spécification de maquettes fonctionnelles, **à faire valider sur rendu visuel**  
**Références :** [étude Sally v0.1](./guide-tv-mondial-sally-etude-ux-ui-initiale.md), [cadrage Mary](./guide-tv-mondial-mary-cadrage-fonctionnel.md), [contrats Winston](./guide-tv-mondial-winston-contrats-api-fusion-epg.md).  
**Portée :** page d'accueil Guide TV, ses composants, responsive, états et tests UX. Pas de page créée. **Embargo : pas de route ni navigation publique sans GO explicite.**

## 1. Direction visuelle LMN24

Le composant public `PublicHeader.module.css` repose sur une identité **bleu LMN24 / blanc / bleus pâles** et des éléments arrondis ; `globals.css` utilise les variables Bootstrap `--bs-*`, y compris le support du thème sombre. La nouvelle section doit réutiliser ces tokens, l'espacement de la page et les mécanismes de navigation de LMN24. Pas de nouvelle charte indépendante.

**Hiérarchie :** titre de page (H1), petite accroche explicative, recherche mondiale, trois filtres, date, onglets, puis liste de cartes. Éviter une succession de grands panneaux qui ferait disparaître les premières émissions sous la ligne de flottaison mobile.

- Fond : `var(--bs-body-bg)`; cartes `var(--bs-card-bg, var(--bs-body-bg))` ; bordure `var(--bs-border-color)`.
- Accent : `var(--bs-primary)` réservé aux interactions sélectionnées et aux liens ; pas de fonds entièrement bleus sur toutes les cartes.
- Contrastes et mode sombre : ne jamais figer un texte sombre sur une variable de fond sombre.
- Rythme : espaces 8/12/16/24 px selon densité ; boutons cibles tactiles **44×44 px minimum**.
- Typographie : le titre du programme est l'élément le plus saillant de la carte, avant la catégorie, les badges et le temps restant.
- Illustrations de secours : fichiers **locaux par catégorie**, sans laisser penser qu'il s'agit de captures réelles d'émissions.

## 2. Wireframes — desktop (largeur cible 1440 px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ EN-TÊTE LMN24 EXISTANT (aucune entrée TV avant GO)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Programme TV                                      [ 🔎 Recherche mondiale ] │
│ Retrouvez les chaînes gratuites nationales de votre pays                   │
│ ┌───────────────┐ ┌───────────────────────┐ ┌─────────────────────────────┐ │
│ │ Pays : France │ │ Langue : Toutes      │ │ Heure : Chaîne             │ │
│ └───────────────┘ └───────────────────────┘ └─────────────────────────────┘ │
│                    ◀   Vendredi 20 novembre 2026   ▶                       │
│ ┌──────────┬───────────────┬──────────────┬─────────────────────────────┐ │
│ │ Chaînes  │ En ce moment  │ CE SOIR      │ 2ème partie                 │ │
│ └──────────┴───────────────┴──────────────┴─────────────────────────────┘ │
│                                                                              │
│ ┌───────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ [LOGO] 20:45  Titre long       [TV]│ │ [LOGO] 21:00  Titre...        [TV]│ │
│ │  n° 2  Documentaire · 90 min      │ │  n° 3  Film · 110 min             │ │
│ └───────────────────────────────────┘ └───────────────────────────────────┘ │
│ ┌───────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ [LOGO] Programme non disponible   │ │ [LOGO] Aucun nouveau départ      │ │
│ │  n° 4  Données EPG absentes       │ │  n° 5  sur la plage 20:30–21:30  │ │
│ └───────────────────────────────────┘ └───────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Spécification :** conteneur aligné sur les pages publiques existantes, max-width issu de leur layout ; filtres flexibles sur une ligne ; date centrée sur une ligne propre ; onglets lisibles sans réduction de police. Grille de cartes à **deux colonnes uniquement si la zone de texte centrale conserve >= 180 px**, sinon une colonne. Ne pas confondre numéro de chaîne et heure.

## 3. Wireframe — mobile 390 px

```
┌──────────────────────────────────┐
│ Header LMN24 existant            │
├──────────────────────────────────┤
│ Programme TV                     │
│ [ 🔎 Rechercher partout…        ]│
│ [ Pays : France          ▾      ]│
│ [ Langue : Toutes       ▾       ]│
│ [ Heure : chaîne        ▾       ]│
│                                  │
│ [◀] Vendredi 20 novembre   [▶]  │
│ ┌────────── bande scrollable ───┐│
│ │ Chaînes | En ce moment |      ││
│ │ Ce soir | 2ème partie →       ││
│ └───────────────────────────────┘│
│                                  │
│ ┌───────────────────────────────┐│
│ │[logo] 20:45  Un titre de  [img]││
│ │  2    programme            ││
│ │       Magazine · 90 min      ││
│ └───────────────────────────────┘│
│ ┌───────────────────────────────┐│
│ │[logo] Programme non disponible││
│ │  3    Données EPG absentes   ││
│ └───────────────────────────────┘│
└──────────────────────────────────┘
```

**Décision de composition Sally** : 1 colonne pleine largeur, aucun débordement horizontal du document, seuls les onglets peuvent défiler horizontalement. Tous les libellés restent complets, pas d'abréviation ambiguë (« En cours » ne remplace pas « En ce moment »). Filtres empilés au début ; seulement l'entête LMN24 reste selon le comportement existant, **ne pas créer un panneau fixe supplémentaire** qui réduit la hauteur de consultation.

## 4. Wireframe — très petit mobile 320 px

```
┌──────────────────────────────┐
│ Programme TV                 │
│ [ Rechercher toutes chaînes] │
│ [ Pays                 ▾ ]  │
│ [ Langue               ▾ ]  │
│ [ Heure                ▾ ]  │
│ [‹] Ven. 20 nov. 2026 [›]  │
│ [Chaînes][En ce moment]→    │
│                ...           │
│ [📺] 20:45  Titre      [▧]  │
│  2   Magazine · 90 min       │
└──────────────────────────────┘
```

- Libellé de date raccourci seulement par `Intl.DateTimeFormat` pour la locale courante ; l'attribut accessible conserve la date longue.
- Bouton flèche gauche/droite chacun de 44 px, **emplacements conservés** lorsque `disabled`.
- Logo carré environ 40–44 px, vignette image environ 48–56 px et colonne centrale extensible ; si le titre déborde, le tronquer **visuellement** après deux lignes, titre entier disponible sur la fiche et accessible au lecteur d'écran.
- Pour les états vides, la vignette à droite peut être remplacée par un pictogramme neutre pour préserver la densité.

## 5. Structure et contrats de chaque composant

| Composant | Entrée | Rendu | Action et protection |
|---|---|---|---|
| `TvGlobalSearch` | texte de requête libre | champ + label mondial | ouvre la recherche après GO, aucune dépendance au pays/langue sélectionnés |
| `TvCountrySelector` | pays actifs, pays choisi | nom localisé | change le pays et le jour de référence ; ne modifie pas les préférences globales |
| `TvBroadcastLanguageSelector` | langues et toutes | option « Toutes les langues » | filtre les chaînes, pas les traductions UI |
| `TvClockModeSelector` | CHANNEL / VISITOR | option heure chaîne / mon heure | convertit seulement l'affichage, sans changer la sélection des programmes |
| `TvDateNavigator` | J0…J+6 dans timezone pays | date centrée, flèches réservées | désactive les dates hors plage ; clavier et états annoncés |
| `TvGuideTabs` | CHANNELS, NOW, TONIGHT, LATE | quatre vrais libellés | Ce soir par défaut ; NOW indisponible après J0 |
| `TvChannelCard` | identité + numéro du pays | carte sans faux programme | clic => grille d'aujourd'hui |
| `TvAiringCard` | vraie diffusion | logo, horaire, titre, catégorie/durée, image | clic => fiche émission |
| `TvEpgMissingCard` | EPG_UNAVAILABLE | « Programme non disponible » | ne crée aucun lien de programme |
| `TvNoStartCard` | NO_START_IN_WINDOW | message de plage connue | ne crée aucun lien de programme |
| `TvGuideFeedback` | chargement, erreur, vide | état textuel et réessai | garde si possible la dernière grille valide |

### Carte détaillée (valeurs indicatives non issues du direct)

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────┐  20:45                         ┌────────────┐ │
│ │ LOGO │  Titre de l'émission           │ IMG / CAT  │ │
│ │      │  Catégorie · 1 h 30            │ fallback   │ │
│ └──────┘                                └────────────┘ │
│   n° 2                                                  │
└─────────────────────────────────────────────────────────┘
```

La *jauge* ne s'affiche qu'en onglet ou contexte d'une diffusion **effectivement en cours**, avec `max=duration` et progression bornée, et un texte accessible `« Émission en cours, 35 minutes écoulées sur 90 »`; elle n'est ni animée inutilement ni affichée en pourcentage sans contexte.

## 6. Règles d'état et transitions

### Initialisation
1. Résoudre le pays depuis la préférence explicite du visiteur **si actif**, sinon le pays correspondant à la locale LMN24 **si actif**, sinon un repli déterministe à arbitrer avec Mary.
2. Langue de diffusion = « Toutes les langues » sauf choix courant volontaire ; langue UI toujours celle du site.
3. Date = aujourd'hui **dans le fuseau IANA du pays** ; onglet par défaut `TONIGHT` ; mode horaire = dernier choix enregistré, sinon `CHANNEL`.
4. Requête schedule ; trier par numéro national puis nom ; une carte par chaîne **et pays**, variantes regroupées.

### Interactions
- **Pays** : recalcul de la date du pays, annulation de la requête précédente, état de chargement sans flash d'émissions de l'ancien pays présentées comme nouvelles.
- **Langue diffusion** : filtre les chaînes, conserve pays/date/onglet ; aucun enregistrement des préférences par défaut.
- **Changement heure** : conversion UI locale uniquement ; ne relance pas une recherche de programmes différente.
- **Date** : conserve l'onglet si possible ; passage J0 -> J+1 depuis NOW = proposition Sally de sélectionner TONIGHT avec annonce `aria-live`, à valider par Mary.
- **Onglets** : ne modifient pas la date ; `NOW` réservé à J0 ; `CHANNELS` montre toutes les chaînes.
- **Retour arrière** : restaurer filtres/date/onglet au niveau navigation écran lorsque techniquement possible, sans forcer de sauvegarde dans le profil.
- **Nuit et DST** : les fenêtres des émissions sont déterminées par le fuseau de la variante ; choix VISITOR ne modifie jamais le résultat.

### États d'erreur
- `EPG_UNAVAILABLE` : source absente/insuffisante, message sans lien émission.
- `NO_START_IN_WINDOW` : seulement lorsque la couverture est assez sûre, sinon EPG_UNAVAILABLE.
- `ERROR_FETCH` : conserver la dernière grille comme données potentiellement anciennes avec avertissement et bouton Réessayer ; ne jamais réattribuer ces cartes au nouveau pays.
- `EMPTY_COUNTRY` : pays actif sans chaîne active = « Aucune chaîne disponible pour ce pays » et non « Programme non disponible ».
- `EMPTY_LANGUAGE` : pays avec chaînes mais aucune dans la langue = expliquer le filtre et proposer « Toutes les langues ».
- `LOADING` : éléments de hauteur cohérente, pas de faux horaires dans les squelettes ; `aria-busy`.

## 7. Matrice de vérification UX-01

| Référence | Test | Attendu |
|---|---|---|
| UX01-01 | Ouvrir sur mobile et ordinateur | Ce soir présélectionné ; filtres et date visibles sans confusion |
| UX01-02 | Changer de pays à locale différente | Date J0 recalculée avec IANA pays |
| UX01-03 | Naviguer J0→J+6 | Pas de J-1/J+7, flèches gardent leur place |
| UX01-04 | Ouvrir « Chaînes » sur J+4 | Carte ouvre grille de **J0** |
| UX01-05 | Changer langue de diffusion | UI conserve sa locale, seules chaînes sont filtrées |
| UX01-06 | Changer mode d'heure | Titres, onglets et sélection restent identiques |
| UX01-07 | Emission à 20:20 | Ne figure pas dans Ce soir 20:30–21:30 |
| UX01-08 | Emission à 20:30 et à 21:30 | Les bornes exactes suivent la règle API (inclusives à clarifier pour minute 21:30) |
| UX01-09 | Grille manquante | « Programme non disponible », pas de vraie fiche |
| UX01-10 | Pas de début dans fenêtre connue | « Aucun programme débutant sur cette plage » |
| UX01-11 | Image et logo absents | Fallback visible, aucun saut de mise en page |
| UX01-12 | Variante Est/Ouest | Une seule carte de chaîne, sélecteur en page détail |
| UX01-13 | 320,360,390 px | Aucune barre horizontale de document ni contrôle hors champ |
| UX01-14 | 768,1024,1440 px | Cartes équilibrées, pas de troncature incompréhensible |
| UX01-15 | Clavier et lecteur d'écran | Ordre logique, tablist accessible, focus visible et textes complets |
| UX01-16 | Avant GO public | Aucun lien, URL, sitemap, recherche TV ou donnée publique exposés |

## 8. Dépendances, points à arbitrer et étape suivante

- **Mary :** comportement NOW vers une date future, repli pays, sémantique des fenêtres horaires à leur borne, priorité du choix de variante lorsque la chaîne en a plusieurs.
- **Winston :** le contrat `TV_NO_START_IN_WINDOW` doit être produit seulement si la couverture EPG a été prouvée. La réponse doit toujours avoir les informations nécessaires aux états vides.
- **Murat :** tester 8 langues, DST, petits écrans, long titres, erreurs réseau, absence EPG, embargo.
- **Sally — UX-02 :** finaliser les maquettes détaillées des fiches chaîne et émission, de la grille chronologique, de la sélection de variantes, puis UX-03 recherche.
- La maquette visuelle haute fidélité nécessitera une matérialisation écran et une revue graphique. **Ce document n'est pas une capture ni une maquette pixel-perfect.**

**Aucun code frontend/route publique modifié, aucune migration exécutée, aucune recherche web externe menée.**
