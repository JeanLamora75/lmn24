# Sally — UX des préférences visiteur

# LMN24 — Préférences visiteur (cadrage approuvé 2026-11-16)

Statut : spécification validée métier, à développer. Source : cadrage Mary / étude Winston et Sally. Périmètre : site public, 8 locales (fr,en,de,es,pt,it,ru,nl). Le code existant n'est pas modifié par ce document.

## Décisions métier impératives
- Aucun compte, aucune écriture des préférences personnelles en PostgreSQL, table Setting, logs, analytics ou backend.
- Stockage local du navigateur uniquement (localStorage, JSON versionné) ; aucune sollicitation automatique lors de la première visite.
- Icône Paramètres dans le header public ouvrant la modale « Mes préférences ».
- Modifications en brouillon ; Enregistrer applique et persiste, Annuler / fermeture / Échap jettent le brouillon.
- Réinitialisation individuelle et globale ; individuelle soumise à Enregistrer, globale avec confirmation, sans toucher aux données étrangères aux préférences.
- Thème clair/sombre/automatique ; pays ISO, recherche mondiale de ville par pays, date de naissance complète facultative et signe occidental calculé localement.
- Langue de l'URL / cookie next-intl indépendante du pays ; filtre ponctuel de météo ou signe ne change jamais les préférences.
- Si aucune préférence : comportement existant du site. Ordre personnalisé des catégories réservé à une évolution ultérieure ; format de stockage extensible.
- Ville favorite : ouvrir la météo sur son continent. Sur CE continent uniquement, mettre sa carte en première position, surlignée (« Ma ville ») ; si ville déjà administrée, déplacer sa carte sans doublon ; sinon récupérer ponctuellement ses données par API météo. Navigation manuelle vers d'autres continents autorisée pendant la consultation. Au retour à la rubrique, re-sélectionner le continent favori. Ne jamais créer de WeatherCity pour une ville favorite.

## Références vérifiées sur main
- apps/frontend/src/components/public/PublicHeader.tsx ; PublicHeader.module.css
- apps/frontend/src/app/[locale]/layout.tsx
- apps/frontend/src/components/weather/PublicWeather.tsx ; weather-region-choice.ts ; weather-data.ts
- apps/frontend/src/app/[locale]/weather/page.tsx ; app/api/public/weather/route.ts
- apps/frontend/src/app/[locale]/horoscope/page.tsx ; horoscope/[sign]/page.tsx
- apps/frontend/src/i18n/routing.ts

## Parcours et composants
- Header public : bouton icône paramètres toujours visible, près du sélecteur de langues, intitulé accessible traduit (« Mes préférences »), cible tactile >=44px, focus visible ; conserver navigation scrollable et grille desktop/mobile.
- Ouverture volontaire exclusivement. Modale accessible, focus initial sur titre ou premier contrôle, piège à focus, restauration du focus au bouton déclencheur, fermeture Échap/croix/hors clic comme Annuler. Aucun popup à l'arrivée.
- Trois sections V1 : Apparence (clair, sombre, automatique) ; Localisation (pays sélecteur et ville autocomplete dépendante) ; Date de naissance (jour/mois/année, signe calculé en aperçu).
- Footer modale : Annuler / Enregistrer, état modifié discernable ; message discret de sauvegarde confirmée ; fermer sans modification ni stockage lorsqu'on annule. Si une modification non enregistrée existe, ne pas la perdre en raison d'une synchronisation inter-onglet silencieuse.
- Reset individuel avec libellés accessibles, doit rester en brouillon ; bouton « Tout réinitialiser » ouvrant confirmation avant de modifier le brouillon, puis Enregistrer persiste. Aucun reset de consentement, de langue ou de cookies étrangers.
- Pays vidé ou changé : nettoyer dans le brouillon la ville incompatible. Ville facultative. Autocomplete affiche nom, région, pays et états de chargement, absence de résultat, erreur et recommencer. Un texte libre non confirmé n'est pas une ville validée.
- Date facultative, saisie accessible et validation réelle (années, 29 février, futur) ; ne pas afficher l'âge ni transmettre la date à des tiers.
- Mobile : modale adaptée à la hauteur, corps scrollable et actions toujours accessibles ; respecter dark mode et contrastes ; traduire libellés et erreurs dans les 8 langues.

## Météo : présentation de la favorite
- Sur son continent uniquement, la carte de la ville favorite est en première position avec un contour contrasté et badge « Ma ville », sans remplir toute la carte de bleu ; même structure de données et de lecture que WeatherCard.
- Une ville favorite administrée déjà présente n'apparaît qu'une seule fois. Une ville externe peut avoir un skeleton puis sa carte, sans bloquer les autres. En cas d'échec API, conserver le catalogue et afficher une information discrète.
- Changement manuel de continent : afficher le continent demandé sans la carte favorite hors de son continent ; aucun effet sur localStorage ; retour ultérieur à /weather = continent préféré.
- Ne pas introduire de deuxième écran météo ou de carte spécifique discordante avec les cartes existantes.

## Horoscope
- Signe dérivé mis en évidence dans la grille des douze signes, sans suppression des autres signes ni redirection automatique forcée. Visibilité de la préférence sans modifier les URLs indexables.

## États de recette UX
Première visite sans modale ; clavier seul ; Escape/Annuler ; clic enregistrer ; reset isolé/global ; pays changé ; 0 suggestion ; ville homonyme ; ville déjà affichée ; ville absente chargée ; échec réseau ; multi-onglets ; écran 320px ; sombre ; 8 langues ; stockage désactivé.
